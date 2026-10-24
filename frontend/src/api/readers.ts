import { api } from './client';
import { normalizeUser, normalizePage, unwrapData, type User, type PageResult } from './types';

export interface ReaderInput {
  fullName: string;
  username?: string;
  studentCode?: string;
  phone?: string;
}

/** UC03: liệt kê/tìm kiếm độc giả (lọc theo tên hoặc mã SV ở client nếu backend không hỗ trợ). */
export async function listReaders(keyword?: string, sort?: string, pageSize?: number): Promise<PageResult<User>> {
  const params: Record<string, string | number> = {};
  if (keyword) params.keyword = keyword;
  if (sort) params.sort = sort;
  if (pageSize) params.pageSize = pageSize;
  const { data } = await api.get('/readers', { params });
  if (Array.isArray(data)) {
    const users = data.map(normalizeUser);
    const kw = keyword?.trim().toLowerCase() ?? '';
    const filtered = kw
      ? users.filter(
          (u) =>
            u.fullName.toLowerCase().includes(kw) ||
            (u.studentCode ?? '').toLowerCase().includes(kw) ||
            u.username.toLowerCase().includes(kw)
        )
      : users;
    return { data: filtered, total: filtered.length };
  }
  return normalizePage(data, normalizeUser);
}

/** UC03: thêm độc giả, mật khẩu mặc định 123456 do backend gán. */
export async function createReader(input: ReaderInput): Promise<User> {
  const { data } = await api.post('/readers', input);
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeUser(body.user ?? body.reader ?? body);
}

/** UC03: sửa độc giả (họ tên, mã SV, SĐT; không đổi username). */
export async function updateReader(id: number, input: Omit<ReaderInput, 'username'>): Promise<User> {
  const { data } = await api.put(`/readers/${id}`, input);
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeUser(body.user ?? body.reader ?? body);
}

/** UC03: xóa độc giả (chỉ khi không còn phiếu borrowing). */
export async function deleteReader(id: number): Promise<void> {
  await api.delete(`/readers/${id}`);
}
