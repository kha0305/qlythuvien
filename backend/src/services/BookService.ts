import { promises as fs } from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { Book } from '../entities/Book';
import { BookRepository } from '../repositories/BookRepository';
import { CategoryRepository } from '../repositories/CategoryRepository';
import { AppError } from '../utils/errors';
import { findCoverCandidates } from './CoverFetchService';

/** Thư mục gốc chứa uploads (backend/uploads). __dirname: src/services hoặc dist/services. */
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

export interface CreateBookInput {
  title: string;
  author?: string;
  category?: string;
  publisher?: string;
  publishYear?: number;
}

/** Mã thể loại dự phòng khi bảng categories chưa có (đồng bộ với migration). */
const FALLBACK_CATEGORY_CODES: Record<string, string> = {
  'Văn học': 'VH',
  'Tiểu thuyết': 'TT',
  'Truyện ngắn': 'TRN',
  'Thơ ca': 'THO',
  'Lịch sử': 'LS',
  'Khoa học': 'KHO',
  'Công nghệ thông tin': 'CNTT',
  'Kinh tế': 'KT',
  'Tâm lý học': 'TLH',
  'Triết học': 'TRI',
  'Thiếu nhi': 'TNH',
  'Ngoại ngữ': 'NN',
};

export interface UpdateBookInput {
  title?: string;
  author?: string | null;
  category?: string | null;
  publisher?: string | null;
  publishYear?: number | null;
}

export interface ImportRowError {
  row: number;
  reason: string;
}

/** Giới hạn ảnh bìa tải về: cùng quy tắc với upload tay (JPEG/PNG/WebP, tối đa 2MB). */
const COVER_DOWNLOAD_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Tải 1 ảnh bìa từ URL ngoài về bộ nhớ (chưa ghi file).
 * Trả về null nếu URL không phải ảnh, sai định dạng, hoặc vượt 2MB — để caller thử ứng viên sau.
 */
async function downloadCoverImage(url: string): Promise<{ data: Buffer; ext: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null;
    const mime = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = COVER_DOWNLOAD_EXT_BY_MIME[mime];
    if (!ext) return null; // vd trang lỗi HTML của Open Library khi cover không tồn tại
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0 || buf.length > 2 * 1024 * 1024) return null;
    return { data: buf, ext };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class BookService {
  constructor(
    private readonly bookRepo = new BookRepository(),
    private readonly categoryRepo = new CategoryRepository(),
  ) {}

  /** Mã thể loại của 1 tên thể loại: ưu tiên bảng categories, rồi map cứng, cuối cùng 'SACH'. */
  private async resolveCategoryCode(categoryName: string | null): Promise<string> {
    if (categoryName) {
      const cat = await this.categoryRepo.findByName(categoryName);
      if (cat) return cat.code;
      const fallback = FALLBACK_CATEGORY_CODES[categoryName];
      if (fallback) return fallback;
    }
    return 'SACH';
  }

  /**
   * Sinh book_code = <CAT_CODE>-<seq 4 chữ số>, vd VH-0001.
   * seq = số lớn nhất hiện có của thể loại + 1; trùng thì tăng tiếp cho đến khi unique.
   */
  async generateBookCode(categoryName: string | null): Promise<string> {
    const catCode = await this.resolveCategoryCode(categoryName);
    let seq = (await this.bookRepo.maxCodeSeq(catCode)) + 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const code = `${catCode}-${String(seq).padStart(4, '0')}`;
      if (!(await this.bookRepo.bookCodeExists(code))) return code;
      seq += 1;
    }
  }

  // UC02: thêm sách. quantity: số bản copy cùng lúc (mặc định 1, tối đa 50).
  // Sách mới: qr_code = book_code (dễ đọc, dễ quét); giữ nguyên D2 (mỗi bản 1 id/QR).
  async createBook(input: CreateBookInput, quantity = 1): Promise<Book[]> {
    const title = input.title?.trim();
    if (!title) {
      throw new AppError(400, 'Tiêu đề không được để trống');
    }
    const qty = Math.min(50, Math.max(1, Math.floor(Number(quantity) || 1)));
    const category = input.category?.trim() || null;
    const created: Book[] = [];
    for (let i = 0; i < qty; i += 1) {
      const bookCode = await this.generateBookCode(category);
      const book = new Book({
        id: 0,
        qrCode: bookCode, // sách mới: qr = mã hiển thị
        bookCode,
        title,
        author: input.author?.trim() || null,
        category,
        publisher: input.publisher?.trim() || null,
        publishYear: input.publishYear ?? null,
        status: 'available',
      });
      created.push(await this.bookRepo.save(book));
    }
    return created;
  }

  async updateBook(id: number, input: UpdateBookInput): Promise<Book> {
    const book = await this.bookRepo.findById(id);
    if (!book) {
      throw new AppError(404, 'Không tìm thấy sách');
    }
    if (input.title !== undefined && !input.title.trim()) {
      throw new AppError(400, 'Tiêu đề không được để trống');
    }
    // NFR07: không cho đổi qr_code / book_code / status qua API sửa.
    await this.bookRepo.update(id, {
      title: input.title?.trim(),
      author: input.author,
      category: input.category,
      publisher: input.publisher,
      publishYear: input.publishYear,
    });
    const updated = await this.bookRepo.findById(id);
    if (!updated) {
      throw new AppError(404, 'Không tìm thấy sách');
    }
    return updated;
  }

  // UC02 + D9: chỉ xóa khi sách đang available.
  async deleteBook(id: number): Promise<void> {
    const book = await this.bookRepo.findById(id);
    if (!book) {
      throw new AppError(404, 'Không tìm thấy sách');
    }
    if (!book.isAvailable()) {
      throw new AppError(400, 'Không thể xóa sách đang được mượn');
    }
    await this.bookRepo.delete(id);
  }

  async findById(id: number): Promise<Book> {
    const book = await this.bookRepo.findById(id);
    if (!book) {
      throw new AppError(404, 'Không tìm thấy sách');
    }
    return book;
  }

  /** Tìm sách theo qr_code trước, không có thì thử book_code (vd VH-0001). */
  async findByQrCode(qrCode: string): Promise<Book> {
    const book = await this.bookRepo.findByQrCodeOrBookCode(qrCode);
    if (!book) {
      throw new AppError(404, 'Không tìm thấy sách');
    }
    return book;
  }

  async search(
    keyword: string | undefined,
    category: string | undefined,
    page: number,
    limit: number,
    sort?: string,
    filters?: { status?: 'available' | 'borrowed' | 'reserved'; publisher?: string; year?: number },
  ) {
    return this.bookRepo.search(keyword?.trim() || undefined, category?.trim() || undefined, page, limit, sort, filters);
  }

  async listPublishers(): Promise<string[]> {
    return this.bookRepo.listPublishers();
  }

  /** Số bản của 1 đầu sách (title + author). */
  async countCopies(title: string, author: string | null) {
    return this.bookRepo.countCopies(title, author);
  }

  /**
   * Gán ảnh bìa mới cho sách (đã được multer lưu vào uploads/covers).
   * Xóa file ảnh cũ của sách đó nếu có. Trả về đường dẫn tương đối /uploads/covers/...
   */
  async uploadCover(id: number, filename: string): Promise<Book> {
    const book = await this.bookRepo.findById(id);
    if (!book) {
      throw new AppError(404, 'Không tìm thấy sách');
    }
    if (book.coverUrl) {
      // basename() để chặn path traversal: chỉ xóa file nằm trong uploads/covers.
      const oldPath = path.join(UPLOADS_DIR, 'covers', path.basename(book.coverUrl));
      await fs.unlink(oldPath).catch(() => {});
    }
    const coverUrl = `/uploads/covers/${filename}`;
    await this.bookRepo.updateCoverUrl(id, coverUrl);
    book.coverUrl = coverUrl;
    return book;
  }

  /** Kết quả lấy bìa tự động cho 1 cuốn (dùng chung cho nút 1 cuốn và batch). */
  async fetchCover(
    id: number,
  ): Promise<{ book: Book; status: 'ok' | 'not_found' | 'error'; source: 'google' | 'openlibrary' | null; message: string }> {
    const book = await this.bookRepo.findById(id);
    if (!book) {
      throw new AppError(404, 'Không tìm thấy sách');
    }
    const candidates = await findCoverCandidates(book.title, book.author);
    if (candidates.length === 0) {
      return { book, status: 'not_found', source: null, message: 'Không tìm thấy ảnh bìa trên Google Books / Open Library.' };
    }
    // Thử tải từng ứng viên theo thứ tự ưu tiên; ứng viên đầu hỏng thì thử ứng viên sau.
    let lastError = '';
    for (const candidate of candidates) {
      try {
        const buffer = await downloadCoverImage(candidate.url);
        if (!buffer) continue;
        const filename = `${book.id}-${Date.now()}${buffer.ext}`;
        const coversDir = path.join(UPLOADS_DIR, 'covers');
        await fs.mkdir(coversDir, { recursive: true });
        await fs.writeFile(path.join(coversDir, filename), buffer.data);
        // uploadCover() xóa ảnh cũ + cập nhật DB (dùng chung luồng với upload tay).
        const updated = await this.uploadCover(id, filename);
        return {
          book: updated,
          status: 'ok',
          source: candidate.source,
          message: `Đã lấy ảnh bìa từ ${candidate.source === 'google' ? 'Google Books' : 'Open Library'}.`,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Lỗi tải ảnh';
      }
    }
    return { book, status: 'error', source: null, message: `Tìm thấy ứng viên bìa nhưng tải ảnh thất bại: ${lastError}` };
  }

  /**
   * Lấy bìa tự động cho sách chưa có ảnh, theo từng đợt có giới hạn.
   * limit mặc định 10, tối đa 20: 1 đợt batch gọi API ngoài cho từng cuốn, nếu để
   * limit lớn (vd 100) thì request sẽ quá timeout 15s của frontend và dễ bị 429.
   * Lỗi 1 cuốn không dừng cả đợt; trả về báo cáo từng cuốn + số cuốn còn thiếu bìa.
   */
  async fetchCoversForMissing(limit = 10): Promise<{
    results: { bookId: number; title: string; status: 'ok' | 'not_found' | 'error'; source: 'google' | 'openlibrary' | null; message: string }[];
    remaining: number;
  }> {
    const capped = Math.min(20, Math.max(1, Math.floor(Number(limit) || 10)));
    const pending = await this.bookRepo.findWithoutCover(capped);
    const results: { bookId: number; title: string; status: 'ok' | 'not_found' | 'error'; source: 'google' | 'openlibrary' | null; message: string }[] = [];
    for (const book of pending) {
      try {
        const r = await this.fetchCover(book.id);
        results.push({ bookId: book.id, title: book.title, status: r.status, source: r.source, message: r.message });
      } catch (err) {
        results.push({
          bookId: book.id,
          title: book.title,
          status: 'error',
          source: null,
          message: err instanceof Error ? err.message : 'Lỗi không xác định',
        });
      }
    }
    const remaining = await this.bookRepo.countWithoutCover();
    return { results, remaining };
  }

  /**
   * Đồng bộ mã sách: sinh book_code cho mỗi sách đang NULL (theo thứ tự id trong từng thể loại).
   * Dùng cho sách seed cũ đã import chưa có mã. Trả về số sách đã gắn mã.
   * Sách cũ GIỮ NGUYÊN qr_code hex; chỉ gắn thêm book_code hiển thị.
   */
  async syncBookCodes(): Promise<number> {
    const { books } = await this.bookRepo.search(undefined, undefined, 1, 100000, '', undefined);
    const pending = books.filter((b) => !b.bookCode).sort((a, b) => a.id - b.id);
    let count = 0;
    for (const book of pending) {
      const code = await this.generateBookCode(book.category);
      await this.bookRepo.updateBookCode(book.id, code);
      count += 1;
    }
    return count;
  }

  /**
   * Nhập sách từ file Excel (.xlsx).
   * Cột: Tiêu đề* | Tác giả | Thể loại | NXB | Năm XB | Số lượng (mặc định 1).
   * Trả về: số cuốn tạo thành công + danh sách dòng lỗi.
   */
  async importFromExcel(buffer: Buffer): Promise<{ created: number; errors: ImportRowError[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new AppError(400, 'File Excel không có sheet nào.');
    }
    let created = 0;
    const errors: ImportRowError[] = [];
    // Bỏ qua dòng 1 (header), bắt đầu từ dòng 2.
    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const title = String(row.getCell(1).value ?? '').trim();
      const author = String(row.getCell(2).value ?? '').trim();
      const category = String(row.getCell(3).value ?? '').trim();
      const publisher = String(row.getCell(4).value ?? '').trim();
      const yearRaw = row.getCell(5).value;
      const qtyRaw = row.getCell(6).value;
      // Bỏ qua dòng trống hoàn toàn.
      if (!title && !author && !category && !publisher && yearRaw == null && qtyRaw == null) {
        continue;
      }
      if (!title) {
        errors.push({ row: r, reason: 'Thiếu tiêu đề' });
        continue;
      }
      let publishYear: number | undefined;
      if (yearRaw !== null && yearRaw !== undefined && String(yearRaw).trim() !== '') {
        const y = Number(yearRaw);
        if (!Number.isInteger(y) || y < 1000 || y > 2100) {
          errors.push({ row: r, reason: `Năm xuất bản không hợp lệ: ${yearRaw}` });
          continue;
        }
        publishYear = y;
      }
      let quantity = 1;
      if (qtyRaw !== null && qtyRaw !== undefined && String(qtyRaw).trim() !== '') {
        const q = Number(qtyRaw);
        if (!Number.isInteger(q) || q < 1 || q > 50) {
          errors.push({ row: r, reason: `Số lượng phải từ 1 đến 50: ${qtyRaw}` });
          continue;
        }
        quantity = q;
      }
      try {
        const books = await this.createBook(
          {
            title,
            author: author || undefined,
            category: category || undefined,
            publisher: publisher || undefined,
            publishYear,
          },
          quantity,
        );
        created += books.length;
      } catch (err) {
        errors.push({ row: r, reason: err instanceof Error ? err.message : 'Lỗi không xác định' });
      }
    }
    return { created, errors };
  }
}
