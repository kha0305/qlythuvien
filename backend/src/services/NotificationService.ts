import { Notification, NotificationAudience, NotificationType } from '../entities/Notification';
import { UserRole } from '../entities/User';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { AppError } from '../utils/errors';

const VALID_AUDIENCES: NotificationAudience[] = ['all', 'readers', 'librarians'];
const VALID_TYPES: NotificationType[] = ['reservation', 'loan', 'overdue', 'general', 'system'];

export class NotificationService {
  constructor(private readonly notificationRepo = new NotificationRepository()) {}

  /** Thông báo của user hiện tại (mới nhất trước, kèm is_read). */
  async listMine(userId: number, role: UserRole): Promise<Notification[]> {
    return this.notificationRepo.listForUser(userId, role);
  }

  async unreadCount(userId: number, role: UserRole): Promise<number> {
    return this.notificationRepo.countUnread(userId, role);
  }

  async markRead(userId: number, notificationId: number): Promise<void> {
    const notif = await this.notificationRepo.findById(notificationId);
    if (!notif) {
      throw new AppError(404, 'Không tìm thấy thông báo');
    }
    await this.notificationRepo.markRead(notificationId, userId);
  }

  async markAllRead(userId: number, role: UserRole): Promise<void> {
    await this.notificationRepo.markAllRead(userId, role);
  }

  /** Admin/thủ thư tạo thông báo thủ công. */
  async createManual(
    createdBy: number,
    input: {
      audience?: unknown;
      type?: unknown;
      title?: unknown;
      body?: unknown;
      showOnLanding?: unknown;
    },
  ): Promise<Notification> {
    const audience = (input.audience as NotificationAudience) ?? 'all';
    const type = (input.type as NotificationType) ?? 'general';
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const body = typeof input.body === 'string' && input.body.trim() ? input.body.trim().slice(0, 2000) : null;
    if (!VALID_AUDIENCES.includes(audience)) {
      throw new AppError(400, 'Đối tượng nhận không hợp lệ');
    }
    if (!VALID_TYPES.includes(type)) {
      throw new AppError(400, 'Loại thông báo không hợp lệ');
    }
    if (!title) {
      throw new AppError(400, 'Tiêu đề không được để trống');
    }
    // Chỉ thông báo chung mới được hiện ở landing.
    const showOnLanding = type === 'general' && input.showOnLanding === true;
    return this.notificationRepo.create({
      audience,
      type,
      title: title.slice(0, 255),
      body,
      showOnLanding,
      createdBy,
    });
  }

  // ---- Thông báo tự động (hệ thống, createdBy = null) ----

  /** Đặt trước mới -> báo cho tất cả thủ thư (chống trùng: 1 lượt đặt = 1 thông báo). */
  async notifyNewReservation(bookTitle: string, readerName: string): Promise<void> {
    await this.notificationRepo.create({
      audience: 'librarians',
      type: 'reservation',
      title: 'Có lượt đặt trước mới',
      body: `${readerName} vừa đặt trước sách "${bookTitle}". Vui lòng duyệt.`,
    });
  }

  /** Duyệt/từ chối -> báo riêng cho độc giả đó. */
  async notifyReservationReviewed(
    readerId: number,
    approved: boolean,
    bookTitle: string,
    extra?: string | null,
  ): Promise<void> {
    await this.notificationRepo.create({
      audience: 'readers',
      type: 'reservation',
      title: approved ? 'Đặt trước đã được duyệt' : 'Đặt trước không được duyệt',
      body: approved
        ? `Sách "${bookTitle}" đã được duyệt.${extra ? ` Lịch hẹn đến lấy: ${extra}.` : ''} Vui lòng đến đúng hẹn.`
        : `Rất tiếc, lượt đặt sách "${bookTitle}" không được duyệt.${extra ? ` Lý do: ${extra}.` : ''}`,
      userId: readerId,
    });
  }

  /** Tạo phiếu mượn -> báo riêng cho độc giả (nhắc hạn trả). */
  async notifyNewLoan(readerId: number, bookTitle: string, dueAt: Date): Promise<void> {
    const due = dueAt.toLocaleString('vi-VN');
    await this.notificationRepo.create({
      audience: 'readers',
      type: 'loan',
      title: 'Mượn sách thành công',
      body: `Bạn đã mượn sách "${bookTitle}". Hạn trả: ${due}. Hãy trả đúng hạn để tránh bị phạt.`,
      userId: readerId,
    });
  }

  /** Quá hạn -> báo riêng cho độc giả (gọi 1 lần nhờ có overdue_notified). */
  async notifyOverdue(readerId: number, bookTitle: string, overdueDays: number): Promise<void> {
    await this.notificationRepo.create({
      audience: 'readers',
      type: 'overdue',
      title: 'Sách đã quá hạn trả',
      body: `Sách "${bookTitle}" đã quá hạn ${overdueDays} ngày. Vui lòng trả sớm để tránh tăng tiền phạt.`,
      userId: readerId,
    });
  }
}
