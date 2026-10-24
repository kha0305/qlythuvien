// UC17: logic thuần lập kế hoạch gửi email nhắc hạn (tách riêng để unit test).
// - due_soon: sách sắp đến hạn (còn <= 48 giờ, chưa qua hạn) -> gửi 1 lần duy nhất mỗi phiếu.
// - overdue: đã quá hạn -> gửi lần đầu ngay khi phát hiện, sau đó mỗi 3 ngày 1 lần.
// - Phiếu không có email độc giả -> bỏ qua (không có nơi gửi).

export type EmailReminderType = 'due_soon' | 'overdue';

export interface ReminderLoanInput {
  loanId: number;
  status: 'borrowing' | 'returned';
  dueAt: Date;
  readerEmail: string | null;
}

export interface PlannedReminder {
  loanId: number;
  type: EmailReminderType;
  overdueDays: number; // 0 với due_soon
}

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const DUE_SOON_WINDOW_MS = 48 * HOUR_MS;
export const OVERDUE_REPEAT_MS = 3 * DAY_MS;

export function planReminders(
  loans: ReminderLoanInput[],
  lastSent: Map<string, Date>,
  now: Date,
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (const loan of loans) {
    if (loan.status !== 'borrowing' || !loan.readerEmail) continue;
    const diff = loan.dueAt.getTime() - now.getTime();
    if (diff < 0) {
      const overdueDays = Math.max(1, Math.ceil(-diff / DAY_MS));
      const last = lastSent.get(`${loan.loanId}:overdue`);
      if (!last || now.getTime() - last.getTime() >= OVERDUE_REPEAT_MS) {
        planned.push({ loanId: loan.loanId, type: 'overdue', overdueDays });
      }
    } else if (diff <= DUE_SOON_WINDOW_MS) {
      const last = lastSent.get(`${loan.loanId}:due_soon`);
      if (!last) {
        planned.push({ loanId: loan.loanId, type: 'due_soon', overdueDays: 0 });
      }
    }
  }
  return planned;
}
