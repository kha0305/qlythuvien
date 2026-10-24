import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '../entities/User';
import { AppError } from '../utils/errors';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
}

// Gắn req.user cho mọi route cần đăng nhập.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayload {
  sub: number;
  username: string;
  fullName: string;
  role: UserRole;
}

// NFR05: mọi API ghi yêu cầu đăng nhập; token hết hạn sau 8h (NFR06).
export function auth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError(401, 'Vui lòng đăng nhập để tiếp tục'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as JwtPayload;
    req.user = { id: payload.sub, username: payload.username, fullName: payload.fullName, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'));
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, username: user.username, fullName: user.fullName, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}
