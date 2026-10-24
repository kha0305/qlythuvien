/**
 * Danh sách "vừa dùng gần đây" lưu ở localStorage của trình duyệt, dùng cho
 * form thêm sách (NXB, thể loại, tác giả, năm XB). Tối đa 5 mục, mới nhất
 * lên đầu, trùng (không phân biệt hoa thường) thì dồn về 1 mục mới nhất.
 * Chỉ cập nhật khi Thêm sách thành công — Sửa sách không tính.
 */
const MAX_RECENT = 5;

function readList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeList(key: string, items: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    // localStorage đầy hoặc bị chặn: bỏ qua, không chặn form.
  }
}

export function loadRecent(key: string): string[] {
  return readList(key);
}

/** Thêm 1 giá trị vào đầu danh sách recent, trả về danh sách mới. */
export function pushRecent(key: string, value: string | null | undefined): string[] {
  const v = (value ?? '').trim();
  if (!v) return readList(key);
  const next = [v, ...readList(key).filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, MAX_RECENT);
  writeList(key, next);
  return next;
}

export function loadRecentNumbers(key: string): number[] {
  return readList(key)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export function pushRecentNumber(key: string, value: number | null | undefined): number[] {
  if (!value || !Number.isInteger(value) || value <= 0) return loadRecentNumbers(key);
  const next = [value, ...loadRecentNumbers(key).filter((n) => n !== value)].slice(0, MAX_RECENT);
  writeList(key, next.map(String));
  return next;
}

export const RECENT_KEYS = {
  publishers: 'recent-publishers',
  categories: 'recent-categories',
  authors: 'recent-authors',
  years: 'recent-years',
} as const;
