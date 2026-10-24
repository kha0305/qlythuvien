import { pool } from '../db/pool';
import { Loan } from '../entities/Loan';
import { BookRepository } from '../repositories/BookRepository';
import { LoanRepository, LoanFilters } from '../repositories/LoanRepository';
import { ReservationRepository } from '../repositories/ReservationRepository';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AppError } from '../utils/errors';

export interface ReturnResult {
  loan: Loan;
  overdueDays: number;
  fineAmount: number;
}

export class LoanService {
  constructor(
    private readonly loanRepo = new LoanRepository(),
    private readonly bookRepo = new BookRepository(),
    private readonly userRepo = new UserRepository(),
    private readonly reservationRepo = new ReservationRepository(),
    private readonly settingsRepo = new SettingsRepository(),
    /** Callback báo độc giả khi tạo phiếu mượn (tránh vòng lặp phụ thuộc service). */
    private readonly onNewLoan?: (readerId: number, bookTitle: string, dueAt: Date) => Promise<void>,
    /** Callback báo độc giả khi phát hiện quá hạn (gọi 1 lần nhờ có overdue_notified). */
    private readonly onOverdue?: (readerId: number, bookTitle: string, overdueDays: number) => Promise<void>,
  ) {}

  // UC04 + D4 + D13. Transaction (NFR11): tạo phiếu + đổi trạng thái sách
  // (+ đánh dấu fulfilled cho đặt trước) phải cùng thành công hoặc cùng rollback.
  async borrowBook(qrCode: string, readerId: number): Promise<Loan> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const settings = await this.settingsRepo.get(conn);

      const book = await this.bookRepo.findByQrCodeOrBookCode(qrCode.trim(), conn);
      if (!book) {
        throw new AppError(404, 'Không tìm thấy sách');
      }

      if (!book.isAvailable()) {
        const activeLoan = await this.loanRepo.findActiveByBook(book.id, conn);
        const borrowerName = activeLoan ? activeLoan.reader.fullName : 'độc giả khác';
        throw new AppError(400, `Sách đang được mượn bởi ${borrowerName}`);
      }

      const reader = await this.userRepo.findById(readerId, conn);
      if (!reader || reader.role !== 'reader') {
        throw new AppError(404, 'Không tìm thấy độc giả');
      }
      if (!reader.isActive()) {
        throw new AppError(403, 'Tài khoản độc giả đã bị khóa');
      }

      const activeCount = await this.loanRepo.countActiveByReader(readerId, conn);
      if (activeCount >= settings.maxBooksPerReader) {
        throw new AppError(400, `Độc giả đã mượn tối đa ${settings.maxBooksPerReader} cuốn`);
      }

      // D13 (sửa 16/10/2026): chỉ cho mượn khi không có đặt trước đang hiệu lực
      // (pending/approved còn hạn), hoặc đặt trước thuộc chính độc giả này.
      const activeReservation = await this.reservationRepo.findActiveByBook(book.id, conn);
      if (activeReservation && activeReservation.reader.id !== readerId) {
        throw new AppError(400, `Cuốn này đang được giữ chỗ cho ${activeReservation.reader.fullName}`);
      }

      const borrowedAt = new Date();
      // D4: due_at = borrowed_at + loan_days (giờ chính xác, không làm tròn ngày).
      const dueAt = new Date(borrowedAt.getTime() + settings.loanDays * 24 * 60 * 60 * 1000);

      const loan = new Loan({
        id: 0,
        book,
        reader,
        borrowedAt,
        dueAt,
        status: 'borrowing',
      });
      await this.loanRepo.save(loan, conn);
      await this.bookRepo.updateStatus(book.id, 'borrowed', conn);

      if (activeReservation && activeReservation.reader.id === readerId) {
        await this.reservationRepo.updateStatus(activeReservation.id, 'fulfilled', conn);
      }

      await conn.commit();
      // Thông báo tự động: nhắc hạn trả cho độc giả (không chặn luồng chính nếu lỗi).
      if (this.onNewLoan) {
        await this.onNewLoan(reader.id, book.title, dueAt).catch(() => {});
      }
      return loan;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // UC05 bước 1-3: quét QR -> xem trước phiếu + số ngày trễ + phạt dự kiến (CHƯA chốt, không đổi DB).
  async previewReturn(qrCode: string): Promise<{ loan: Loan; overdueDays: number; estimatedFine: number }> {
    const book = await this.bookRepo.findByQrCodeOrBookCode(qrCode.trim());
    if (!book) {
      throw new AppError(404, 'Không tìm thấy sách');
    }
    const loan = await this.loanRepo.findActiveByBook(book.id);
    if (!loan) {
      throw new AppError(400, 'Sách này không trong trạng thái cho mượn');
    }
    const settings = await this.settingsRepo.get();
    const now = new Date();
    const overdueDays = loan.calcOverdueDays(now);
    return { loan, overdueDays, estimatedFine: loan.calcFine(settings.finePerDay, now) };
  }

  // UC05 bước 4-6 + D6 + D7: xác nhận trả theo loanId, chốt phạt.
  // Transaction (NFR11): đóng phiếu + trả sách về available cùng thành công hoặc cùng rollback.
  async confirmReturn(loanId: number): Promise<ReturnResult> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const settings = await this.settingsRepo.get(conn);

      const loan = await this.loanRepo.findById(loanId, conn);
      if (!loan || loan.status !== 'borrowing') {
        throw new AppError(400, 'Sách này không trong trạng thái cho mượn');
      }

      const now = new Date();
      const overdueDays = loan.calcOverdueDays(now);
      // D7: chốt phạt lúc trả theo mức hiện hành trong settings.
      const fineAmount = loan.calcFine(settings.finePerDay, now);

      await this.loanRepo.updateReturn(loan.id, now, fineAmount, conn);
      await this.bookRepo.updateStatus(loan.book.id, 'available', conn);

      loan.returnedAt = now;
      loan.fineAmount = fineAmount;
      loan.status = 'returned';

      await conn.commit();
      return { loan, overdueDays, fineAmount };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // UC06: danh sách quá hạn kèm số ngày trễ + phạt dự kiến, sắp xếp trễ nhiều trước.
  async listOverdue(sort?: string): Promise<{ loan: Loan; overdueDays: number; estimatedFine: number }[]> {
    const settings = await this.settingsRepo.get();
    const now = new Date();
    const loans = await this.loanRepo.findOverdue(sort);
    // Tự động gửi thông báo quá hạn 1 lần cho các phiếu chưa báo (chống trùng nhờ có overdue_notified).
    if (this.onOverdue) {
      const unnotified = await this.loanRepo.findOverdueUnnotified();
      for (const loan of unnotified) {
        const days = loan.calcOverdueDays(now);
        await this.onOverdue(loan.reader.id, loan.book.title, days).catch(() => {});
        await this.loanRepo.markOverdueNotified(loan.id);
      }
    }
    return loans.map((loan) => {
      const overdueDays = loan.calcOverdueDays(now);
      return { loan, overdueDays, estimatedFine: loan.calcFine(settings.finePerDay, now) };
    });
  }

  // UC08: phiếu của 1 độc giả (đang mượn + lịch sử), kèm số liệu tính động.
  async getReaderLoans(readerId: number) {
    const settings = await this.settingsRepo.get();
    const now = new Date();
    const loans = await this.loanRepo.findByReader(readerId);
    return loans.map((loan) => ({
      loan,
      overdueDays: loan.status === 'borrowing' ? loan.calcOverdueDays(now) : 0,
      estimatedFine: loan.status === 'borrowing' ? loan.calcFine(settings.finePerDay, now) : loan.fineAmount,
    }));
  }

  // UC07: lịch sử mượn/trả có lọc.
  async getHistory(filters: LoanFilters) {
    return this.loanRepo.findByFilters(filters);
  }
}
