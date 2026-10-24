import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors';

/**
 * Upload file Excel để nhập sách (lưu vào RAM, không ghi đĩa).
 * - Chỉ nhận .xlsx, tối đa 5MB.
 */
const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    if (ok) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file Excel (.xlsx).'));
  },
}).single('file');

/** Middleware bọc lỗi multer thành AppError tiếng Việt. */
export function uploadExcel(req: Request, res: Response, next: NextFunction): void {
  uploadSingle(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File Excel không được vượt quá 5MB.'));
      return;
    }
    next(new AppError(400, err instanceof Error ? err.message : 'Tải file lên thất bại.'));
  });
}
