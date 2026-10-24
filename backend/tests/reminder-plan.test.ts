/**
 * Test logic thuần cho UC17 (lập kế hoạch email nhắc hạn).
 * Chạy: npx tsx tests/reminder-plan.test.ts  (từ thư mục backend)
 */
import { planReminders, ReminderLoanInput } from '../src/utils/reminderPlan';

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const NOW = new Date('2026-10-23T08:00:00');
const H = 3600 * 1000;
const D = 24 * H;

function loan(partial: Partial<ReminderLoanInput>): ReminderLoanInput {
  return {
    loanId: 1,
    status: 'borrowing',
    dueAt: new Date(NOW.getTime() + 10 * D),
    readerEmail: 'docgia@example.com',
    ...partial,
  };
}
const none = new Map<string, Date>();

// Sắp đến hạn trong 48h, chưa gửi -> due_soon
check('due in 24h -> due_soon', planReminders([loan({ dueAt: new Date(NOW.getTime() + 24 * H) })], none, NOW),
  [{ loanId: 1, type: 'due_soon', overdueDays: 0 }]);
// Còn 72h -> không nhắc
check('due in 72h -> none', planReminders([loan({ dueAt: new Date(NOW.getTime() + 72 * H) })], none, NOW), []);
// Sắp đến hạn nhưng đã gửi due_soon rồi -> không gửi lại
check('due_soon already sent -> none',
  planReminders([loan({ dueAt: new Date(NOW.getTime() + 24 * H) })], new Map([['1:due_soon', new Date(NOW.getTime() - 5 * H)]]), NOW), []);
// Quá hạn 1 ngày, chưa gửi -> overdue 1
check('overdue 1d never sent -> overdue', planReminders([loan({ dueAt: new Date(NOW.getTime() - 1 * D) })], none, NOW),
  [{ loanId: 1, type: 'overdue', overdueDays: 1 }]);
// Quá hạn, mới gửi hôm qua -> chưa gửi lại (cần 3 ngày)
check('overdue sent 1d ago -> none',
  planReminders([loan({ dueAt: new Date(NOW.getTime() - 2 * D) })], new Map([['1:overdue', new Date(NOW.getTime() - 1 * D)]]), NOW), []);
// Quá hạn, gửi cách đây 4 ngày -> gửi lại
check('overdue sent 4d ago -> send again', planReminders([loan({ dueAt: new Date(NOW.getTime() - 6 * D) })], new Map([['1:overdue', new Date(NOW.getTime() - 4 * D)]]), NOW),
  [{ loanId: 1, type: 'overdue', overdueDays: 6 }]);
// Đã trả -> không nhắc dù quá hạn
check('returned -> none', planReminders([loan({ status: 'returned', dueAt: new Date(NOW.getTime() - 3 * D) })], none, NOW), []);
// Không có email -> bỏ qua
check('no email -> none', planReminders([loan({ readerEmail: null, dueAt: new Date(NOW.getTime() - 3 * D) })], none, NOW), []);
// Quá hạn 25 giờ -> làm tròn lên 2 ngày (khớp cách tính phạt D6)
check('overdue 25h -> 2 days', planReminders([loan({ dueAt: new Date(NOW.getTime() - 25 * H) })], none, NOW),
  [{ loanId: 1, type: 'overdue', overdueDays: 2 }]);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
