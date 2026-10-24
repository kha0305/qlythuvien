import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { toPublicUserDto } from '../utils/dto';

export class ReaderController {
  constructor(private readonly userService = new UserService()) {}

  // GET /api/readers?keyword=&sort=
  list = async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? req.query.pageSize) || 20));
    const { users, total } = await this.userService.listReaders(
      req.query.keyword as string | undefined,
      page,
      limit,
      req.query.sort as string | undefined,
    );
    res.json({ data: users.map(toPublicUserDto), page, limit, total });
  };

  // POST /api/readers — mật khẩu mặc định 123456 (D8).
  create = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userService.createReader(req.body);
    res.status(201).json({ data: toPublicUserDto(user) });
  };

  // PUT /api/readers/:id — không đổi username.
  update = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userService.updateReader(Number(req.params.id), req.body);
    res.json({ data: toPublicUserDto(user) });
  };

  // DELETE /api/readers/:id — từ chối nếu còn phiếu borrowing (D9).
  remove = async (req: Request, res: Response): Promise<void> => {
    await this.userService.deleteReader(Number(req.params.id));
    res.json({ message: 'Đã xóa độc giả' });
  };
}
