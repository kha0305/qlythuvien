/**
 * Tiện ích xử lý văn bản cho tìm sách bằng mô tả (UC16) — phần thuần, không phụ thuộc DB.
 * Dùng cho chế độ dự phòng (fallback) khi AI (Gemini) không khả dụng:
 * tách từ khóa trong câu mô tả của độc giả (kể cả khi gõ không dấu) và chấm điểm
 * khớp với tên sách / tác giả / thể loại.
 */

/** Bỏ dấu tiếng Việt: "Dế Mèn phiêu lưu" -> "de men phieu luu". */
export function removeDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // xóa dấu thanh (combining diacritics)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Từ dừng tiếng Việt (đã bỏ dấu) + từ mô tả chung chung không giúp phân biệt sách.
const STOPWORDS = new Set([
  'va', 'la', 'cua', 'co', 'mot', 'nhung', 'khi', 've', 'cho', 'trong', 'nay', 'do',
  'duoc', 'bi', 'khong', 'nho', 'hay', 'rat', 'lam', 'the', 'nao', 'gi', 'sach',
  'cuon', 'truyen', 'tieu', 'thuyet', 'noi', 'ke', 'cau', 'chuyen', 'nhan', 'vat',
  'chinh', 'tac', 'gia', 'tim', 'kiem', 'muon', 'doc', 'minh', 'toi', 'ban', 'ong',
  'ba', 'anh', 'chi', 'em', 'cau', 'chu', 'di', 'den', 'ra', 'vao', 'len', 'xuong',
  'sau', 'truoc', 'voi', 'cung', 'da', 'dang', 'se', 'thi', 'ma', 'o', 'tai', 'boi',
]);

/** Tách câu mô tả thành các token có nghĩa (chữ thường, không dấu, bỏ từ dừng). */
export function tokenize(text: string): string[] {
  const raw = removeDiacritics(text.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  return [...new Set(raw.filter((t) => !STOPWORDS.has(t)))];
}

export interface ScorableBook {
  title: string;
  author?: string | null;
  category?: string | null;
}

/**
 * Chấm điểm khớp từ khóa 0-100 cho 1 sách:
 * token xuất hiện trong tên sách (trọng số 3) > tác giả (2) = thể loại (2).
 * Trả về điểm + danh sách token khớp (để hiện lý do cho người dùng).
 */
export function scoreBookByTokens(
  tokens: string[],
  book: ScorableBook,
): { score: number; matched: string[] } {
  if (tokens.length === 0) return { score: 0, matched: [] };
  const titleTokens = new Set(tokenize(book.title));
  const authorTokens = new Set(tokenize(book.author ?? ''));
  const categoryTokens = new Set(tokenize(book.category ?? ''));
  let got = 0;
  const matched: string[] = [];
  for (const t of tokens) {
    if (titleTokens.has(t)) {
      got += 3;
      matched.push(t);
    } else if (authorTokens.has(t) || categoryTokens.has(t)) {
      got += 2;
      matched.push(t);
    }
  }
  const max = tokens.length * 3;
  return { score: Math.round((got / max) * 100), matched };
}
