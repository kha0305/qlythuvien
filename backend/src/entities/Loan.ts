import { Book } from './Book';
import { User } from './User';

export type LoanStatus = 'borrowing' | 'returned';

// Logic quá hạn / phạt chỉ viết 1 lần ở đây (D5, D6, D7, NFR03: tính on-demand, không cron).
export class Loan {
  id: number;
  book: Book;
  reader: User;
  borrowedAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
  fineAmount: number;
  status: LoanStatus;

  constructor(data: {
    id: number;
    book: Book;
    reader: User;
    borrowedAt: Date;
    dueAt: Date;
    returnedAt?: Date | null;
    fineAmount?: number;
    status?: LoanStatus;
  }) {
    this.id = data.id;
    this.book = data.book;
    this.reader = data.reader;
    this.borrowedAt = data.borrowedAt;
    this.dueAt = data.dueAt;
    this.returnedAt = data.returnedAt ?? null;
    this.fineAmount = data.fineAmount ?? 0;
    this.status = data.status ?? 'borrowing';
  }

  // D5: quá hạn = đang mượn VÀ due_at < now (tính động, không lưu DB).
  isOverdue(now: Date = new Date()): boolean {
    return this.status === 'borrowing' && this.dueAt.getTime() < now.getTime();
  }

  // D6: overdue_days = CEIL((now - due_at) / 86400); âm thì = 0.
  calcOverdueDays(now: Date = new Date()): number {
    const diffSeconds = (now.getTime() - this.dueAt.getTime()) / 1000;
    return Math.max(0, Math.ceil(diffSeconds / 86400));
  }

  // D7: fine = overdue_days * fine_per_day (mức hiện hành trong settings).
  calcFine(finePerDay: number, now: Date = new Date()): number {
    return this.calcOverdueDays(now) * finePerDay;
  }
}
