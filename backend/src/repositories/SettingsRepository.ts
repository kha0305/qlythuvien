import { RowDataPacket } from 'mysql2/promise';
import { DbConn, pool } from '../db/pool';
import { Settings } from '../entities/Settings';

export class SettingsRepository {
  // Bảng settings chỉ có 1 dòng (id = 1).
  async get(conn: DbConn = pool): Promise<Settings> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    if (rows.length === 0) {
      return new Settings({});
    }
    const row = rows[0];
    return new Settings({
      id: row.id,
      loanDays: Number(row.loan_days),
      finePerDay: Number(row.fine_per_day),
      maxBooksPerReader: Number(row.max_books_per_reader),
      reservationHours: Number(row.reservation_hours),
    });
  }

  async update(
    fields: { loanDays?: number; finePerDay?: number; maxBooksPerReader?: number; reservationHours?: number },
    conn: DbConn = pool,
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.loanDays !== undefined) { sets.push('loan_days = ?'); params.push(fields.loanDays); }
    if (fields.finePerDay !== undefined) { sets.push('fine_per_day = ?'); params.push(fields.finePerDay); }
    if (fields.maxBooksPerReader !== undefined) { sets.push('max_books_per_reader = ?'); params.push(fields.maxBooksPerReader); }
    if (fields.reservationHours !== undefined) { sets.push('reservation_hours = ?'); params.push(fields.reservationHours); }
    if (sets.length === 0) return;
    await conn.query(`UPDATE settings SET ${sets.join(', ')} WHERE id = 1`, params);
  }
}
