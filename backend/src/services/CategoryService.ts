import { Category, CategoryRepository } from '../repositories/CategoryRepository';
import { AppError } from '../utils/errors';

/** Gợi ý mã thể loại từ tên: lấy chữ cái đầu các từ, tối đa 4 ký tự, viết hoa, bỏ dấu tiếng Việt. */
export function suggestCategoryCode(name: string): string {
  const noDiacritics = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  const initials = noDiacritics
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return initials || 'TL';
}

export class CategoryService {
  constructor(private readonly categoryRepo = new CategoryRepository()) {}

  async list(): Promise<Category[]> {
    return this.categoryRepo.list();
  }

  async create(name: string, code?: string): Promise<Category> {
    const n = name?.trim();
    if (!n) {
      throw new AppError(400, 'Tên thể loại không được để trống');
    }
    if (await this.categoryRepo.findByName(n)) {
      throw new AppError(400, 'Thể loại này đã tồn tại');
    }
    const c = (code?.trim() || suggestCategoryCode(n)).toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(c)) {
      throw new AppError(400, 'Mã thể loại chỉ gồm chữ cái in hoa và số, tối đa 10 ký tự');
    }
    try {
      return await this.categoryRepo.create(n, c);
    } catch {
      throw new AppError(400, 'Mã thể loại đã được dùng');
    }
  }

  async update(id: number, name: string, code?: string): Promise<Category> {
    const existing = await this.categoryRepo.findById(id);
    if (!existing) {
      throw new AppError(404, 'Không tìm thấy thể loại');
    }
    const n = name?.trim();
    if (!n) {
      throw new AppError(400, 'Tên thể loại không được để trống');
    }
    const dup = await this.categoryRepo.findByName(n);
    if (dup && dup.id !== id) {
      throw new AppError(400, 'Tên thể loại đã tồn tại');
    }
    const c = (code?.trim() || suggestCategoryCode(n)).toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(c)) {
      throw new AppError(400, 'Mã thể loại chỉ gồm chữ cái in hoa và số, tối đa 10 ký tự');
    }
    try {
      await this.categoryRepo.update(id, n, c);
    } catch {
      throw new AppError(400, 'Mã thể loại đã được dùng');
    }
    return { id, name: n, code: c };
  }

  async remove(id: number): Promise<void> {
    const existing = await this.categoryRepo.findById(id);
    if (!existing) {
      throw new AppError(404, 'Không tìm thấy thể loại');
    }
    const inUse = await this.categoryRepo.countBooks(existing.name);
    if (inUse > 0) {
      throw new AppError(400, `Không thể xóa: đang có ${inUse} cuốn sách dùng thể loại này`);
    }
    await this.categoryRepo.delete(id);
  }
}
