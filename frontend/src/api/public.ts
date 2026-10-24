import { api } from './client';
import { normalizeBook, normalizePage, unwrapData, type Book, type PageResult } from './types';

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
