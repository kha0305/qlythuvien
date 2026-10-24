import { api } from './client';
import { normalizeUser, type User } from './types';

export interface AuthPayload {
  token: string;
  user: User;
}

export interface RegisterInput {
  username: string;
  password: string;
  fullName: string;
  email: string;
  studentCode?: string;
  phone?: string;
}

function toAuthPayload(data: unknown): AuthPayload {
  const r = (data ?? {}) as Record<string, unknown>;
  const token = String(r.token ?? '');
  return { token, user: normalizeUser(r.user) };
}

/** UC01: đăng nhập. */
export async function login(username: string, password: string): Promise<AuthPayload> {
  const { data } = await api.post('/auth/login', { username, password });
  return toAuthPayload(data);
}

/** UC01: độc giả tự đăng ký. Backend trả về user (có thể kèm token). */
export async function register(input: RegisterInput): Promise<unknown> {
  const { data } = await api.post('/auth/register', input);
  return data;
}

/** UC18: yêu cầu gửi link đặt lại mật khẩu về email. */
export async function forgotPassword(email: string): Promise<string> {
  const { data } = await api.post('/auth/forgot-password', { email });
  return String((data as { message?: string })?.message ?? '');
}

/** UC18: đặt mật khẩu mới bằng token trong link email. */
export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const { data } = await api.post('/auth/reset-password', { token, newPassword });
  return String((data as { message?: string })?.message ?? '');
}

/** UC19: xác thực email bằng token trong link email. */
export async function verifyEmail(token: string): Promise<string> {
  const { data } = await api.post('/auth/verify-email', { token });
  return String((data as { message?: string })?.message ?? '');
}
