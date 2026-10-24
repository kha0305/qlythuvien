import { Request, Response } from 'express';
import { UserRole } from '../entities/User';
import { UserService } from '../services/UserService';
import { toPublicUserDto } from '../utils/dto';

const MANAGEABLE_ROLES: UserRole[] = ['librarian'];

export class AccountController {
  constructor(private readonly userService = new UserService()) {}

  // GET /api/accounts?role=librarian&sort=
  list = async (req: Request, res: Response): Promise<void> => {
    const role = req.query.role as string | undefined;
    if (role && !MANAGEABLE_ROLES.includes(role as UserRole)) {
      res.status(400).json({ message: 'Vai trò không hợp lệ' });
      return;
    }
    const users = await this.userService.listAccounts(
      role as UserRole | undefined,
      req.query.sort as string | undefined,
    );
    res.json({ data: users.map(toPublicUserDto) });
  };

  // POST /api/accounts {fullName, username, password} — tạo thủ thư.
  create = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userService.createLibrarian(req.body);
    res.status(201).json({ data: toPublicUserDto(user) });
  };

  // PUT /api/accounts/:id/active {active: 0|1} — không tự khóa mình.
  setActive = async (req: Request, res: Response): Promise<void> => {
    const { active } = req.body as { active?: number | boolean };
    const user = await this.userService.setAccountActive(
      Number(req.params.id),
      active === 1 || active === true,
      req.user!.id,
    );
    res.json({ data: toPublicUserDto(user) });
  };

  // DELETE /api/accounts/:id — không tự xóa, không xóa admin cuối (D9).
  remove = async (req: Request, res: Response): Promise<void> => {
    await this.userService.deleteAccount(Number(req.params.id), req.user!.id);
    res.json({ message: 'Đã xóa tài khoản' });
  };
}
