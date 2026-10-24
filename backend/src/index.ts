import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { autoImportIfNeeded } from './db/autoImport';
import { ensureAvatarSchema, ensureEmailSchema } from './db/ensureEmailSchema';
import { ReminderService } from './services/ReminderService';
import { AppError } from './utils/errors';
import accountsRouter from './routes/accounts';
import authRouter from './routes/auth';
import booksRouter from './routes/books';
import loansRouter from './routes/loans';
import profileRouter from './routes/profile';
import readersRouter from './routes/readers';
import reservationsRouter from './routes/reservations';
import notificationsRouter from './routes/notifications';
import categoriesRouter from './routes/categories';
import settingsRouter from './routes/settings';
import statsRouter from './routes/stats';

import publicRouter from './routes/public';

const app = express();

app.use(cors());
app.use(express.json());

// Ảnh bìa upload: phục vụ trực tiếp từ backend/uploads.
// __dirname = src (tsx watch) hoặc dist (node dist) -> '..' đều là backend/uploads.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/readers', readersRouter);
app.use('/api/loans', loansRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/public', publicRouter);

// 404 cho route /api không tồn tại.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ message: 'Không tìm thấy API' });
});

// Bản deploy (host): phục vụ luôn frontend đã build trong thư mục public/
// (nằm cạnh backend: ../public tính từ src hoặc dist đều đúng).
// Local dev không có thư mục này -> bỏ qua, frontend chạy riêng bằng Vite.
const publicDir = path.join(__dirname, '..', 'public');
const publicIndex = path.join(publicDir, 'index.html');
if (fs.existsSync(publicIndex)) {
  app.use(express.static(publicDir));
  // SPA fallback: route giao diện (không phải /api, /uploads) -> trả index.html.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(publicIndex);
      return;
    }
    next();
  });
}

// Error handler tập trung: AppError -> message tiếng Việt + status; lỗi lạ -> 500.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  console.error('Lỗi không mong đợi:', err);
  res.status(500).json({ message: 'Lỗi máy chủ nội bộ, vui lòng thử lại sau' });
});

async function start(): Promise<void> {
  await autoImportIfNeeded();
  await ensureEmailSchema();
  await ensureAvatarSchema();
  app.listen(config.port, () => {
    console.log(`Library Mini API đang chạy tại cổng ${config.port}`);
    console.log(
      config.mail.resendApiKey
        ? '[email] Nhắc hạn / quên mật khẩu / xác thực: BẬT (Resend)'
        : '[email] Chưa có RESEND_API_KEY — tính năng email đang TẮT',
    );
  });
  startReminderScheduler();
}

// UC17: vòng quét nhắc hạn qua email — chạy sau khi khởi động 45 giây, sau đó mỗi 6 giờ.
// Lỗi trong vòng quét không được làm sập server.
function startReminderScheduler(): void {
  const reminderService = new ReminderService();
  const run = () => {
    void reminderService.runOnce().catch((err) => {
      console.error('[email] Vòng quét nhắc hạn lỗi:', err instanceof Error ? err.message : err);
    });
  };
  const first = setTimeout(run, 45000);
  first.unref();
  const timer = setInterval(run, 6 * 3600 * 1000);
  timer.unref();
}

void start();
