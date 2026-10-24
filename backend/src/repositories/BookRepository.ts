import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DbConn, pool } from '../db/pool';
import { Book, BookStatus } from '../entities/Book';
import { resolveOrderBy } from '../utils/sort';

function mapRow(row: RowDataPacket): Book {
  return new Book({
    id: row.id,
    qrCode: row.qr_code,
    bookCode: row.book_code ?? null,
    title: row.title,
    author: row.author,
    category: row.category,
    publisher: row.publisher,
    publishYear: row.publish_year,
    coverUrl: row.cover_url,
    status: row.status as BookStatus,
  });
}

/** Điều kiện "đang giữ chỗ": sách available + có lượt đặt đang hiệu lực. */
const RESERVED_EXISTS = `EXISTS (
  SELECT 1 FROM reservations r
  WHERE r.book_id = books.id
    AND ((r.status = 'pending' AND r.expires_at >= NOW())
      OR (r.status = 'approved' AND DATE_ADD(r.pickup_at, INTERVAL 2 HOUR) >= NOW()))
)`;

/** Bộ lọc nâng cao cho trang Quản lý sách (kết hợp với search + sort). */
export interface BookSearchFilters {
  /** available | borrowed: theo cột status; reserved: available + đang giữ chỗ. */
  status?: 'available' | 'borrowed' | 'reserved';
  publisher?: string;
  year?: number;
}

export class BookRepository {
  async findById(id: number, conn: DbConn = pool): Promise<Book | null> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM books WHERE id = ?', [id]);
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async findByQrCode(qrCode: string, conn: DbConn = pool): Promise<Book | null> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM books WHERE qr_code = ?', [qrCode]);
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async save(book: Book, conn: DbConn = pool): Promise<Book> {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO books (qr_code, book_code, title, author, category, publisher, publish_year, cover_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [book.qrCode, book.bookCode, book.title, book.author, book.category, book.publisher, book.publishYear, book.coverUrl ?? null, book.status],
    );
    book.id = result.insertId;
    return book;
  }

  // NFR07: chỉ cho đổi thông tin mô tả, KHÔNG đổi qr_code / status qua đây.
  async update(
    id: number,
    fields: { title?: string; author?: string | null; category?: string | null; publisher?: string | null; publishYear?: number | null },
    conn: DbConn = pool,
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.title !== undefined) { sets.push('title = ?'); params.push(fields.title); }
    if (fields.author !== undefined) { sets.push('author = ?'); params.push(fields.author); }
    if (fields.category !== undefined) { sets.push('category = ?'); params.push(fields.category); }
    if (fields.publisher !== undefined) { sets.push('publisher = ?'); params.push(fields.publisher); }
    if (fields.publishYear !== undefined) { sets.push('publish_year = ?'); params.push(fields.publishYear); }
    if (sets.length === 0) return;
    params.push(id);
    await conn.query(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  // status chỉ đổi qua luồng mượn/trả (NFR07).
  async updateStatus(id: number, status: BookStatus, conn: DbConn = pool): Promise<void> {
    await conn.query('UPDATE books SET status = ? WHERE id = ?', [status, id]);
  }

  /** Sách chưa có ảnh bìa (cover_url NULL hoặc rỗng), theo id tăng dần, giới hạn limit. */
  async findWithoutCover(limit: number, conn: DbConn = pool): Promise<Book[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM books WHERE cover_url IS NULL OR cover_url = '' ORDER BY id ASC LIMIT ?`,
      [limit],
    );
    return rows.map(mapRow);
  }

  /** Số sách chưa có ảnh bìa (để báo "còn bao nhiêu cuốn" sau mỗi đợt batch). */
  async countWithoutCover(conn: DbConn = pool): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM books WHERE cover_url IS NULL OR cover_url = ''`,
    );
    return Number(rows[0].total);
  }

  /** Cập nhật ảnh bìa (đường dẫn tương đối /uploads/covers/...). */
  async updateCoverUrl(id: number, coverUrl: string | null, conn: DbConn = pool): Promise<void> {
    await conn.query('UPDATE books SET cover_url = ? WHERE id = ?', [coverUrl, id]);
  }

  /** Gán mã hiển thị cho sách (đồng bộ mã cho sách cũ). */
  async updateBookCode(id: number, bookCode: string, conn: DbConn = pool): Promise<void> {
    await conn.query('UPDATE books SET book_code = ? WHERE id = ?', [bookCode, id]);
  }

  async delete(id: number, conn: DbConn = pool): Promise<void> {
    await conn.query('DELETE FROM books WHERE id = ?', [id]);
  }

  /**
   * UC16: danh sách đại diện cho từng đầu sách (title + author) phục vụ tìm bằng AI.
   * Ưu tiên bản còn available làm đại diện; mỗi đầu sách chỉ 1 dòng.
   */
  async listDistinctTitles(conn: DbConn = pool): Promise<Book[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM books
       WHERE id IN (
         SELECT COALESCE(MIN(CASE WHEN status = 'available' THEN id END), MIN(id))
         FROM books GROUP BY title, IFNULL(author, '')
       )
       ORDER BY title`,
    );
    return rows.map(mapRow);
  }

  /** Đếm số bản của 1 đầu sách (group theo title + author, author NULL-safe). */
  async countCopies(
    title: string,
    author: string | null,
    conn: DbConn = pool,
  ): Promise<{ total: number; available: number }> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, SUM(status = 'available') AS available
       FROM books WHERE title = ? AND author <=> ?`,
      [title, author],
    );
    return { total: Number(rows[0].total), available: Number(rows[0].available ?? 0) };
  }

  async search(
    keyword: string | undefined,
    category: string | undefined,
    page: number,
    limit: number,
    sort?: string,
    filters?: BookSearchFilters,
    conn: DbConn = pool,
  ): Promise<{ books: Book[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (keyword) {
      conditions.push('(title LIKE ? OR author LIKE ? OR category LIKE ?)');
      const like = `%${keyword}%`;
      params.push(like, like, like);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (filters?.status === 'reserved') {
      conditions.push(`status = 'available' AND ${RESERVED_EXISTS}`);
    } else if (filters?.status === 'available' || filters?.status === 'borrowed') {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.publisher) {
      conditions.push('publisher = ?');
      params.push(filters.publisher);
    }
    if (filters?.year) {
      conditions.push('publish_year = ?');
      params.push(filters.year);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = resolveOrderBy(
      sort,
      {
        title_asc: 'title ASC, id DESC',
        author_asc: 'author ASC, title ASC, id DESC',
        year_desc: 'publish_year DESC, id DESC',
        status: 'status ASC, title ASC, id DESC',
        code_asc: 'book_code ASC, id DESC',
      },
      'id DESC',
    );
    const [countRows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM books ${where}`, params);
    const total = Number(countRows[0].total);
    const offset = (page - 1) * limit;
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM books ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return { books: rows.map(mapRow), total };
  }

  /** Tìm sách theo qr_code trước, không có thì thử book_code (cả 2 định dạng cùng tồn tại). */
  async findByQrCodeOrBookCode(code: string, conn: DbConn = pool): Promise<Book | null> {
    const c = code.trim();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM books WHERE qr_code = ? OR book_code = ? LIMIT 1',
      [c, c.toUpperCase()],
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  /** Số thứ tự lớn nhất hiện có của 1 đầu mã thể loại (vd VH -> 12 nghĩa là đã có VH-0012). */
  async maxCodeSeq(catCode: string, conn: DbConn = pool): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT book_code FROM books WHERE book_code LIKE ?`,
      [`${catCode}-%`],
    );
    let max = 0;
    const prefix = `${catCode}-`;
    for (const r of rows) {
      const code = String(r.book_code ?? '');
      if (code.startsWith(prefix)) {
        const n = parseInt(code.slice(prefix.length), 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    }
    return max;
  }

  async bookCodeExists(code: string, conn: DbConn = pool): Promise<boolean> {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT 1 FROM books WHERE book_code = ? LIMIT 1',
      [code],
    );
    return rows.length > 0;
  }

  /** Danh sách NXB (distinct) cho dropdown lọc nâng cao. */
  async listPublishers(conn: DbConn = pool): Promise<string[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT DISTINCT publisher FROM books WHERE publisher IS NOT NULL AND publisher <> '' ORDER BY publisher ASC`,
    );
    return rows.map((r) => r.publisher as string);
  }
}
