/**
 * Test logic thuần (không cần DB): kiểm chứng D6, D7, D11, D5.
 * Chạy: npx tsx tests/logic.test.ts  (từ thư mục backend)
 */
import { Loan } from '../src/entities/Loan';
import { Reservation } from '../src/entities/Reservation';
import { Book } from '../src/entities/Book';
import { User } from '../src/entities/User';

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}: expected ${expected}, got ${actual}`);
  }
}

const book = new Book({ id: 1, qrCode: 'a'.repeat(32), title: 'Sach mau', status: 'borrowed' });
const reader = new User({ id: 2, username: 'docgia', passwordHash: 'x', fullName: 'Doc Gia', role: 'reader' });

function makeLoan(dueAt: Date, status: 'borrowing' | 'returned' = 'borrowing'): Loan {
  return new Loan({
    id: 1, book, reader,
    borrowedAt: new Date(dueAt.getTime() - 14 * 86400 * 1000),
    dueAt, status,
  });
}

const now = new Date();

// D6: trễ 3 ngày -> 3
check('D6 trễ 3 ngày', makeLoan(new Date(now.getTime() - 3 * 86400 * 1000)).calcOverdueDays(now), 3);
// D6: trễ 3 ngày + 1 giây -> CEIL = 4
check('D6 trễ 3 ngày 1 giây -> 4', makeLoan(new Date(now.getTime() - (3 * 86400 + 1) * 1000)).calcOverdueDays(now), 4);
// D6: đúng hạn (tương lai) -> 0
check('D6 chưa đến hạn -> 0', makeLoan(new Date(now.getTime() + 86400 * 1000)).calcOverdueDays(now), 0);
// D6: đúng giờ hạn -> 0
check('D6 đúng giờ hạn -> 0', makeLoan(new Date(now.getTime())).calcOverdueDays(now), 0);

// D7: 3 ngày * 5000 = 15000
check('D7 phạt 3 ngày', makeLoan(new Date(now.getTime() - 3 * 86400 * 1000)).calcFine(5000, now), 15000);
// D7: đúng hạn -> 0
check('D7 đúng hạn -> 0', makeLoan(new Date(now.getTime() + 86400 * 1000)).calcFine(5000, now), 0);
// D7: mức phạt mới (7000) áp dụng lúc trả
check('D7 mức phạt 7000', makeLoan(new Date(now.getTime() - 2 * 86400 * 1000)).calcFine(7000, now), 14000);

// D5: quá hạn tính động
check('D5 borrowing + due qua -> overdue', makeLoan(new Date(now.getTime() - 1000)).isOverdue(now), true);
check('D5 borrowing + due tuong lai -> không', makeLoan(new Date(now.getTime() + 1000)).isOverdue(now), false);
check('D5 returned + due qua -> không', makeLoan(new Date(now.getTime() - 1000), 'returned').isOverdue(now), false);

// D11: đặt trước hết hạn sau 48h
function makeRes(hoursAgo: number, status: 'pending' | 'fulfilled' | 'cancelled' = 'pending'): Reservation {
  const reservedAt = new Date(now.getTime() - hoursAgo * 3600 * 1000);
  return new Reservation({
    id: 1, book, reader, reservedAt,
    expiresAt: new Date(reservedAt.getTime() + 48 * 3600 * 1000), status,
  });
}
check('D11 dat 49h truoc -> het han', makeRes(49).isExpired(now), true);
check('D11 dat 47h truoc -> con hieu luc', makeRes(47).isActive(now), true);
check('D11 dat 49h truoc -> không active', makeRes(49).isActive(now), false);
check('D11 fulfilled thi không het han', makeRes(100, 'fulfilled').isExpired(now), false);
check('D11 cancelled thi không active', makeRes(1, 'cancelled').isActive(now), false);

console.log(`\n${passed} pass, ${failed} fail`);
process.exit(failed === 0 ? 0 : 1);
