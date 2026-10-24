import { Request, Response } from 'express';
import { LoanStatus } from '../entities/Loan';
import { LoanService } from '../services/LoanService';
import { NotificationService } from '../services/NotificationService';
import { toLoanDto } from '../utils/dto';

function formatDueDate(dueAt: Date): string {
  // dd/mm/yyyy hh:mm theo UC04 bước 7.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dueAt.getDate())}/${pad(dueAt.getMonth() + 1)}/${dueAt.getFullYear()} ${pad(dueAt.getHours())}:${pad(dueAt.getMinutes())}`;
}

export class LoanController {
  private readonly loanService: LoanService;
  private readonly notificationService = new NotificationService();

  constructor() {
    // Callback thông báo tự động (tránh vòng lặp phụ thuộc giữa các service).
    this.loanService = new LoanService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      (readerId, bookTitle, dueAt) => this.notificationService.notifyNewLoan(readerId, bookTitle, dueAt),
      (readerId, bookTitle, overdueDays) => this.notificationService.notifyOverdue(readerId, bookTitle, overdueDays),
    );
  }

  // POST /api/loans/borrow {qrCode, readerId}
  borrow = async (req: Request, res: Response): Promise<void> => {
    const { qrCode, readerId } = req.body as { qrCode?: string; readerId?: number };
    const loan = await this.loanService.borrowBook(qrCode ?? '', Number(readerId));
    res.status(201).json({
      data: toLoanDto(loan),
      message: `Mượn thành công, hạn trả: ${formatDueDate(loan.dueAt)}`,
    });
  };

  // GET /api/loans/return-preview?qrCode= — xem trước phiếu + trễ + phạt dự kiến, chưa chốt.
  previewReturn = async (req: Request, res: Response): Promise<void> => {
    const { loan, overdueDays, estimatedFine } = await this.loanService.previewReturn(
      (req.query.qrCode as string) ?? '',
    );
    res.json({ data: { ...toLoanDto(loan), overdueDays, estimatedFine } });
  };

  // POST /api/loans/return {loanId} — xác nhận trả, chốt phạt.
  returnBook = async (req: Request, res: Response): Promise<void> => {
    const { loanId } = req.body as { loanId?: number };
    if (!loanId) {
      res.status(400).json({ message: 'Thiếu mã phiếu mượn' });
      return;
    }
    const { loan, overdueDays, fineAmount } = await this.loanService.confirmReturn(Number(loanId));
    res.json({
      data: toLoanDto(loan),
      overdueDays,
      fineAmount,
      message: fineAmount > 0 ? `Trả thành công, phạt trễ ${overdueDays} ngày: ${fineAmount} đồng` : 'Trả thành công',
    });
  };

  // GET /api/loans?status=&readerId=&from=&to=&page= — đóng vai trò lịch sử mượn/trả (UC07).
  list = async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? req.query.pageSize) || 20));
    const status = req.query.status as LoanStatus | undefined;
    if (status && status !== 'borrowing' && status !== 'returned') {
      res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      return;
    }
    const { loans, total } = await this.loanService.getHistory({
      status,
      readerId: req.query.readerId ? Number(req.query.readerId) : undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      sort: req.query.sort as string | undefined,
      page,
      limit,
    });
    res.json({ data: loans.map(toLoanDto), page, limit, total });
  };

  // GET /api/loans/overdue
  overdue = async (req: Request, res: Response): Promise<void> => {
    const items = await this.loanService.listOverdue(req.query.sort as string | undefined);
    res.json({
      data: items.map(({ loan, overdueDays, estimatedFine }) => ({
        ...toLoanDto(loan),
        overdueDays,
        estimatedFine,
      })),
    });
  };

  // GET /api/loans/my — phiếu của chính độc giả đang đăng nhập (UC08).
  my = async (req: Request, res: Response): Promise<void> => {
    const items = await this.loanService.getReaderLoans(req.user!.id);
    res.json({
      data: items.map(({ loan, overdueDays, estimatedFine }) => ({
        ...toLoanDto(loan),
        overdueDays,
        estimatedFine,
      })),
    });
  };
}
