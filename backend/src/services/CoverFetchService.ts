/**
 * Tìm ảnh bìa sách từ nguồn ngoài (UC02, bản gọn 24/10/2026).
 * - Google Books trước (không bắt buộc key; nếu có GOOGLE_BOOKS_API_KEY trong env
 *   thì kèm key để tránh 429 khi chạy từ IP datacenter), sau đó Open Library.
 * - Open Library không cần key và là nguồn chính cho sách Việt (test thật 24/10:
 *   Google Books trả 429 từ IP datacenter, Open Library trả đủ kết quả).
 * - Chỉ TRẢ VỀ danh sách ứng viên (url + nguồn), KHÔNG tải ảnh, KHÔNG ghi DB:
 *   BookService sẽ thử tải từng ứng viên theo thứ tự cho đến khi thành công,
 *   rồi lưu file vào uploads/covers như upload tay.
 * - Không khớp theo ISBN vì bảng books không có cột ISBN: khớp theo tên + tác giả,
 *   nên kết quả có thể sai ấn bản (bìa khác NXB/năm) — thủ thư kiểm lại sau khi lấy.
 */

export interface CoverCandidate {
  url: string;
  source: 'google' | 'openlibrary';
}

const FETCH_TIMEOUT_MS = 8000;

/** fetch có timeout: quá hạn thì coi như nguồn đó không trả lời, để fallback nguồn còn lại. */
async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null; // 429/404/... đều coi là "nguồn này không có", không ném lỗi lên batch
    return (await resp.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Ưu tiên ảnh lớn -> nhỏ (Google Books không phải cuốn nào cũng có đủ cỡ). */
function pickGoogleImage(imageLinks: Record<string, unknown> | undefined): string | null {
  if (!imageLinks) return null;
  const order = ['extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail'];
  for (const key of order) {
    const v = imageLinks[key];
    if (typeof v === 'string' && v.trim()) {
      // Google trả http://... -> đổi sang https để trình duyệt không chặn mixed content.
      return v.replace(/^http:\/\//i, 'https://');
    }
  }
  return null;
}

/** Ứng viên từ Google Books: quét tối đa 5 kết quả đầu, lấy tối đa 3 ảnh. */
async function googleCandidates(title: string, author: string | null): Promise<CoverCandidate[]> {
  const q = `intitle:${title}${author ? ` inauthor:${author}` : ''}`;
  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5` +
    (key ? `&key=${encodeURIComponent(key)}` : '');
  const data = await fetchJson(url);
  if (!data || typeof data !== 'object' || !Array.isArray((data as { items?: unknown }).items)) {
    return [];
  }
  const out: CoverCandidate[] = [];
  for (const item of (data as { items: unknown[] }).items) {
    if (out.length >= 3) break;
    const volumeInfo = (item as { volumeInfo?: unknown })?.volumeInfo as
      | { imageLinks?: Record<string, unknown> }
      | undefined;
    const img = pickGoogleImage(volumeInfo?.imageLinks);
    if (img && !out.some((c) => c.url === img)) out.push({ url: img, source: 'google' });
  }
  return out;
}

/** Ứng viên từ Open Library: quét tối đa 10 kết quả đầu, lấy tối đa 3 bìa có cover_i. */
async function openLibraryCandidates(title: string, author: string | null): Promise<CoverCandidate[]> {
  const url =
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}` +
    (author ? `&author=${encodeURIComponent(author)}` : '') +
    '&limit=10';
  const data = await fetchJson(url);
  if (!data || typeof data !== 'object' || !Array.isArray((data as { docs?: unknown }).docs)) {
    return [];
  }
  const out: CoverCandidate[] = [];
  for (const doc of (data as { docs: unknown[] }).docs) {
    if (out.length >= 3) break;
    const coverId = (doc as { cover_i?: unknown })?.cover_i;
    if (typeof coverId === 'number' && coverId > 0) {
      const img = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      if (!out.some((c) => c.url === img)) out.push({ url: img, source: 'openlibrary' });
    }
  }
  return out;
}

/** Danh sách ứng viên theo thứ tự ưu tiên: Google Books trước, Open Library sau. */
export async function findCoverCandidates(title: string, author: string | null): Promise<CoverCandidate[]> {
  const t = title.trim();
  if (!t) return [];
  const [google, openLibrary] = await Promise.all([
    googleCandidates(t, author?.trim() || null),
    openLibraryCandidates(t, author?.trim() || null),
  ]);
  return [...google, ...openLibrary];
}
