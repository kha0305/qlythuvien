import { Reservation } from '../entities/Reservation';
import { BookRepository } from '../repositories/BookRepository';
import { ReservationRepository } from '../repositories/ReservationRepository';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AppError } from '../utils/errors';

/** Sinh mã QR đặt trước: 8 ký tự A-Z0-9. */
function generateReservationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ I, O, 0, 1 để dễ đọc
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class ReservationService {
  constructor(
    private readonly reservationRepo = new ReservationRepository(),
    private readonly bookRepo = new BookRepository(),
    private readonly userRepo = new UserRepository(),
    private readonly settingsRepo = new SettingsRepository(),
    /** Callback báo thủ thư khi có đặt trước mới (tránh vòng lặp phụ thuộc service). */
    private readonly onNewReservation?: (bookTitle: string, readerName: string) => Promise<void>,
    /** Callback báo độc giả khi duyệt/từ chối. */
    private readonly onReviewed?: (readerId: number, approved: boolean, bookTitle: string, extra?: string | null) => Promise<void>,
  ) {}

  // UC11 + D11 + D12 (sửa 16/10/2026): độc giả đặt trước sách đang "Còn" -> trạng thái pending (chờ duyệt).
  // Khóa đúng id cuốn đó; các bản copy khác của cùng tựa sách vẫn đặt/mượn được.
  async reserveBook(bookId: number, readerId: number, readerNote?: string): Promise<{ reservation: Reservation; reservationHours: number }> {
    const book = await this.bookRepo.findById(bookId);
    if (!book) {
      throw new AppError(404, 'Không tìm thấy sách');
    }
    const reader = await this.userRepo.findById(readerId);
    if (!reader || reader.role !== 'reader') {
      throw new AppError(404, 'Không tìm thấy độc giả');
    }

    // 2a. Sách không còn "Còn" (vừa bị mượn) -> từ chối.
    if (!book.isAvailable()) {
      throw new AppError(400, 'Sách hiện không khả dụng');
    }
    await this.reservationRepo.sweepExpired();
    // 2b. Chính độc giả này đã đặt cuốn này -> từ chối (kiểm tra trước để báo đúng câu).
    const myActive = await this.reservationRepo.findActiveByBookAndReader(bookId, readerId);
    if (myActive) {
      throw new AppError(400, 'Bạn đã đặt trước cuốn này');
    }
    // 2c. Đã có lượt đặt đang hiệu lực của người khác -> từ chối.
    const existingActive = await this.reservationRepo.findActiveByBook(bookId);
    if (existingActive) {
      throw new AppError(400, 'Cuốn này đang được giữ chỗ');
    }

    const settings = await this.settingsRepo.get();
    const reservedAt = new Date();
    // D11 (sửa 16/10/2026): expires_at = hạn thủ thư duyệt = reserved_at + reservation_hours.
    const expiresAt = new Date(reservedAt.getTime() + settings.reservationHours * 60 * 60 * 1000);

    // Sinh mã QR đặt trước (8 ký tự, duy nhất).
    let code = generateReservationCode();
    for (let i = 0; i < 5 && (await this.reservationRepo.codeExists(code)); i += 1) {
      code = generateReservationCode();
    }

    const reservation = new Reservation({
      id: 0,
      book,
      reader,
      readerNote: readerNote?.trim() ? readerNote.trim().slice(0, 255) : null,
      reservedAt,
      expiresAt,
      code,
      status: 'pending',
    });
    const saved = await this.reservationRepo.save(reservation);
    // Thông báo tự động: báo cho tất cả thủ thư (không chặn luồng chính nếu lỗi).
    if (this.onNewReservation) {
      await this.onNewReservation(book.title, reader.fullName).catch(() => {});
    }
    return { reservation: saved, reservationHours: settings.reservationHours };
  }

  // Thủ thư duyệt + chốt lịch hẹn đến lấy.
  async approveReservation(id: number, pickupAtRaw: unknown, reviewerId: number): Promise<Reservation> {
    await this.reservationRepo.sweepExpired();
    const reservation = await this.reservationRepo.findById(id);
    if (!reservation || reservation.status !== 'pending') {
      throw new AppError(404, 'Không tìm thấy lượt đặt chờ duyệt');
    }
    const pickupAt = new Date(pickupAtRaw as string);
    if (Number.isNaN(pickupAt.getTime())) {
      throw new AppError(400, 'Lịch hẹn không hợp lệ');
    }
    if (pickupAt.getTime() <= Date.now()) {
      throw new AppError(400, 'Lịch hẹn phải ở tương lai');
    }
    await this.reservationRepo.approve(id, pickupAt, reviewerId);
    const updated = await this.reservationRepo.findById(id);
    // Thông báo tự động: báo riêng cho độc giả.
    if (this.onReviewed && updated) {
      const pickupText = pickupAt.toLocaleString('vi-VN');
      await this.onReviewed(updated.reader.id, true, updated.book.title, pickupText).catch(() => {});
    }
    return updated!;
  }

  // Thủ thư không duyệt (+ lý do tùy chọn).
  async rejectReservation(id: number, reviewerId: number, reason?: string): Promise<Reservation> {
    await this.reservationRepo.sweepExpired();
    const reservation = await this.reservationRepo.findById(id);
    if (!reservation || reservation.status !== 'pending') {
      throw new AppError(404, 'Không tìm thấy lượt đặt chờ duyệt');
    }
    const rejectReason = reason?.trim() ? reason.trim().slice(0, 255) : null;
    await this.reservationRepo.reject(id, reviewerId, rejectReason);
    const updated = await this.reservationRepo.findById(id);
    // Thông báo tự động: báo riêng cho độc giả.
    if (this.onReviewed && updated) {
      await this.onReviewed(updated.reader.id, false, updated.book.title, rejectReason).catch(() => {});
    }
    return updated!;
  }

  // UC12: hủy đặt trước; chỉ được hủy khi còn pending và là của chính mình.
  async cancelReservation(id: number, readerId: number): Promise<void> {
    await this.reservationRepo.sweepExpired();
    const reservation = await this.reservationRepo.findById(id);
    if (!reservation || reservation.status !== 'pending') {
      throw new AppError(404, 'Không tìm thấy lượt đặt trước');
    }
    if (reservation.reader.id !== readerId) {
      throw new AppError(403, 'Bạn không có quyền hủy lượt đặt trước này');
    }
    await this.reservationRepo.updateStatus(id, 'cancelled');
  }

  // Tất cả lượt đặt của độc giả (mọi trạng thái), kèm thông tin còn lại.
  async listMyReservations(readerId: number): Promise<{ reservation: Reservation; remainingMs: number | null }[]> {
    await this.reservationRepo.sweepExpired();
    const now = new Date();
    const reservations = await this.reservationRepo.findAllByReader(readerId);
    return reservations.map((reservation) => {
      const until = reservation.holdUntil();
      return {
        reservation,
        remainingMs: until ? Math.max(0, until.getTime() - now.getTime()) : null,
      };
    });
  }

  // Thủ thư: tra cứu đặt trước còn hiệu lực theo mã QR (để quét ở quầy mượn).
  async findActiveByCode(code: string): Promise<Reservation> {
    await this.reservationRepo.sweepExpired();
    const reservation = await this.reservationRepo.findActiveByCode(code);
    if (!reservation) {
      throw new AppError(404, 'Không tìm thấy lượt đặt trước còn hiệu lực với mã này');
    }
    return reservation;
  }

  // Thủ thư: danh sách chờ duyệt (đã quét hết hạn trước).
  async listPendingForLibrarian(sort?: string): Promise<Reservation[]> {
    await this.reservationRepo.sweepExpired();
    return this.reservationRepo.listPending(sort);
  }
}
