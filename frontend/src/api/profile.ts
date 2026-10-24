import { api } from './client';
import { unwrapData } from './types';
import type { User } from './types';

export interface UpdateProfileInput {
  fullName: string;
  phone?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** GET /api/profile — thông tin của chính mình. */
export async function getProfile(): Promise<User> {
  const res = await api.get('/profile');
  return unwrapData<User>(res.data);
}

/** PUT /api/profile — chỉ đổi được họ tên và SĐT (MSSV/role server tự chặn). */
export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const res = await api.put('/profile', input);
  return unwrapData<User>(res.data);
}

/** PUT /api/profile/password — đổi mật khẩu, cần nhập đúng mật khẩu hiện tại. */
export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await api.put('/profile/password', input);
}

/** PUT /api/profile/email — UC19: đổi email (đưa về chưa xác thực + gửi link xác thực mới). */
export async function changeEmail(email: string): Promise<User> {
  const res = await api.put('/profile/email', { email });
  return unwrapData<User>(res.data);
}

/** POST /api/profile/resend-verification — UC19: gửi lại email xác thực. */
export async function resendVerification(): Promise<void> {
  await api.post('/profile/resend-verification');
}

/** POST /api/profile/avatar (multipart field "avatar") — tải ảnh đại diện mới (JPEG/PNG/WebP, tối đa 2MB). */
export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append('avatar', file);
  const res = await api.post('/profile/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrapData<User>(res.data);
}

/** DELETE /api/profile/avatar — gỡ ảnh đại diện, quay về chữ cái đầu tên. */
export async function deleteAvatar(): Promise<User> {
  const res = await api.delete('/profile/avatar');
  return unwrapData<User>(res.data);
}
