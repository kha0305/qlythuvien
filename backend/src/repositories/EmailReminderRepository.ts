import { RowDataPacket } from 'mysql2/promise';
import { DbConn, pool } from '../db/pool';
import { EmailReminderType } from '../utils/reminderPlan';

export class EmailReminderRepository {
  /** Lần gửi gần nhất cho từng (phiếu mượn, loại) — dùng để lập kế hoạch chống trùng. */
  async lastSentMap(loanIds: number[], conn: DbConn = pool): Promise<Map<string, Date>> {
    const map = new Map<string, Date>();
    if (loanIds.length === 0) return map;
    const placeholders = loanIds.map(() => '?').join(', ');
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT loan_id, type, MAX(sent_at) AS last_at FROM email_reminders
        WHERE loan_id IN (${placeholders}) GROUP BY loan_id, type`,
      loanIds,
    );
    for (const row of rows) {
      map.set(`${row.loan_id}:${row.type}`, new Date(row.last_at));
    }
    return map;
  }

  async record(
    loanId: number,
    type: EmailReminderType,
    recipientEmail: string,
    providerId: string | null,
    conn: DbConn = pool,
  ): Promise<void> {
    await conn.query(
      `INSERT INTO email_reminders (loan_id, type, recipient_email, provider_id, sent_day)
       VALUES (?, ?, ?, ?, CURDATE())
       ON DUPLICATE KEY UPDATE id = id`,
      [loanId, type, recipientEmail, providerId],
    );
  }
}
