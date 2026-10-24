import { config } from '../config';
import { Book } from '../entities/Book';
import { BookRepository } from '../repositories/BookRepository';
import { scoreBookByTokens, tokenize } from '../utils/aiSearchText';

export interface AiSearchHit {
  book: Book;
  score: number; // 0-100
  reason: string;
}

export interface AiSearchResult {
  mode: 'ai' | 'fallback';
  results: AiSearchHit[];
}

const MAX_RESULTS = 8;
const GEMINI_TIMEOUT_MS = 15000;

interface GeminiHit {
  id: number;
  score: number;
  reason: string;
}

/**
 * UC16: tìm sách theo mô tả nội dung (độc giả không nhớ tên sách).
 * Gọi Gemini với danh mục đầu sách của thư viện; chỉ chấp nhận id có thật
 * trong danh mục (chống AI bịa sách). Lỗi/thiếu key/timeout -> fallback từ khóa.
 */
export class AiBookSearchService {
  constructor(private readonly bookRepo = new BookRepository()) {}

  async search(description: string): Promise<AiSearchResult> {
    const catalog = await this.bookRepo.listDistinctTitles();
    if (catalog.length === 0) return { mode: 'fallback', results: [] };

    if (config.gemini.apiKey) {
      try {
        const hits = await this.askGemini(description, catalog);
        if (hits.length > 0) return { mode: 'ai', results: hits };
      } catch {
        // Cố ý nuốt lỗi ở đây: mọi lỗi AI (mạng, timeout, JSON hỏng) đều
        // chuyển xuống fallback từ khóa để tính năng không bao giờ sập.
      }
    }
    return { mode: 'fallback', results: this.keywordFallback(description, catalog) };
  }

  private async askGemini(description: string, catalog: Book[]): Promise<AiSearchHit[]> {
    const catalogLines = catalog
      .map(
        (b) =>
          `${b.id} | ${b.title} | ${b.author ?? 'Không rõ tác giả'} | ${b.category ?? 'Khác'} | ${
            b.publishYear ?? ''
          }`,
      )
      .join('\n');
    const prompt = [
      'Bạn là thủ thư. Dưới đây là danh mục sách của thư viện, mỗi dòng: id | tên sách | tác giả | thể loại | năm xuất bản.',
      '',
      catalogLines,
      '',
      `Độc giả không nhớ tên sách, họ mô tả nội dung như sau: "${description}"`,
      '',
      'Hãy dùng kiến thức của bạn về nội dung, nhân vật, cốt truyện của các cuốn sách trong danh mục để tìm những cuốn phù hợp nhất với mô tả.',
      'Quy tắc bắt buộc:',
      '- Chỉ chọn sách có trong danh mục trên, dùng đúng id của chúng. Tuyệt đối không bịa sách ngoài danh mục.',
      '- Trả về tối đa 8 cuốn, sắp xếp theo độ phù hợp giảm dần.',
      '- score là số nguyên 0-100 (độ phù hợp). reason là 1 câu tiếng Việt ngắn giải thích vì sao cuốn này khớp với mô tả.',
      '- Chỉ trả về JSON dạng mảng: [{"id": 1, "score": 90, "reason": "..."}]. Không thêm bất kỳ chữ nào ngoài JSON.',
    ].join('\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.gemini.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);

    const data = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = this.parseGeminiJson(text);

    const byId = new Map(catalog.map((b) => [b.id, b]));
    const hits: AiSearchHit[] = [];
    for (const item of parsed) {
      const book = byId.get(item.id);
      if (!book) continue; // AI bịa id -> bỏ
      hits.push({
        book,
        score: Math.max(0, Math.min(100, Math.round(item.score))),
        reason: String(item.reason ?? '').slice(0, 300),
      });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
  }

  /** Parse JSON từ Gemini, chịu được cả trường hợp bọc trong ```json fence. */
  private parseGeminiJson(text: string): GeminiHit[] {
    const cleaned = text.replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start < 0 || end < start) throw new Error('Gemini không trả JSON hợp lệ');
    const arr = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!Array.isArray(arr)) throw new Error('Gemini không trả mảng JSON');
    return arr
      .filter(
        (x): x is GeminiHit =>
          typeof x === 'object' &&
          x !== null &&
          Number.isFinite(Number((x as GeminiHit).id)) &&
          Number.isFinite(Number((x as GeminiHit).score)),
      )
      .map((x) => ({ id: Number(x.id), score: Number(x.score), reason: String(x.reason ?? '') }));
  }

  /** Dự phòng: chấm điểm khớp từ khóa trên tên sách / tác giả / thể loại. */
  private keywordFallback(description: string, catalog: Book[]): AiSearchHit[] {
    const tokens = tokenize(description);
    if (tokens.length === 0) return [];
    return catalog
      .map((book) => {
        const { score, matched } = scoreBookByTokens(tokens, book);
        return {
          book,
          score,
          reason:
            score > 0
              ? `Khớp từ khóa trong tên sách/tác giả/thể loại: ${matched.join(', ')}`
              : '',
        };
      })
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);
  }
}
