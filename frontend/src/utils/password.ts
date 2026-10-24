// Policy mật khẩu áp dụng cho ĐĂNG KÝ (UC01):
// tối thiểu 8 ký tự, 1 chữ hoa, 1 chữ thường, 1 số hoặc ký tự đặc biệt.
// Trả về danh sách điều kiện còn thiếu (tiếng Việt); rỗng = đạt yêu cầu.
export function validatePasswordPolicy(password: string): string[] {
  const missing: string[] = [];
  if (password.length < 8) {
    missing.push('Mật khẩu phải có ít nhất 8 ký tự.');
  }
  if (!/[A-ZÀ-Ỹ]/.test(password)) {
    missing.push('Mật khẩu phải có ít nhất 1 chữ hoa.');
  }
  if (!/[a-zà-ỹ]/.test(password)) {
    missing.push('Mật khẩu phải có ít nhất 1 chữ thường.');
  }
  if (!/[0-9]/.test(password) && !/[^A-Za-zÀ-ỹà-ỹ0-9]/.test(password)) {
    missing.push('Mật khẩu phải có ít nhất 1 chữ số hoặc ký tự đặc biệt.');
  }
  return missing;
}
