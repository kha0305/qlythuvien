import { api } from './client';
import { normalizeUser, unwrapData, type User } from './types';

export interface LibrarianInput {
  fullName: string;
  username: string;
  password: string;
}

/** UC10: danh sách tài khoản (mặc định lọc thủ thư). */
export async function listAccounts(role = 'librarian', sort?: string): Promise<User[]> {
  const { data } = await api.get('/accounts', { params: { role, ...(sort ? { sort } : {}) } });
  const arr = Array.isArray(data) ? data : (data?.data ?? []);
  return (Array.isArray(arr) ? arr : []).map(normalizeUser);
}

/** UC10: tạo tài khoản thủ thư. */
export async function createAccount(input: LibrarianInput): Promise<User> {
  const { data } = await api.post('/accounts', { ...input, role: 'librarian' });
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeUser(body.user ?? body.account ?? body);
}

/** UC10: khóa/mở khóa tài khoản. */
export async function setAccountActive(id: number, active: boolean): Promise<User> {
  const { data } = await api.put(`/accounts/${id}/active`, { active: active ? 1 : 0 });
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeUser(body.user ?? body.account ?? body);
}

/** UC10: xóa tài khoản (không được tự xóa chính mình / xóa admin cuối cùng). */
export async function deleteAccount(id: number): Promise<void> {
  await api.delete(`/accounts/${id}`);
}
