import { RowDataPacket } from 'mysql2/promise';
import { pool } from './pool';

// UC17-UC19: đảm bảo schema email tồn tại mà không cần chạy SQL tay khi nâng cấp DB cũ.
// - users.email / users.email_verified: thêm nếu chưa có (kiểm tra INFORMATION_SCHEMA,
//   tương thích cả MySQL lẫn MariaDB).
// - email_tokens / email_reminders: CREATE TABLE IF NOT EXISTS.
let ensured = false;

export async function ensureEmailSchema(): Promise<void> {
  if (ensured) return;
  ensured = true;
  try {
    const [cols] = await pool.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
          AND COLUMN_NAME IN ('email', 'email_verified')`,
    );
    const existing = new Set(cols.map((c) => String(c.COLUMN_NAME)));
    if (!existing.has('email')) {
      await pool.query('ALTER TABLE users ADD COLUMN email VARCHAR(150) NULL AFTER phone');
    }
    if (!existing.has('email_verified')) {
      await pool.query(
        'ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER email',
      );
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_tokens (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        purpose     ENUM('verify_email','reset_password') NOT NULL,
        token_hash  CHAR(64) NOT NULL COMMENT 'SHA-256 của token, không lưu token thô',
        expires_at  DATETIME NOT NULL,
        used_at     DATETIME NULL COMMENT 'NULL = chưa dùng',
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_etokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_etokens_user_purpose (user_id, purpose),
        INDEX idx_etokens_hash (token_hash)
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_reminders (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        loan_id         INT NOT NULL,
        type            ENUM('due_soon','overdue') NOT NULL,
        recipient_email VARCHAR(150) NOT NULL,
        provider_id     VARCHAR(100) NULL COMMENT 'id email phía Resend',
        sent_day        DATE NOT NULL COMMENT 'ngày gửi (chống gửi trùng cùng ngày)',
        sent_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ereminders_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
        UNIQUE KEY uq_ereminder (loan_id, type, sent_day),
        INDEX idx_ereminder_loan (loan_id, type)
      ) ENGINE=InnoDB
    `);
  } catch (err) {
    // Không chặn khởi động app vì lỗi schema email; tính năng email sẽ báo lỗi khi chạy.
    console.error('[email] Không đảm bảo được schema email:', err);
  }
}

/**
 * Ảnh đại diện (23/10/2026): thêm cột users.avatar_url nếu chưa có
 * (cùng cơ chế tự nâng cấp lúc khởi động như email, không cần chạy SQL tay).
 */
export async function ensureAvatarSchema(): Promise<void> {
  const [cols] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'`,
  );
  if (cols.length === 0) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL COMMENT 'Đường dẫn ảnh đại diện (/uploads/avatars/...)' AFTER email_verified",
    );
  }
}
