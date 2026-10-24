import { api } from './client';
import { normalizeCategory, type Category } from './types';

function toList(data: unknown): Category[] {
  const arr = Array.isArray(data) ? data : (data as { data?: unknown })?.data ?? [];
  return (Array.isArray(arr) ? arr : []).map(normalizeCategory);
}

/** Danh sách thể loại (ai đăng nhập cũng đọc được). */
export async function listCategories(): Promise<Category[]> {
  const { data } = await api.get('/categories');
  return toList(data);
}

/** Thêm thể loại (thủ thư/admin). */
export async function createCategory(name: string, code?: string): Promise<Category> {
  const { data } = await api.post('/categories', { name, code });
  const body = (data as { data?: unknown })?.data ?? data;
  return normalizeCategory(body);
}

/** Sửa thể loại (thủ thư/admin). */
export async function updateCategory(id: number, name: string, code?: string): Promise<Category> {
  const { data } = await api.put(`/categories/${id}`, { name, code });
  const body = (data as { data?: unknown })?.data ?? data;
  return normalizeCategory(body);
}

/** Xóa thể loại (chặn khi còn sách dùng). */
export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/categories/${id}`);
}

/** Gợi ý mã thể loại từ tên. */
export async function suggestCategoryCode(name: string): Promise<string> {
  const { data } = await api.get('/categories/suggest-code', { params: { name } });
  const body = (data as { data?: { code?: string } })?.data;
  return body?.code ?? '';
}
