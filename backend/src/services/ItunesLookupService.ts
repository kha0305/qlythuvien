/**
 * Tra cứu thông tin sách từ iTunes Search API (UC02, bản gọn 24/10/2026).
 * - API công khai, không cần key: GET https://itunes.apple.com/search?term=...&media=ebook
 * - Chỉ lấy THÔNG TIN, không lấy bìa: iTunes Search chỉ trả artworkUrl60/100 (ảnh nhỏ
 *   60-100px, không có bản 600px), nên không dùng làm ảnh bìa sách (đã có luồng lấy bìa
 *   riêng bằng Google Books / Open Library). Trường artwork cũng không trả về ở đây.
 * - Trường iTunes trả về (test thật 24/10): trackName, artistName, releaseDate,
 *   genres (mảng, không có primaryGenreName), description, averageUserRating,
 *   userRatingCount, trackViewUrl. KHÔNG có: NXB, số trang, ISBN.
 * - Tìm kiếm của iTunes là khớp từ khóa mờ, không phải khớp tên chính xác:
 *   vd tìm "Dế Mèn phiêu lưu ký" trả về cả sách khác ("Thằng Bờm Phiêu Lưu Ký"...),
 *   và sách Việt như "Mắt biếc" trả về 0 kết quả (kho ebook iTunes chủ yếu sách quốc tế).
 *   Vì vậy endpoint này chỉ TRẢ VỀ danh sách ứng viên để thủ thư CHỌN, không tự gán
 *   kết quả đầu tiên vào sách.
 */

export interface ItunesBookInfo {
  trackId: number;
  title: string;
  author: string;
  /** Năm xuất bản lấy từ releaseDate (vd 2015), null nếu iTunes không trả ngày. */
  publishYear: number | null;
  genres: string[];
  description: string;
  storeUrl: string;
  rating: number | null;
  ratingCount: number | null;
}

const FETCH_TIMEOUT_MS = 8000;

export async function searchItunesBooks(term: string, limit = 10): Promise<ItunesBookInfo[]> {
  const t = term.trim();
  if (!t) return [];
  const capped = Math.min(20, Math.max(1, Math.floor(limit)));
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(t)}&media=ebook&limit=${capped}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { results?: unknown[] };
    if (!Array.isArray(data.results)) return [];
    const out: ItunesBookInfo[] = [];
    for (const r of data.results) {
      const row = r as Record<string, unknown>;
      const title = typeof row.trackName === 'string' ? row.trackName.trim() : '';
      if (!title) continue;
      const releaseRaw = typeof row.releaseDate === 'string' ? row.releaseDate : '';
      const year = /^\d{4}/.test(releaseRaw) ? Number(releaseRaw.slice(0, 4)) : null;
      out.push({
        trackId: typeof row.trackId === 'number' ? row.trackId : 0,
        title,
        author: typeof row.artistName === 'string' ? row.artistName.trim() : '',
        publishYear: year !== null && year >= 1000 && year <= 2100 ? year : null,
        genres: Array.isArray(row.genres) ? row.genres.filter((g): g is string => typeof g === 'string') : [],
        description: typeof row.description === 'string' ? row.description : '',
        storeUrl: typeof row.trackViewUrl === 'string' ? row.trackViewUrl : '',
        rating: typeof row.averageUserRating === 'number' ? row.averageUserRating : null,
        ratingCount: typeof row.userRatingCount === 'number' ? row.userRatingCount : null,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
