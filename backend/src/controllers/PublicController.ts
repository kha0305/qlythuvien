import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import type { Book } from '../entities/Book';
import { BookService } from '../services/BookService';
import { ReservationRepository } from '../repositories/ReservationRepository';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { pool } from '../db/pool';
import { toPublicBookDto } from '../utils/dto';
import { AiBookSearchService } from '../services/AiBookSearchService';
import { AppError } from '../utils/errors';

// UC16: chặn spam gọi AI — tối đa 10 lần / 60 giây / IP (bộ nhớ tạm, đủ cho 1 instance).
const aiSearchHits = new Map<string, number[]>();
const AI_SEARCH_LIMIT = 10;
const AI_SEARCH_WINDOW_MS = 60_000;

function checkAiSearchRateLimit(ip: string): void {
  const now = Date.now();
  const recent = (aiSearchHits.get(ip) ?? []).filter((t) => now - t < AI_SEARCH_WINDOW_MS);
  if (recent.length >= AI_SEARCH_LIMIT) {
    throw new AppError(429, 'Bạn tìm bằng AI quá nhanh, đợi khoảng 1 phút rồi thử lại nhé.');
  }
  recent.push(now);
  aiSearchHits.set(ip, recent);
}

function parsePaging(query: Request['query']): { page: number; limit: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(query.limit) || 12)); // landing: 12 sách/trang
  return { page, limit };
}

/** API public cho landing page: chỉ đọc, không cần đăng nhập. */
export class PublicController {
  constructor(
    private readonly bookService = new BookService(),
    private readonly reservationRepo = new ReservationRepository(),
    private readonly notificationRepo = new NotificationRepository(),
    private readonly aiSearchService = new AiBookSearchService(),
  ) {}

  /** Gắn cờ hasActiveReservation (giống BookController), tuyệt đối không lộ qrCode. */
  private async withReservationFlag(books: Book[]) {
    return Promise.all(
      books.map(async (book) => ({
        ...toPublicBookDto(book),
        hasActiveReservation: (await this.reservationRepo.findActiveByBook(book.id)) !== null,
      })),
    );
  }

  // GET /api/public/books/grouped — đầu sách gom nhóm (1 thẻ / tựa + tác giả),
  // kèm danh sách từng cuốn vật lý trong nhóm để mượn/đặt trước/quét QR như cũ.
  listGroupedBooks = async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = parsePaging(req.query);
    const { groups, total } = await this.bookService.listGrouped(
      req.query.keyword as string | undefined,
      req.query.category as string | undefined,
      page,
      limit,
    );
    const data = await Promise.all(
      groups.map(async (g) => ({
        title: g.title,
        author: g.author,
        category: g.category,
        publisher: g.publisher,
        publishYear: g.publishYear,
        coverUrl: g.coverUrl,
        totalCopies: g.total,
        availableCopies: g.available,
        representativeId: g.representativeId,
        copies: await this.withReservationFlag(g.copies),
      })),
    );
    res.json({ data, page, limit, total });
  };

  // GET /api/public/books?keyword=&category=&page=&limit=
  listBooks = async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = parsePaging(req.query);
    const { books, total } = await this.bookService.search(
      req.query.keyword as string | undefined,
      req.query.category as string | undefined,
      page,
      limit,
    );
    res.json({ data: await this.withReservationFlag(books), page, limit, total });
  };

  // POST /api/public/books/ai-search — UC16: tìm sách theo mô tả nội dung (AI/fallback).
  aiSearch = async (req: Request, res: Response): Promise<void> => {
    checkAiSearchRateLimit(req.ip ?? 'unknown');
    const description = String(req.body?.description ?? '').trim();
    if (description.length < 3) {
      throw new AppError(400, 'Hãy mô tả nội dung cuốn sách bạn nhớ bằng vài chữ trước nhé.');
    }
    if (description.length > 600) {
      throw new AppError(400, 'Mô tả hơi dài — rút gọn xuống dưới 600 ký tự giúp thư viện nhé.');
    }
    const { mode, results } = await this.aiSearchService.search(description);
    const flagged = await this.withReservationFlag(results.map((r) => r.book));
    res.json({
      data: {
        mode,
        results: flagged.map((dto, i) => ({
          ...dto,
          aiScore: results[i].score,
          aiReason: results[i].reason,
        })),
      },
    });
  };

  // GET /api/public/books/:id — kèm số bản của đầu sách (title + author).
  getBookById = async (req: Request, res: Response): Promise<void> => {
    const book = await this.bookService.findById(Number(req.params.id));
    const dto = (await this.withReservationFlag([book]))[0];
    const copies = await this.bookService.countCopies(book.title, book.author ?? null);
    const copyList = await this.withReservationFlag(await this.bookService.listCopies(book.title, book.author ?? null));
    res.json({ data: { ...dto, totalCopies: copies.total, availableCopies: copies.available, copies: copyList } });
  };

  // GET /api/public/announcements — thông báo chung có cờ hiện ở landing (không cần đăng nhập).
  announcements = async (_req: Request, res: Response): Promise<void> => {
    const items = await this.notificationRepo.listLanding(5);
    res.json({
      data: items.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt,
      })),
    });
  };

  // GET /api/public/categories
  listCategories = async (_req: Request, res: Response): Promise<void> => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT category FROM books
       WHERE category IS NOT NULL AND TRIM(category) <> ''
       ORDER BY category`
    );
    res.json({ data: rows.map((r) => r.category as string) });
  };

  // GET /api/public/stats
  stats = async (_req: Request, res: Response): Promise<void> => {
    const [bookRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total,
              SUM(status = 'available') AS availableCount
       FROM books`
    );
    const [readerRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users WHERE role = 'reader' AND active = 1`
    );
    res.json({
      data: {
        totalBooks: Number(bookRows[0].total),
        availableBooks: Number(bookRows[0].availableCount ?? 0),
        totalReaders: Number(readerRows[0].total),
      },
    });
  };
}
