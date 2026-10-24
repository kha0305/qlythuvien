import { Book } from './Book';
import { User } from './User';

export type ReservationStatus =
  | 'pending'    // chờ thủ thư duyệt
  | 'approved'   // đã duyệt, chờ đến lấy theo lịch hẹn
  | 'rejected'   // thủ thư không duyệt
  | 'fulfilled'  // đã đến lấy / đã mượn
  | 'cancelled'  // độc giả hủy
  | 'expired';   // quá hạn (chờ duyệt quá 48h, hoặc qua giờ hẹn + grace)

/** Số giờ dự phòng sau lịch hẹn: qua pickup_at + APPROVAL_GRACE_HOURS mà không đến -> expired. */
export const APPROVAL_GRACE_HOURS = 2;

export class Reservation {
  id: number;
  book: Book;
  reader: User;
  readerNote: string | null;
  reservedAt: Date;
  expiresAt: Date;
  pickupAt: Date | null;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  rejectReason: string | null;
  /** Mã QR đặt trước (8 ký tự A-Z0-9), độc giả đưa mã này ở quầy để lấy sách. */
  code: string | null;
  status: ReservationStatus;

  constructor(data: {
    id: number;
    book: Book;
    reader: User;
    readerNote?: string | null;
    reservedAt: Date;
    expiresAt: Date;
    pickupAt?: Date | null;
    reviewedBy?: number | null;
    reviewedAt?: Date | null;
    rejectReason?: string | null;
    code?: string | null;
    status?: ReservationStatus;
  }) {
    this.id = data.id;
    this.book = data.book;
    this.reader = data.reader;
    this.readerNote = data.readerNote ?? null;
    this.reservedAt = data.reservedAt;
    this.expiresAt = data.expiresAt;
    this.pickupAt = data.pickupAt ?? null;
    this.reviewedBy = data.reviewedBy ?? null;
    this.reviewedAt = data.reviewedAt ?? null;
    this.rejectReason = data.rejectReason ?? null;
    this.code = data.code ?? null;
    this.status = data.status ?? 'pending';
  }

  /** Mốc hết hiệu lực: pending -> expiresAt; approved -> pickupAt + 2h grace. */
  holdUntil(): Date | null {
    if (this.status === 'approved' && this.pickupAt) {
      return new Date(this.pickupAt.getTime() + APPROVAL_GRACE_HOURS * 3600 * 1000);
    }
    if (this.status === 'pending') {
      return this.expiresAt;
    }
    return null;
  }

  // Hết hạn tính động, không cần cron.
  isExpired(now: Date = new Date()): boolean {
    if (this.status !== 'pending' && this.status !== 'approved') return false;
    const until = this.holdUntil();
    return until !== null && until.getTime() < now.getTime();
  }

  // Chỉ lượt đặt pending/approved chưa hết hạn mới được coi là "đang hiệu lực" (giữ chỗ).
  isActive(now: Date = new Date()): boolean {
    return (this.status === 'pending' || this.status === 'approved') && !this.isExpired(now);
  }
}
