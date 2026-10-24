import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AppError } from '../utils/errors';

/**
 * Upload ảnh bìa sách.
 * - Lưu vào backend/uploads/covers/<bookId>-<timestamp>.<ext>
 * - Chỉ nhận JPEG/PNG/WebP, tối đa 2MB.
 * - __dirname: src/middleware -> ../../uploads = backend/uploads (tsx watch).
 *   Sau khi build: dist/middleware -> ../../uploads = backend/uploads. Đều đúng.
 */
export const COVERS_DIR = path.join(__dirname, '..', '..', 'uploads', 'covers');
fs.mkdirSync(COVERS_DIR, { recursive: true });

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, COVERS_DIR),
  filename: (req, file, cb) => {
    // Lấy ext từ mimetype (đã validate ở fileFilter) thay vì originalname -> an toàn hơn.
    const ext = EXT_BY_MIME[file.mimetype] ?? '.jpg';
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});

const uploadSingle = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'));
  },
}).single('cover');

/** Middleware bọc lỗi multer thành AppError tiếng Việt (để error handler tập trung xử lý). */
export function uploadCover(req: Request, res: Response, next: NextFunction): void {
  uploadSingle(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'Ảnh bìa không được vượt quá 2MB.'));
      return;
    }
    next(new AppError(400, err instanceof Error ? err.message : 'Tải ảnh lên thất bại.'));
  });
}

/**
 * Upload ảnh đại diện người dùng (bản gọn 23/10/2026).
 * - Lưu vào backend/uploads/avatars/u<userId>-<timestamp>.<ext>
 * - Cùng quy tắc với ảnh bìa: JPEG/PNG/WebP, tối đa 2MB.
 */
export const AVATARS_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');
fs.mkdirSync(AVATARS_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] ?? '.jpg';
    cb(null, `u${req.user?.id ?? 'anon'}-${Date.now()}${ext}`);
  },
});

const uploadAvatarSingle = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'));
  },
}).single('avatar');

/** Middleware bọc lỗi multer thành AppError tiếng Việt (như uploadCover). */
export function uploadAvatar(req: Request, res: Response, next: NextFunction): void {
  uploadAvatarSingle(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'Ảnh đại diện không được vượt quá 2MB.'));
      return;
    }
    next(new AppError(400, err instanceof Error ? err.message : 'Tải ảnh lên thất bại.'));
  });
}
