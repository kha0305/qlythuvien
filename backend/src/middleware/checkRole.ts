import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../entities/User';
import { AppError } from '../utils/errors';

// NFR05: API của thủ thư/admin kiểm tra role ở middleware, trả 403 khi sai vai trò.
export function checkRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, 'Bạn không có quyền thực hiện thao tác này'));
      return;
    }
    next();
  };
}
