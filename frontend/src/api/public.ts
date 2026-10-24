import { api } from './client';
import { normalizeBook, normalizePage, unwrapData, type Book, type BookGroup, type PageResult } from './types';

export interface PublicStats {
  totalBooks: number;
  availableBooks: number;
  totalReaders: number;
}

/** API public cho landing page: không cần đăng nhập. */
export async function listPublicBooks(params: {
  keyword?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<PageResult<Book>> {
  const { data } = await api.get('/public/books', { params });
  return normalizePage(data, normalizeBook);
}

/** Trang chủ gom đầu sách: 1 thẻ / tựa + tác giả, kèm từng cuốn vật lý. */
export async function listGroupedPublicBooks(params: {
  keyword?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<PageResult<BookGroup>> {
  const { data } = await api.get('/public/books/grouped', { params });
  const r = (data ?? {}) as Record<string, unknown>;
  const list = (Array.isArray(r.data) ? r.data : []) as Record<string, unknown>[];
  return {
    data: list.map((g) => ({
      title: String(g.title ?? ''),
      author: (g.author as string | null) ?? null,
      category: (g.category as string | null) ?? null,
      publisher: (g.publisher as string | null) ?? null,
      publishYear: g.publishYear === null || g.publishYear === undefined ? null : Number(g.publishYear),
      coverUrl: (g.coverUrl as string | null) ?? null,
      totalCopies: Number(g.totalCopies ?? 0),
      availableCopies: Number(g.availableCopies ?? 0),
      representativeId: Number(g.representativeId ?? 0),
      copies: Array.isArray(g.copies) ? (g.copies as unknown[]).map((c) => normalizeBook(c)) : [],
    })),
    total: Number(r.total ?? list.length),
  };
}

export interface AiSearchResult {
  book: Book;
  score: number;
  reason: string;
}

export interface AiSearchResponse {
  mode: 'ai' | 'fallback';
  results: AiSearchResult[];
}

/** UC16: tìm sách theo mô tả nội dung (AI Gemini, tự fallback từ khóa ở backend). */
export async function aiSearchBooks(description: string): Promise<AiSearchResponse> {
  const { data } = await api.post('/public/books/ai-search', { description });
  const body = unwrapData<{ mode?: string; results?: unknown[] }>(data);
  const results = (Array.isArray(body.results) ? body.results : []).map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      book: normalizeBook(r),
      score: Number(r.aiScore ?? 0),
      reason: String(r.aiReason ?? ''),
    };
  });
  return { mode: body.mode === 'ai' ? 'ai' : 'fallback', results };
}

export async function getPublicBook(id: number): Promise<Book> {
  const { data } = await api.get(`/public/books/${id}`);
  return normalizeBook(unwrapData(data));
}

export async function listPublicCategories(): Promise<string[]> {
  const { data } = await api.get('/public/categories');
  const body = unwrapData<{ data: string[] }>(data);
  return Array.isArray(body.data) ? body.data : [];
}

export async function getPublicStats(): Promise<PublicStats> {
  const { data } = await api.get('/public/stats');
  const body = unwrapData<Partial<PublicStats>>(data);
  return {
    totalBooks: Number(body.totalBooks ?? 0),
    availableBooks: Number(body.availableBooks ?? 0),
    totalReaders: Number(body.totalReaders ?? 0),
  };
}
