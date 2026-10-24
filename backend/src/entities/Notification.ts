export type NotificationAudience = 'all' | 'readers' | 'librarians';

/** Loại thông báo -> quyết định màu sắc hiển thị ở frontend. */
export type NotificationType =
  | 'reservation' // đặt trước: vàng
  | 'loan'        // mượn/trả: xanh dương
  | 'overdue'     // quá hạn: đỏ
  | 'general'     // thông báo chung: xanh lá
  | 'system';     // hệ thống: xám

export class Notification {
  id: number;
  audience: NotificationAudience;
  type: NotificationType;
  title: string;
  body: string | null;
  showOnLanding: boolean;
  createdBy: number | null;
  createdAt: Date;
  /** true nếu user hiện tại đã đọc (chỉ có khi lấy theo user). */
  isRead?: boolean;

  constructor(data: {
    id: number;
    audience: NotificationAudience;
    type: NotificationType;
    title: string;
    body?: string | null;
    showOnLanding?: boolean;
    createdBy?: number | null;
    createdAt: Date;
    isRead?: boolean;
  }) {
    this.id = data.id;
    this.audience = data.audience;
    this.type = data.type;
    this.title = data.title;
    this.body = data.body ?? null;
    this.showOnLanding = data.showOnLanding ?? false;
    this.createdBy = data.createdBy ?? null;
    this.createdAt = data.createdAt;
    this.isRead = data.isRead;
  }
}
