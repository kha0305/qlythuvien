import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DbConn, pool } from '../db/pool';
import { APPROVAL_GRACE_HOURS, Reservation, ReservationStatus } from '../entities/Reservation';
import { Book, BookStatus } from '../entities/Book';
import { User, UserRole } from '../entities/User';
import { resolveOrderBy } from '../utils/sort';

const RES_JOIN = `
  SELECT r.*,
         b.id AS b_id, b.qr_code AS b_qr, b.title AS b_title, b.author AS b_author,
         b.category AS b_category, b.publisher AS b_publisher, b.publish_year AS b_year,
         b.status AS b_status, b.cover_url AS b_cover,
         u.id AS u_id, u.username AS u_username, u.password_hash AS u_hash,
         u.full_name AS u_name, u.role AS u_role, u.student_code AS u_code,
         u.phone AS u_phone, u.active AS u_active
  FROM reservations r
  JOIN books b ON b.id = r.book_id
  JOIN users u ON u.id = r.reader_id
`;

/** Điều kiện "đang hiệu lực": pending chưa qua expires_at, hoặc approved chưa qua pickup_at + 2h. */
const ACTIVE_WHERE = `(r.status = 'pending' AND r.expires_at >= NOW())
  OR (r.status = 'approved' AND DATE_ADD(r.pickup_at, INTERVAL ${APPROVAL_GRACE_HOURS} HOUR) >= NOW())`;

function mapRow(row: RowDataPacket): Reservation {
  const book = new Book({
    id: row.b_id,
    qrCode: row.b_qr,
    title: row.b_title,
    author: row.b_author,
    category: row.b_category,
    publisher: row.b_publisher,
    publishYear: row.b_year,
    coverUrl: row.b_cover,
    status: row.b_status as BookStatus,
  });
  const reader = new User({
    id: row.u_id,
    username: row.u_username,
    passwordHash: row.u_hash,
    fullName: row.u_name,
    role: row.u_role as UserRole,
    studentCode: row.u_code,
    phone: row.u_phone,
    active: Number(row.u_active) === 1,
  });
  return new Reservation({
    id: row.id,
    book,
    reader,
    readerNote: row.reader_note,
    reservedAt: new Date(row.reserved_at),
    expiresAt: new Date(row.expires_at),
    pickupAt: row.pickup_at ? new Date(row.pickup_at) : null,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
    rejectReason: row.reject_reason,
    code: row.code ?? null,
    status: row.status as ReservationStatus,
  });
}

export class ReservationRepository {
  async save(reservation: Reservation, conn: DbConn = pool): Promise<Reservation> {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO reservations (book_id, reader_id, reader_note, reserved_at, expires_at, code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [reservation.book.id, reservation.reader.id, reservation.readerNote, reservation.reservedAt, reservation.expiresAt, reservation.code, reservation.status],
    );
    reservation.id = result.insertId;
    return reservation;
  }

  async findById(id: number, conn: DbConn = pool): Promise<Reservation | null> {
    const [rows] = await conn.query<RowDataPacket[]>(`${RES_JOIN} WHERE r.id = ?`, [id]);
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  /** Tìm lượt đặt còn hiệu lực (pending/approved chưa hết hạn) theo mã QR. */
  async findActiveByCode(code: string, conn: DbConn = pool): Promise<Reservation | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `${RES_JOIN} WHERE r.code = ? AND (${ACTIVE_WHERE}) LIMIT 1`,
      [code.trim().toUpperCase()],
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async codeExists(code: string, conn: DbConn = pool): Promise<boolean> {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT 1 FROM reservations WHERE code = ? LIMIT 1',
      [code],
    );
    return rows.length > 0;
  }

  // Lượt đặt đang hiệu lực (pending/approved còn hạn) của 1 cuốn sách.
  // D12 (sửa 16/10/2026): mỗi cuốn chỉ tối đa 1 lượt như vậy.
  async findActiveByBook(bookId: number, conn: DbConn = pool): Promise<Reservation | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `${RES_JOIN} WHERE r.book_id = ? AND (${ACTIVE_WHERE})
       ORDER BY r.reserved_at DESC LIMIT 1`,
      [bookId],
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async findActiveByBookAndReader(bookId: number, readerId: number, conn: DbConn = pool): Promise<Reservation | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `${RES_JOIN} WHERE r.book_id = ? AND r.reader_id = ? AND (${ACTIVE_WHERE})
       LIMIT 1`,
      [bookId, readerId],
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  // Tất cả lượt đặt của 1 độc giả (mọi trạng thái), mới nhất trước.
  async findAllByReader(readerId: number, conn: DbConn = pool): Promise<Reservation[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `${RES_JOIN} WHERE r.reader_id = ? ORDER BY r.reserved_at DESC`,
      [readerId],
    );
    return rows.map(mapRow);
  }

  // Danh sách chờ duyệt (thủ thư). Mặc định cũ nhất trước (hàng đợi duyệt).
  // Lưu ý: trang này chỉ hiện pending (1 trạng thái), và "giờ mong muốn" là ghi chú
  // tự do (không phải datetime) nên không sort được theo 2 tiêu chí đó.
  async listPending(sort?: string, conn: DbConn = pool): Promise<Reservation[]> {
    const orderBy = resolveOrderBy(sort, { newest: 'r.reserved_at DESC' }, 'r.reserved_at ASC');
    const [rows] = await conn.query<RowDataPacket[]>(
      `${RES_JOIN} WHERE r.status = 'pending' ORDER BY ${orderBy}`,
    );
    return rows.map(mapRow);
  }

  async approve(id: number, pickupAt: Date, reviewerId: number, conn: DbConn = pool): Promise<void> {
    await conn.query(
      `UPDATE reservations SET status = 'approved', pickup_at = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [pickupAt, reviewerId, id],
    );
  }

  async reject(id: number, reviewerId: number, reason: string | null, conn: DbConn = pool): Promise<void> {
    await conn.query(
      `UPDATE reservations SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), reject_reason = ?
       WHERE id = ?`,
      [reviewerId, reason, id],
    );
  }

  async updateStatus(id: number, status: ReservationStatus, conn: DbConn = pool): Promise<void> {
    await conn.query('UPDATE reservations SET status = ? WHERE id = ?', [status, id]);
  }

  /** Quét hết hạn lazy: pending qua expires_at, approved qua pickup_at + 2h -> expired. Trả về số dòng. */
  async sweepExpired(conn: DbConn = pool): Promise<number> {
    const [result] = await conn.query<ResultSetHeader>(
      `UPDATE reservations SET status = 'expired'
       WHERE (status = 'pending' AND expires_at < NOW())
          OR (status = 'approved' AND DATE_ADD(pickup_at, INTERVAL ${APPROVAL_GRACE_HOURS} HOUR) < NOW())`,
    );
    return result.affectedRows;
  }
}
