import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DbConn, pool } from '../db/pool';

export interface Category {
  id: number;
  name: string;
  code: string;
}

export class CategoryRepository {
  async list(conn: DbConn = pool): Promise<Category[]> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT id, name, code FROM categories ORDER BY name ASC');
    return rows as Category[];
  }

  async findById(id: number, conn: DbConn = pool): Promise<Category | null> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT id, name, code FROM categories WHERE id = ?', [id]);
    return rows.length > 0 ? (rows[0] as Category) : null;
  }

  async findByName(name: string, conn: DbConn = pool): Promise<Category | null> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT id, name, code FROM categories WHERE name = ?', [name.trim()]);
    return rows.length > 0 ? (rows[0] as Category) : null;
  }

  async create(name: string, code: string, conn: DbConn = pool): Promise<Category> {
    const [result] = await conn.query<ResultSetHeader>('INSERT INTO categories (name, code) VALUES (?, ?)', [name.trim(), code.trim().toUpperCase()]);
    return { id: result.insertId, name: name.trim(), code: code.trim().toUpperCase() };
  }

  async update(id: number, name: string, code: string, conn: DbConn = pool): Promise<void> {
    await conn.query('UPDATE categories SET name = ?, code = ? WHERE id = ?', [name.trim(), code.trim().toUpperCase(), id]);
  }

  async delete(id: number, conn: DbConn = pool): Promise<void> {
    await conn.query('DELETE FROM categories WHERE id = ?', [id]);
  }

  /** Đếm số sách đang dùng thể loại này (để chặn xóa khi còn sách). */
  async countBooks(categoryName: string, conn: DbConn = pool): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM books WHERE category = ?', [categoryName]);
    return Number(rows[0].total);
  }
}
