import { NextFunction, Request, Response } from 'express';

// Gói controller async an toàn: lỗi ném ra được chuyển về error handler.
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
