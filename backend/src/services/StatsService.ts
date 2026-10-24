import ExcelJS from 'exceljs';
import { Book } from '../entities/Book';
import { BookRepository } from '../repositories/BookRepository';
import { LoanRepository, LoanFilters } from '../repositories/LoanRepository';
import { UserRepository } from '../repositories/UserRepository';
import { SettingsRepository } from '../repositories/SettingsRepository';

export interface TopBook {
  book: Book;
  borrowCount: number;
}

export interface DashboardStats {
  totalBooks: number;
  borrowing: number;
  overdue: number;
  totalReaders: number;
  topBooks: TopBook[];
}

// UC07: 4 thẻ số + top 5 sách mượn nhiều nhất.
export class StatsService {
  constructor(
    private readonly bookRepo = new BookRepository(),
    private readonly loanRepo = new LoanRepository(),
    private readonly userRepo = new UserRepository(),
    private readonly settingsRepo = new SettingsRepository(),
  ) {}

  /**
   * Xuất báo cáo Excel: 2 sheet "Muon tra" (chi tiết theo bộ lọc) + "Tong quan" (số liệu).
   * Filter giống trang Thống kê: status, readerId, from, to.
   */
  async exportExcel(filters: { status?: string; readerId?: number; from?: string; to?: string }): Promise<Buffer> {
    const settings = await this.settingsRepo.get();
    const stats = await this.getDashboard();
    const { loans } = await this.loanRepo.findByFilters({
      status: filters.status === 'borrowing' || filters.status === 'returned' ? filters.status : undefined,
      readerId: filters.readerId,
      from: filters.from,
      to: filters.to,
      page: 1,
      limit: 100000,
    } as LoanFilters);
    const now = new Date();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Thư viện Mini';

    // Sheet 1: chi tiết mượn/trả.
    const ws1 = wb.addWorksheet('Mượn trả');
    ws1.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Sách', key: 'book', width: 36 },
      { header: 'Độc giả', key: 'reader', width: 24 },
      { header: 'Ngày mượn', key: 'borrowed', width: 18 },
      { header: 'Hạn trả', key: 'due', width: 18 },
      { header: 'Ngày trả', key: 'returned', width: 18 },
      { header: 'Trạng thái', key: 'status', width: 14 },
      { header: 'Tiền phạt (đ)', key: 'fine', width: 16 },
    ];
    const fmt = (d: Date | null | undefined) =>
      d ? new Date(d).toLocaleString('vi-VN') : '';
    loans.forEach((loan, i) => {
      ws1.addRow({
        stt: i + 1,
        book: loan.book.title,
        reader: loan.reader.fullName,
        borrowed: fmt(loan.borrowedAt),
        due: fmt(loan.dueAt),
        returned: fmt(loan.returnedAt),
        status: loan.status === 'borrowing' ? 'Đang mượn' : 'Đã trả',
        fine: loan.status === 'borrowing' ? loan.calcFine(settings.finePerDay, now) : loan.fineAmount,
      });
    });
    ws1.getRow(1).font = { bold: true };

    // Sheet 2: số liệu tổng quan.
    const ws2 = wb.addWorksheet('Tổng quan');
    ws2.columns = [
      { header: 'Chỉ số', key: 'label', width: 30 },
      { header: 'Giá trị', key: 'value', width: 18 },
    ];
    const day = now.toLocaleDateString('vi-VN');
    [
      ['Ngày xuất báo cáo', day],
      ['Tổng số sách', stats.totalBooks],
      ['Đang cho mượn', stats.borrowing],
      ['Quá hạn', stats.overdue],
      ['Tổng độc giả', stats.totalReaders],
      ['Tổng số phiếu (theo lọc)', loans.length],
    ].forEach(([label, value]) => ws2.addRow({ label, value }));
    ws2.getRow(1).font = { bold: true };
    if (filters.from || filters.to) {
      ws2.addRow({ label: 'Khoảng thời gian', value: `${filters.from || '...'} → ${filters.to || '...'}` });
    }

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async getDashboard(): Promise<DashboardStats> {
    const { total: totalBooks } = await this.bookRepo.search(undefined, undefined, 1, 1);
    const [borrowing, overdue, totalReaders, topBooks] = await Promise.all([
      this.loanRepo.countByStatus('borrowing'),
      this.loanRepo.countOverdue(),
      this.userRepo.countByRole('reader'),
      this.loanRepo.topBorrowedBooks(5),
    ]);
    return { totalBooks, borrowing, overdue, totalReaders, topBooks };
  }
}
