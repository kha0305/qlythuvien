import { api } from './client';
import { getSettings } from './settings';
import {
  calcOverdueDays,
  normalizeLoan,
  normalizePage,
  sameQr,
  unwrapData,
  type Loan,
  type PageResult,
} from './types';

export interface BorrowResult {
  loan: Loan;
  /** hạn trả đã được backend tính theo settings hiện hành */
  dueAt: string;
}

export interface ReturnPreview {
  loan: Loan;
  overdueDays: number;
  fine: number;
}

export interface ReturnResult {
  loan: Loan;
  overdueDays: number;
  fine: number;
}

export interface LoanFilters {
  status?: '' | 'borrowing' | 'returned';
  readerId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

/** UC04: mượn sách. Backend kiểm tra đặt trước theo D13. */
export async function borrowBook(qrCode: string, readerId: number): Promise<BorrowResult> {
  const { data } = await api.post('/loans/borrow', { qrCode, readerId });
  const body = unwrapData<Record<string, unknown>>(data);
  const loan = normalizeLoan((body.loan ?? body) as unknown);
  return { loan, dueAt: loan.dueAt };
}

function toReturnPayload(raw: unknown): ReturnPreview {
  const body = unwrapData<Record<string, unknown>>(raw);
  const r = body;
  const loan = normalizeLoan(((r as Record<string, unknown>).loan ?? r) as unknown);
  const num = (v: unknown): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
  const overdueDays = num(r.overdueDays ?? r.overdue_days);
  const fine = num(r.fine ?? r.estimatedFine ?? r.estimated_fine ?? r.fineAmount ?? r.fine_amount);
  return { loan, overdueDays, fine };
}

/**
 * UC05 bước 1: xem trước phiếu trả + phạt dự kiến.
 * Ưu tiên endpoint GET /api/loans/return-preview?qrCode=... (backend tách 2 bước);
 * nếu endpoint chưa có, tự suy ra từ danh sách phiếu borrowing.
 */
export async function previewReturn(qrCode: string): Promise<ReturnPreview> {
  try {
    const { data } = await api.get('/loans/return-preview', { params: { qrCode } });
    return toReturnPayload(data);
  } catch (err) {
    // Fallback: tìm trong danh sách phiếu đang mượn khi backend chưa có endpoint preview.
    const page = await listLoans({ status: 'borrowing', pageSize: 1000 });
    const found = page.data.find((l) => sameQr(l.book.qrCode, qrCode));
    if (found) {
      const overdueDays = calcOverdueDays(found.dueAt);
      const settings = await getSettings();
      return { loan: found, overdueDays, fine: overdueDays * settings.finePerDay };
    }
    throw err;
  }
}

/** UC05 bước 2: xác nhận trả sách, chốt fine_amount. Backend cần loanId (lấy từ preview). */
export async function returnBook(loanId: number): Promise<ReturnResult> {
  const { data } = await api.post('/loans/return', { loanId });
  return toReturnPayload(data);
}

/** UC06: danh sách quá hạn, backend đã sắp xếp theo số ngày trễ giảm dần. */
export async function listOverdue(sort?: string): Promise<Loan[]> {
  const { data } = await api.get('/loans/overdue', { params: sort ? { sort } : {} });
  const arr = Array.isArray(data) ? data : (data?.data ?? []);
  // Thứ tự do backend sắp xếp theo `sort` (mặc định: trễ nhiều nhất trước).
  return (Array.isArray(arr) ? arr : []).map(normalizeLoan);
}

/** UC07: lịch sử mượn/trả có lọc. */
export async function listLoans(filters: LoanFilters): Promise<PageResult<Loan>> {
  const { data } = await api.get('/loans', {
    params: {
      status: filters.status || undefined,
      readerId: filters.readerId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });
  if (Array.isArray(data)) {
    const loans = data.map(normalizeLoan);
    return { data: loans, total: loans.length };
  }
  return normalizePage(data, normalizeLoan);
}

/** UC08: phiếu mượn của chính độc giả đang đăng nhập. */
export async function myLoans(): Promise<Loan[]> {
  const { data } = await api.get('/loans/my');
  const arr = Array.isArray(data) ? data : (data?.data ?? []);
  return (Array.isArray(arr) ? arr : []).map(normalizeLoan);
}
