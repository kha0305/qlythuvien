import { api } from './client';
import { normalizeBook, normalizePage, unwrapData, type Book, type PageResult } from './types';

export interface BookInput {
  title: string;
  author?: string;
  category?: string;
  publisher?: string;
  publishYear?: number | null;
}

/** UC02 + UC11: liệt kê/tìm kiếm sách. Độc giả dùng ở chế độ chỉ đọc để đặt trước. */
export async function listBooks(params: {
  keyword?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  status?: 'available' | 'borrowed' | 'reserved';
  publisher?: string;
  year?: number;
}): Promise<PageResult<Book>> {
  const { data } = await api.get('/books', { params });
  return normalizePage(data, normalizeBook);
}

/** Danh sách NXB (cho dropdown lọc nâng cao). */
export async function listPublishers(): Promise<string[]> {
  const { data } = await api.get('/books/publishers');
  const arr = Array.isArray(data) ? data : (data as { data?: unknown })?.data ?? [];
  return (Array.isArray(arr) ? arr : []).map(String);
}

/** Tra sách theo mã QR (dùng cho mượn/trả). */
export async function getBookByQr(qrCode: string): Promise<Book> {
  const { data } = await api.get(`/books/qr/${encodeURIComponent(qrCode)}`);
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeBook(body.book ?? body);
}

/** Chi tiết sách (độc giả). */
export async function getBook(id: number): Promise<Book> {
  const { data } = await api.get(`/books/${id}`);
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeBook(body.book ?? body);
}

/** UC02: thêm sách. quantity: số bản copy cùng lúc (mỗi bản 1 mã riêng). Trả về danh sách đã tạo. */
export async function createBook(input: BookInput, quantity = 1): Promise<Book[]> {
  const { data } = await api.post('/books', { ...input, quantity });
  const body = unwrapData<Record<string, unknown>>(data);
  const arr = body.data ?? body;
  const list = Array.isArray(arr) ? arr : [body.book ?? body];
  return list.map(normalizeBook);
}

/** Đồng bộ mã sách (book_code) cho sách cũ đang NULL. Trả về số sách đã gán mã. */
export async function syncBookCodes(): Promise<number> {
  const { data } = await api.post('/books/sync-codes');
  const body = unwrapData<Record<string, unknown>>(data) as { count?: number };
  return typeof body.count === 'number' ? body.count : 0;
}

export interface ImportResult {
  created: number;
  errors: { row: number; reason: string }[];
}

/** Nhập sách từ file Excel (.xlsx). */
export async function importBooks(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/books/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const body = unwrapData<Record<string, unknown>>(data) as unknown as ImportResult;
  return { created: Number(body.created ?? 0), errors: Array.isArray(body.errors) ? body.errors : [] };
}

/** Tải file Excel mẫu để nhập sách. */
export async function downloadImportTemplate(): Promise<void> {
  const res = await api.get('/books/import/template', { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] as string }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mau-nhap-sach.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/** UC02: sửa sách (không đổi qr_code/status). */
export async function updateBook(id: number, input: BookInput): Promise<Book> {
  const { data } = await api.put(`/books/${id}`, input);
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeBook(body.book ?? body);
}

/** UC02: xóa sách (chỉ khi status = available). */
export async function deleteBook(id: number): Promise<void> {
  await api.delete(`/books/${id}`);
}

export interface LookupBookInfo {
  source: 'bigbook' | 'itunes';
  trackId: number;
  title: string;
  author: string;
  publishYear: number | null;
  genres: string[];
  description: string;
  storeUrl: string;
  rating: number | null;
  ratingCount: number | null;
  pages: number | null;
  isbn: string | null;
}

/** Tra cứu thông tin sách (backend: Big Book trước, iTunes fallback; chỉ thông tin, không bìa). Theo mẫu listPublishers vì backend trả { data: [...] }. */
export async function searchBooksLookup(term: string, limit = 10): Promise<LookupBookInfo[]> {
  const { data } = await api.get('/books/lookup', { params: { term, limit }, timeout: 30000 });
  const arr = Array.isArray(data) ? data : (data as { data?: unknown })?.data ?? [];
  return (Array.isArray(arr) ? arr : []) as LookupBookInfo[];
}

export interface CoverFetchItem {
  bookId: number;
  title: string;
  status: 'ok' | 'not_found' | 'error';
  source: 'google' | 'openlibrary' | null;
  message: string;
}

export interface FetchMissingResult {
  results: CoverFetchItem[];
  remaining: number;
}

/** Lấy bìa tự động cho 1 cuốn (Google Books -> Open Library). Timeout 30s vì gọi API ngoài + tải ảnh.
 * Không dùng unwrapData ở đây vì cần cả coverFound/source/message ngoài book dto. */
export async function fetchBookCover(id: number): Promise<{ book: Book; coverFound: boolean; source: 'google' | 'openlibrary' | null; message: string }> {
  const { data } = await api.post(`/books/${id}/fetch-cover`, {}, { timeout: 30000 });
  const body = data as {
    data?: unknown; coverFound?: boolean; source?: 'google' | 'openlibrary' | null; message?: string;
  };
  return {
    book: normalizeBook(body.data),
    coverFound: body.coverFound === true,
    source: body.source ?? null,
    message: typeof body.message === 'string' ? body.message : '',
  };
}

/** Lấy bìa tự động cho sách chưa có ảnh, theo đợt (mặc định 10 cuốn/đợt). Timeout 60s vì gọi API ngoài nhiều lần. */
export async function fetchMissingCovers(limit = 10): Promise<FetchMissingResult> {
  const { data } = await api.post(`/books/fetch-covers-missing?limit=${limit}`, {}, { timeout: 60000 });
  const body = unwrapData<Record<string, unknown>>(data) as unknown as FetchMissingResult;
  return {
    results: Array.isArray(body.results) ? body.results : [],
    remaining: Number(body.remaining ?? 0),
  };
}

/** Upload ảnh bìa sách (multipart field "cover", JPEG/PNG/WebP <= 2MB). */
export async function uploadBookCover(id: number, file: File): Promise<Book> {
  const form = new FormData();
  form.append('cover', file);
  const { data } = await api.post(`/books/${id}/cover`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeBook(body.book ?? body);
}
