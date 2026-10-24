/**
 * Tra cứu thông tin sách từ Big Book API (UC02, bản gọn 24/10/2026).
 * Tài liệu: https://bigbookapi.com/docs/
 * - Xác thực: key để trong query ?api-key=... cho mọi request (không dùng header).
 * - Tìm sách: GET https://api.bigbookapi.com/search-books?api-key=...&query=...&number=...
 *   Trả về { available, number, offset, books: [[{ id, title, subtitle?, image, authors: [{ name }], rating: { average } }], ...] }
 *   Lưu ý: books là MẢNG CỦA MẢNG (mỗi sách nằm trong 1 mảng con), và kết quả tìm
 *   CHỈ có tên/tác giả/ảnh/đánh giá, KHÔNG có năm/mô tả/số trang/ISBN.
 * - Chi tiết sách: GET https://api.bigbookapi.com/{id}?api-key=...
 *   Trả về { id, title, image, identifiers: { isbn_10, isbn_13 }, authors, publish_date (vd 2000.0),
 *   number_of_pages, description, rating: { average } }. KHÔNG có NXB, KHÔNG có thể loại.
 * - Giới hạn gói miễn phí (theo tài liệu): 60 request/phút, hết quota ngày thì trả 402.
 *   Vì vậy lookup chỉ lấy chi tiết cho 5 kết quả đầu (1 tìm + 5 chi tiết = 6 request/lần tìm),
 *   và mọi lỗi (hết quota, 429, timeout, không có key) đều trả về [] để controller
 *   fallback sang iTunes Search, không làm hỏng cả luồng tra cứu.
 * - Chỉ lấy THÔNG TIN, không lấy bìa ở đây (ảnh Big Book vốn là ảnh Open Library,
 *   đã có luồng lấy bìa riêng; form tra cứu chỉ điền tiêu đề/tác giả/năm).
 */

export interface BigBookInfo {
  source: 'bigbook';
  trackId: number;
  title: string;
  author: string;
  publishYear: number | null;
  pages: number | null;
  isbn: string | null;
  description: string;
  rating: number | null;
}

const FETCH_TIMEOUT_MS = 8000;
const DETAIL_LIMIT = 5;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null; // 402/429/404/... đều coi là "nguồn này không có", để fallback
    return (await resp.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchBigBookBooks(term: string, limit = 10): Promise<BigBookInfo[]> {
  const key = process.env.BIGBOOK_API_KEY?.trim();
  if (!key || !term.trim()) return [];
  const capped = Math.min(20, Math.max(1, Math.floor(limit)));
  const searchUrl =
    `https://api.bigbookapi.com/search-books?api-key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(term.trim())}&number=${capped}`;
  const searchData = await fetchJson(searchUrl);
  if (!searchData || typeof searchData !== 'object' || !Array.isArray((searchData as { books?: unknown }).books)) {
    return [];
  }
  // books là mảng của mảng -> làm phẳng, lấy id từng sách.
  const ids: number[] = [];
  for (const group of (searchData as { books: unknown[] }).books) {
    const items = Array.isArray(group) ? group : [group];
    for (const item of items) {
      const id = (item as { id?: unknown })?.id;
      if (typeof id === 'number' && id > 0 && !ids.includes(id)) ids.push(id);
      if (ids.length >= DETAIL_LIMIT) break;
    }
    if (ids.length >= DETAIL_LIMIT) break;
  }
  const out: BigBookInfo[] = [];
  for (const id of ids) {
    const detail = await fetchJson(`https://api.bigbookapi.com/${id}?api-key=${encodeURIComponent(key)}`);
    if (!detail || typeof detail !== 'object') continue;
    const d = detail as Record<string, unknown>;
    const title = typeof d.title === 'string' ? d.title.trim() : '';
    if (!title) continue;
    const authors = Array.isArray(d.authors)
      ? d.authors
          .map((a) => (a as { name?: unknown })?.name)
          .filter((n): n is string => typeof n === 'string' && !!n.trim())
      : [];
    const publishRaw = typeof d.publish_date === 'number' ? d.publish_date : null;
    const year = publishRaw !== null ? Math.floor(publishRaw) : null;
    const identifiers = (d.identifiers ?? {}) as Record<string, unknown>;
    const isbn =
      typeof identifiers.isbn_13 === 'string' && identifiers.isbn_13
        ? identifiers.isbn_13
        : typeof identifiers.isbn_10 === 'string' && identifiers.isbn_10
          ? identifiers.isbn_10
          : null;
    const rating = (d.rating ?? {}) as Record<string, unknown>;
    out.push({
      source: 'bigbook',
      trackId: id,
      title,
      author: authors.join(', '),
      publishYear: year !== null && year >= 1000 && year <= 2100 ? year : null,
      pages: typeof d.number_of_pages === 'number' ? Math.floor(d.number_of_pages) : null,
      isbn,
      description: typeof d.description === 'string' ? d.description : '',
      rating: typeof rating.average === 'number' ? rating.average : null,
    });
  }
  return out;
}
