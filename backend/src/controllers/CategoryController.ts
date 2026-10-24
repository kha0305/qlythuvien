import { Request, Response } from 'express';
import { CategoryService, suggestCategoryCode } from '../services/CategoryService';

export class CategoryController {
  constructor(private readonly categoryService = new CategoryService()) {}

  // GET /api/categories — ai đăng nhập cũng đọc được (form sách dùng dropdown).
  list = async (_req: Request, res: Response): Promise<void> => {
    const items = await this.categoryService.list();
    res.json({ data: items });
  };

  // POST /api/categories {name, code?} — thủ thư/admin.
  create = async (req: Request, res: Response): Promise<void> => {
    const { name, code } = req.body as { name?: string; code?: string };
    const item = await this.categoryService.create(name ?? '', code);
    res.status(201).json({ data: item, message: 'Đã thêm thể loại' });
  };

  // PUT /api/categories/:id {name, code?} — thủ thư/admin.
  update = async (req: Request, res: Response): Promise<void> => {
    const { name, code } = req.body as { name?: string; code?: string };
    const item = await this.categoryService.update(Number(req.params.id), name ?? '', code);
    res.json({ data: item, message: 'Đã cập nhật thể loại' });
  };

  // DELETE /api/categories/:id — thủ thư/admin; chặn khi còn sách dùng.
  remove = async (req: Request, res: Response): Promise<void> => {
    await this.categoryService.remove(Number(req.params.id));
    res.json({ message: 'Đã xóa thể loại' });
  };

  // GET /api/categories/suggest-code?name=... — gợi ý mã từ tên.
  suggestCode = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: { code: suggestCategoryCode(String(req.query.name ?? '')) } });
  };
}
