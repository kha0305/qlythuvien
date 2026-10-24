/**
 * Giải mã tham số `sort` từ client thành mệnh đề ORDER BY.
 * Chỉ chấp nhận giá trị nằm trong whitelist (khóa của `allowed`) -> chống SQL injection
 * vì không bao giờ nối trực tiếp chuỗi từ client vào câu query.
 * Giá trị thiếu / không hợp lệ -> dùng `fallback` (thứ tự cũ, không đổi hành vi).
 */
export function resolveOrderBy(
  sort: unknown,
  allowed: Record<string, string>,
  fallback: string,
): string {
  if (typeof sort === 'string' && Object.prototype.hasOwnProperty.call(allowed, sort)) {
    return allowed[sort];
  }
  return fallback;
}
