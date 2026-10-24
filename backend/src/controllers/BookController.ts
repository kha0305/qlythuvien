import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import type { Book } from '../entities/Book';
import { ReservationRepository } from '../repositories/ReservationRepository';
import { BookService } from '../services/BookService';
import { searchBigBookBooks } from '../services/BigBookLookupService';
import { searchItunesBooks } from '../services/ItunesLookupService';
import { toBookDto } from '../utils/dto';
import { AppError } from '../utils/errors';

function parsePaging(query: Request['query']): { page: number; limit: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? query.pageSize) || 20)); // NFR02: 20 dòng/trang
  return { page, limit };
}

export class BookController {
  constructor(
    private readonly bookService = new BookService(),
    private readonly reservationRepo = new ReservationRepository(),
  ) {}

  /** Gắn cờ hasActiveReservation: true nếu cuốn sách có đặt trước đang hiệu lực. */
  private async withReservationFlag(books: Book[]) {
    return Promise.all(
      books.map(async (book) => ({
        ...toBookDto(book),
        hasActiveReservation: (await this.reservationRepo.findActiveByBook(book.id)) !== null,
      })),
    );
  }

  // GET /api/books — đăng nhập là đọc được (reader dùng để tra cứu / đặt trước, UC11).
  // Filter nâng cao: status (available/borrowed/reserved), publisher, year.
  list = async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = parsePaging(req.query);
    const statusRaw = req.query.status as string | undefined;
    const status = statusRaw === 'available' || statusRaw === 'borrowed' || statusRaw === 'reserved' ? statusRaw : undefined;
    const yearRaw = Number(req.query.year);
    const { books, total } = await this.bookService.search(
      req.query.keyword as string | undefined,
      req.query.category as string | undefined,
      page,
      limit,
      req.query.sort as string | undefined,
      {
        status,
        publisher: (req.query.publisher as string | undefined)?.trim() || undefined,
        year: Number.isInteger(yearRaw) && yearRaw > 0 ? yearRaw : undefined,
      },
    );
    res.json({ data: await this.withReservationFlag(books), page, limit, total });
  };

  // GET /api/books/publishers — danh sách NXB cho dropdown lọc.
  publishers = async (_req: Request, res: Response): Promise<void> => {
    const items = await this.bookService.listPublishers();
    res.json({ data: items });
  };

  // GET /api/books/lookup?term=... — tra cứu thông tin sách.
  // Nguồn chính: Big Book API (cần BIGBOOK_API_KEY trong .env). Nếu Big Book không có
  // key, hết quota (402) hoặc không trả kết quả nào thì fallback sang iTunes Search
  // (không cần key). Chỉ trả về ứng viên để thủ thư chọn, không tự tạo sách.
  // Hình dạng kết quả thống nhất cho cả 2 nguồn (trường nào nguồn đó không có thì null/rỗng).
  lookupBooks = async (req: Request, res: Response): Promise<void> => {
    const term = String(req.query.term ?? '').trim();
    if (!term) {
      throw new AppError(400, 'Nhập từ khóa để tra cứu.');
    }
    const limit = Number(req.query.limit) || 10;
    const big = await searchBigBookBooks(term, limit);
    if (big.length > 0) {
      res.json({
        data: big.map((b) => ({
          ...b, genres: [] as string[], storeUrl: '', ratingCount: null,
        })),
      });
      return;
    }
    const itunes = await searchItunesBooks(term, limit);
    res.json({
      data: itunes.map((b) => ({
        ...b, source: 'itunes' as const, pages: null, isbn: null,
      })),
    });
  };

  // GET /api/books/qr/:qrCode
  getByQr = async (req: Request, res: Response): Promise<void> => {
    const book = await this.bookService.findByQrCode(req.params.qrCode as string);
    res.json({ data: (await this.withReservationFlag([book]))[0] });
  };

  // GET /api/books/:id
  getById = async (req: Request, res: Response): Promise<void> => {
    const book = await this.bookService.findById(Number(req.params.id));
    res.json({ data: (await this.withReservationFlag([book]))[0] });
  };

  // POST /api/books {title, ..., quantity?} — tạo N bản copy cùng lúc, mỗi bản 1 mã riêng.
  create = async (req: Request, res: Response): Promise<void> => {
    const { quantity, title, author, category, publisher, publishYear } = req.body as {
      quantity?: unknown; title?: string; author?: string; category?: string; publisher?: string; publishYear?: number;
    };
    const books = await this.bookService.createBook(
      { title: title ?? '', author, category, publisher, publishYear },
      Number(quantity) || 1,
    );
    const data = books.map(toBookDto);
    res.status(201).json({
      data,
      message: books.length > 1 ? `Đã thêm ${books.length} bản sách` : 'Đã thêm sách',
    });
  };

  // POST /api/books/sync-codes — sinh book_code cho sách cũ đang NULL.
  syncCodes = async (_req: Request, res: Response): Promise<void> => {
    const count = await this.bookService.syncBookCodes();
    res.json({ data: { count }, message: `Đã đồng bộ mã cho ${count} cuốn sách` });
  };

  // POST /api/books/import — nhập sách từ file Excel (multipart field "file").
  importExcel = async (req: Request, res: Response): Promise<void> => {
    if (!req.file?.buffer) {
      throw new AppError(400, 'Vui lòng chọn file Excel (.xlsx).');
    }
    const { created, errors } = await this.bookService.importFromExcel(req.file.buffer);
    res.json({
      data: { created, errors },
      message: `Đã tạo ${created} cuốn sách${errors.length > 0 ? `, ${errors.length} dòng lỗi` : ''}`,
    });
  };

  // GET /api/books/import/template — tải file Excel mẫu để nhập.
  importTemplate = async (_req: Request, res: Response): Promise<void> => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sach');
    ws.columns = [
      { header: 'Tiêu đề *', key: 'title', width: 36 },
      { header: 'Tác giả', key: 'author', width: 24 },
      { header: 'Thể loại', key: 'category', width: 22 },
      { header: 'NXB', key: 'publisher', width: 22 },
      { header: 'Năm XB', key: 'year', width: 12 },
      { header: 'Số lượng', key: 'qty', width: 12 },
    ];
    ws.addRow(['Dế Mèn phiêu lưu ký', 'Tô Hoài', 'Văn học', 'Kim Đồng', 2020, 2]);
    ws.addRow(['Nhập môn lập trình Python', 'Trần Đan Thư', 'Công nghệ thông tin', 'Khoa học Kỹ thuật', 2023, 1]);
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-sach.xlsx"');
    res.send(Buffer.from(buffer));
  };

  // PUT /api/books/:id
  update = async (req: Request, res: Response): Promise<void> => {
    const book = await this.bookService.updateBook(Number(req.params.id), req.body);
    res.json({ data: toBookDto(book) });
  };

  // DELETE /api/books/:id
  remove = async (req: Request, res: Response): Promise<void> => {
    await this.bookService.deleteBook(Number(req.params.id));
    res.json({ message: 'Đã xóa sách' });
  };

  // POST /api/books/:id/cover — upload ảnh bìa (multipart field "cover").
  uploadCover = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError(400, 'Vui lòng chọn file ảnh.');
    }
    const book = await this.bookService.uploadCover(Number(req.params.id), req.file.filename);
    res.json({ data: toBookDto(book), message: 'Đã cập nhật ảnh bìa' });
  };

  // POST /api/books/:id/fetch-cover — lấy bìa tự động cho 1 cuốn (Google Books -> Open Library).
  // Không tìm thấy vẫn trả 200 kèm coverFound=false để frontend hiện thông báo, không coi là lỗi.
  fetchCover = async (req: Request, res: Response): Promise<void> => {
    const r = await this.bookService.fetchCover(Number(req.params.id));
    res.json({
      data: toBookDto(r.book),
      coverFound: r.status === 'ok',
      source: r.source,
      message: r.message,
    });
  };

  // POST /api/books/fetch-covers-missing?limit=10 — lấy bìa cho sách chưa có ảnh, theo đợt.
  fetchCoversMissing = async (req: Request, res: Response): Promise<void> => {
    const limit = Number(req.query.limit) || 10;
    const r = await this.bookService.fetchCoversForMissing(limit);
    const okCount = r.results.filter((x) => x.status === 'ok').length;
    res.json({
      data: r,
      message: `Đã xử lý ${r.results.length} cuốn: ${okCount} cuốn lấy được bìa, còn ${r.remaining} cuốn chưa có bìa.`,
    });
  };
}
