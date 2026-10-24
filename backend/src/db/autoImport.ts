import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config';
import { BookService } from '../services/BookService';

/**
 * Tự nạp dữ liệu khi deploy lên host (AUTO_IMPORT_DB=true):
 * - Database chưa có bảng users -> chạy file db/full-reset.sql (schema + data mẫu)
 *   nằm ở ../db/full-reset.sql tính từ thư mục backend (src hoặc dist đều đúng).
 * - Sau đó sinh book_code cho sách mẫu bằng đúng logic của app (BookService.syncBookCodes).
 * - Database đã có bảng -> bỏ qua, không động vào dữ liệu hiện tại.
 * Lỗi kết nối được thử lại nhiều lần (server DB trên host có thể khởi động chậm hơn app).
 */
export async function autoImportIfNeeded(): Promise<void> {
  if (!config.autoImportDb) return;

  const sqlPath = path.join(__dirname, '..', '..', 'db', 'full-reset.sql');
  const attempts = 10;

  for (let i = 1; i <= attempts; i++) {
    let conn: mysql.Connection | null = null;
    try {
      conn = await mysql.createConnection({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        multipleStatements: true,
        ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
      });

      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
        [config.db.database],
      );
      if (Number(rows[0]?.cnt ?? 0) > 0) {
        console.log('[auto-import] Database đã có dữ liệu, bỏ qua.');
        await conn.end();
        return;
      }

      if (!fs.existsSync(sqlPath)) {
        console.error(`[auto-import] Không tìm thấy file SQL: ${sqlPath}`);
        await conn.end();
        return;
      }

      const sql = fs.readFileSync(sqlPath, 'utf8');
      await conn.query(sql);
      await conn.end();
      conn = null;
      console.log('[auto-import] Đã nạp schema + dữ liệu mẫu xong.');

      const count = await new BookService().syncBookCodes();
      console.log(`[auto-import] Đã sinh mã sách cho ${count} cuốn.`);
      return;
    } catch (err) {
      if (conn) {
        try { await conn.end(); } catch { /* bỏ qua lỗi đóng kết nối */ }
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (i === attempts) {
        console.error(`[auto-import] Thất bại sau ${attempts} lần thử: ${msg}`);
        return;
      }
      console.log(`[auto-import] Chưa kết nối được DB (lần ${i}/${attempts}): ${msg}. Thử lại sau 3 giây...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
