import { RowDataPacket } from 'mysql2/promise';
import { DbConn, pool } from '../db/pool';

export type EmailTokenPurpose = 'verify_email' | 'reset_password';

export interface EmailTokenRow {
  id: number;
  userId: number;
  purpose: EmailTokenPurpose;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

function mapRow(row: RowDataPacket): EmailTokenRow {
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose as EmailTokenPurpose,
    expiresAt: new Date(row.expires_at),
    usedAt: row.used_at ? new Date(row.used_at) : null,
    createdAt: new Date(row.created_at),
  };
}

export class EmailTokenRepository {
  /** Tạo token mới; token cũ cùng mục đích của user bị vô hiệu hóa (chỉ 1 link sống tại 1 thời điểm). */
  async create(userId: number, purpose: EmailTokenPurpose, tokenHash: string, expiresAt: Date, conn: DbConn = pool): Promise<void> {
    await conn.query(
      'UPDATE email_tokens SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL',
      [userId, purpose],
    );
    await conn.query(
      'INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [userId, purpose, tokenHash, expiresAt],
    );
  }

  async findByHash(tokenHash: string, purpose: EmailTokenPurpose, conn: DbConn = pool): Promise<EmailTokenRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = ?',
      [tokenHash, purpose],
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async markUsed(id: number, conn: DbConn = pool): Promise<void> {
    await conn.query('UPDATE email_tokens SET used_at = NOW() WHERE id = ?', [id]);
  }

  /** Lần tạo token gần nhất (dùng để chặn gửi lại liên tục). */
  async lastCreatedAt(userId: number, purpose: EmailTokenPurpose, conn: DbConn = pool): Promise<Date | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT MAX(created_at) AS last_at FROM email_tokens WHERE user_id = ? AND purpose = ?',
      [userId, purpose],
    );
    return rows[0]?.last_at ? new Date(rows[0].last_at) : null;
  }
}
