import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DbConn, pool } from '../db/pool';
import { Notification, NotificationAudience, NotificationType } from '../entities/Notification';
import { UserRole } from '../entities/User';

function mapRow(row: RowDataPacket): Notification {
  return new Notification({
    id: row.id,
    audience: row.audience as NotificationAudience,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    showOnLanding: Number(row.show_on_landing) === 1,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    isRead: row.is_read !== undefined ? Number(row.is_read) === 1 : undefined,
  });
}

/** Audience nào thì role nào được nhận: all -> mọi role; readers -> reader; librarians -> librarian + admin. */
function audienceForRole(role: UserRole): string[] {
  if (role === 'reader') return ['all', 'readers'];
  return ['all', 'librarians'];
}

/**
 * Điều kiện nhận thông báo của 1 user:
 * - thông báo riêng (user_id = user) -> luôn nhận
 * - thông báo chung (user_id IS NULL) -> theo audience đúng role
 */
const VISIBLE_WHERE = `(n.user_id = ? OR (n.user_id IS NULL AND n.audience IN (?, ?)))`;

export class NotificationRepository {
  async create(
    data: {
      audience: NotificationAudience;
      type: NotificationType;
      title: string;
      body?: string | null;
      showOnLanding?: boolean;
      createdBy?: number | null;
      /** Gửi riêng cho 1 user (duyệt/từ chối, mượn, quá hạn). NULL = gửi theo audience. */
      userId?: number | null;
    },
    conn: DbConn = pool,
  ): Promise<Notification> {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO notifications (audience, type, title, body, show_on_landing, created_by, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.audience,
        data.type,
        data.title,
        data.body ?? null,
        data.showOnLanding ? 1 : 0,
        data.createdBy ?? null,
        data.userId ?? null,
      ],
    );
    const created = await this.findById(result.insertId, conn);
    return created!;
  }

  async findById(id: number, conn: DbConn = pool): Promise<Notification | null> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM notifications WHERE id = ?', [id]);
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  /** Thông báo của 1 user: riêng + theo audience, mới nhất trước, kèm cờ is_read. */
  async listForUser(userId: number, role: UserRole, limit = 50, conn: DbConn = pool): Promise<Notification[]> {
    const audiences = audienceForRole(role);
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT n.*, (nr.notification_id IS NOT NULL) AS is_read
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
       WHERE ${VISIBLE_WHERE}
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [userId, userId, audiences[0], audiences[1], limit],
    );
    return rows.map(mapRow);
  }

  async countUnread(userId: number, role: UserRole, conn: DbConn = pool): Promise<number> {
    const audiences = audienceForRole(role);
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
       WHERE ${VISIBLE_WHERE} AND nr.notification_id IS NULL`,
      [userId, userId, audiences[0], audiences[1]],
    );
    return Number(rows[0].total);
  }

  async markRead(notificationId: number, userId: number, conn: DbConn = pool): Promise<void> {
    await conn.query(
      `INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)`,
      [notificationId, userId],
    );
  }

  async markAllRead(userId: number, role: UserRole, conn: DbConn = pool): Promise<void> {
    const audiences = audienceForRole(role);
    await conn.query(
      `INSERT IGNORE INTO notification_reads (notification_id, user_id)
       SELECT n.id, ? FROM notifications n WHERE ${VISIBLE_WHERE}`,
      [userId, userId, audiences[0], audiences[1]],
    );
  }

  /** Thông báo chung hiện ở landing page (public, không cần đăng nhập). */
  async listLanding(limit = 5, conn: DbConn = pool): Promise<Notification[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM notifications
       WHERE type = 'general' AND show_on_landing = 1 AND user_id IS NULL
       ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map(mapRow);
  }
}
