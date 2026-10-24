import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DbConn, pool } from '../db/pool';
import { Book, BookStatus } from '../entities/Book';
import { Loan, LoanStatus } from '../entities/Loan';
import { User, UserRole } from '../entities/User';
import { resolveOrderBy } from '../utils/sort';

const LOAN_JOIN = `
  SELECT l.*,
         b.id AS b_id, b.qr_code AS b_qr, b.title AS b_title, b.author AS b_author,
         b.category AS b_category, b.publisher AS b_publisher, b.publish_year AS b_year,
         b.status AS b_status, b.cover_url AS b_cover,
         u.id AS u_id, u.username AS u_username, u.password_hash AS u_hash,
         u.full_name AS u_name, u.role AS u_role, u.student_code AS u_code,
         u.phone AS u_phone, u.active AS u_active, u.email AS u_email,
         u.email_verified AS u_email_verified
  FROM loans l
  JOIN books b ON b.id = l.book_id
  JOIN users u ON u.id = l.reader_id
`;

function mapRow(row: RowDataPacket): Loan {
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
    email: row.u_email ?? null,
    emailVerified: Number(row.u_email_verified ?? 0) === 1,
    active: Number(row.u_active) === 1,
  });
  return new Loan({
    id: row.id,
    book,
    reader,
    borrowedAt: new Date(row.borrowed_at),
    dueAt: new Date(row.due_at),
    returnedAt: row.returned_at ? new Date(row.returned_at) : null,
    fineAmount: Number(row.fine_amount),
    status: row.status as LoanStatus,
  });
}

export interface LoanFilters {
  status?: LoanStatus;
  readerId?: number;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  /** Mã sort theo whitelist (findByFilters): 'oldest' -> cũ nhất trước, mặc định mới nhất trước. */
  sort?: string;
}

export class LoanRepository {
  async save(loan: Loan, conn: DbConn = pool): Promise<Loan> {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO loans (book_id, reader_id, borrowed_at, due_at, status)
       VALUES (?, ?, ?, ?, ?)`,
      [loan.book.id, loan.reader.id, loan.borrowedAt, loan.dueAt, loan.status],
    );
    loan.id = result.insertId;
    return loan;
  }

  async findById(id: number, conn: DbConn = pool): Promise<Loan | null> {
    const [rows] = await conn.query<RowDataPacket[]>(`${LOAN_JOIN} WHERE l.id = ? LIMIT 1`, [id]);
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async findActiveByBook(bookId: number, conn: DbConn = pool): Promise<Loan | null> {    const [rows] = await conn.query<RowDataPacket[]>(
      `${LOAN_JOIN} WHERE l.book_id = ? AND l.status = 'borrowing' LIMIT 1`,
      [bookId],
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async countActiveByReader(readerId: number, conn: DbConn = pool): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM loans WHERE reader_id = ? AND status = 'borrowing'`,
      [readerId],
    );
    return Number(rows[0].total);
  }

  // D5: quá hạn tính động borrowing AND due_at < NOW().
  // Mặc định hạn trả sớm nhất (trễ nhiều nhất) trước (UC06); due_desc: hạn trả gần nhất trước.
  /** UC17: toàn bộ phiếu đang mượn (kèm sách + độc giả) cho vòng quét nhắc hạn. */
  async findAllBorrowing(conn: DbConn = pool): Promise<Loan[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `${LOAN_JOIN} WHERE l.status = 'borrowing' ORDER BY l.due_at ASC`,
    );
    return rows.map(mapRow);
  }

  async findOverdue(sort?: string, conn: DbConn = pool): Promise<Loan[]> {
    const orderBy = resolveOrderBy(sort, { due_desc: 'l.due_at DESC' }, 'l.due_at ASC');
    const [rows] = await conn.query<RowDataPacket[]>(
      `${LOAN_JOIN} WHERE l.status = 'borrowing' AND l.due_at < NOW() ORDER BY ${orderBy}`,
    );
    return rows.map(mapRow);
  }

  /** Phiếu quá hạn CHƯA gửi thông báo (chống trùng): để tự động báo 1 lần cho độc giả. */
  async findOverdueUnnotified(conn: DbConn = pool): Promise<Loan[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `${LOAN_JOIN} WHERE l.status = 'borrowing' AND l.due_at < NOW() AND l.overdue_notified = 0`,
    );
    return rows.map(mapRow);
  }

  /** Đánh dấu đã gửi thông báo quá hạn cho 1 phiếu. */
  async markOverdueNotified(id: number, conn: DbConn = pool): Promise<void> {
    await conn.query('UPDATE loans SET overdue_notified = 1 WHERE id = ?', [id]);
  }

  async findByFilters(filters: LoanFilters, conn: DbConn = pool): Promise<{ loans: Loan[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.status) { conditions.push('l.status = ?'); params.push(filters.status); }
    if (filters.readerId) { conditions.push('l.reader_id = ?'); params.push(filters.readerId); }
    if (filters.from) { conditions.push('l.borrowed_at >= ?'); params.push(filters.from); }
    if (filters.to) { conditions.push('l.borrowed_at <= ?'); params.push(filters.to); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = resolveOrderBy(filters.sort, { oldest: 'l.id ASC' }, 'l.id DESC');
    const [countRows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM loans l ${where}`,
      params,
    );
    const total = Number(countRows[0].total);
    const offset = (filters.page - 1) * filters.limit;
    const [rows] = await conn.query<RowDataPacket[]>(
      `${LOAN_JOIN} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, filters.limit, offset],
    );
    return { loans: rows.map(mapRow), total };
  }

  async findByReader(readerId: number, conn: DbConn = pool): Promise<Loan[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `${LOAN_JOIN} WHERE l.reader_id = ? ORDER BY l.id DESC`,
      [readerId],
    );
    return rows.map(mapRow);
  }

  async updateReturn(id: number, returnedAt: Date, fineAmount: number, conn: DbConn = pool): Promise<void> {
    await conn.query(
      `UPDATE loans SET returned_at = ?, fine_amount = ?, status = 'returned' WHERE id = ?`,
      [returnedAt, fineAmount, id],
    );
  }

  // Thống kê: đếm theo trạng thái.
  async countByStatus(status: LoanStatus, conn: DbConn = pool): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM loans WHERE status = ?', [status]);
    return Number(rows[0].total);
  }

  async countOverdue(conn: DbConn = pool): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM loans WHERE status = 'borrowing' AND due_at < NOW()`,
    );
    return Number(rows[0].total);
  }

  // Top 5 sách được mượn nhiều nhất (đếm theo bảng loans).
  async topBorrowedBooks(limit: number, conn: DbConn = pool): Promise<{ book: Book; borrowCount: number }[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT b.*, COUNT(l.id) AS borrow_count
       FROM loans l
       JOIN books b ON b.id = l.book_id
       GROUP BY l.book_id
       ORDER BY borrow_count DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map((row) => ({
      book: new Book({
        id: row.id,
        qrCode: row.qr_code,
        title: row.title,
        author: row.author,
        category: row.category,
        publisher: row.publisher,
        publishYear: row.publish_year,
        coverUrl: row.cover_url,
        status: row.status as BookStatus,
      }),
      borrowCount: Number(row.borrow_count),
    }));
  }
}
