// Policy mật khẩu: tối thiểu 8 ký tự, 1 chữ hoa, 1 chữ thường,
// 1 số hoặc ký tự đặc biệt. Trả về các điều kiện còn thiếu (tiếng Việt);
// mảng rỗng = đạt yêu cầu. Dùng cho ĐĂNG KÝ (UC01) và đổi mật khẩu.
export function passwordPolicyViolations(password: string): string[] {
  const missing: string[] = [];
  if (password.length < 8) {
    missing.push('ít nhất 8 ký tự');
  }
  if (!/[A-ZÀ-Ỹ]/.test(password)) {
    missing.push('1 chữ hoa');
  }
  if (!/[a-zà-ỹ]/.test(password)) {
    missing.push('1 chữ thường');
  }
  if (!/[0-9]/.test(password) && !/[^A-Za-zÀ-ỹà-ỹ0-9]/.test(password)) {
    missing.push('1 chữ số hoặc ký tự đặc biệt');
  }
  return missing;
}
