// Kiểu dữ liệu dùng chung cho frontend, ánh xạ từ response của backend.
// Một số endpoint có thể trả về snake_case (theo schema DB) hoặc camelCase,
// các hàm normalize_* xử lý cả hai dạng để frontend không bị vỡ.

/**
 * Backend gói response dạng { data: <dto> } (axios đã bóc 1 lớp body).
 * Hàm này bóc tiếp 1 lớp để lấy dto; nếu body không có dạng đó thì trả nguyên.
 * Chỉ dùng cho endpoint trả về 1 object (không dùng cho endpoint phân trang).
 */
export function unwrapData<T>(body: unknown): T {
  const r = (body ?? {}) as Record<string, unknown>;
  const inner = r['data'];
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as T;
  }
  return body as T;
}

export type Role = 'admin' | 'librarian' | 'reader';
export type BookStatus = 'available' | 'borrowed';
export type LoanStatus = 'borrowing' | 'returned';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  studentCode?: string | null;
  phone?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  avatarUrl?: string | null;
  active?: number | boolean;
}

export interface Book {
  id: number;
  qrCode: string;
  /** Mã hiển thị đọc được, vd VH-0001 (null với sách cũ chưa đồng bộ) */
  bookCode?: string | null;
  title: string;
  author?: string | null;
  category?: string | null;
  publisher?: string | null;
  publishYear?: number | null;
  status: BookStatus;
  /** true khi sách đang có lượt đặt trước còn hiệu lực */
  hasActiveReservation?: boolean;
  /** Đường dẫn ảnh bìa (/uploads/covers/...), null nếu chưa có */
  coverUrl?: string | null;
  /** Số bản của đầu sách (chỉ có ở API public chi tiết) */
  totalCopies?: number;
  availableCopies?: number;
  /** Từng cuốn vật lý cùng đầu sách (API chi tiết / grouped) */
  copies?: Book[];
}

/**
 * 1 đầu sách gom nhóm cho trang chủ (GET /api/public/books/grouped):
 * 1 thẻ / tựa + tác giả, kèm danh sách từng cuốn vật lý để mượn/đặt trước/QR.
 * coverUrl lấy từ cuốn đầu tiên trong nhóm đã có bìa thật (null nếu không có).
 */
export interface BookGroup {
  title: string;
  author?: string | null;
  category?: string | null;
  publisher?: string | null;
  publishYear?: number | null;
  coverUrl?: string | null;
  totalCopies: number;
  availableCopies: number;
  representativeId: number;
  copies: Book[];
}

/** Trạng thái hiển thị của 1 bản sách: còn / đang giữ chỗ (có đặt trước hiệu lực) / đang mượn. */
export type BookAvailability = 'available' | 'reserved' | 'borrowed';

export function bookAvailability(book: Book): BookAvailability {
  if (book.status === 'borrowed') return 'borrowed';
  if (book.hasActiveReservation) return 'reserved';
  return 'available';
}

export interface Loan {
  id: number;
  status: LoanStatus;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string | null;
  fineAmount: number;
  bookId: number;
  readerId: number;
  book: Book;
  reader: User;
  /** có ở endpoint /api/loans/overdue */
  overdueDays?: number;
  expectedFine?: number;
}

export type ReservationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'fulfilled'
  | 'cancelled'
  | 'expired';

export interface Reservation {
  id: number;
  bookId: number;
  readerId: number;
  reservedAt: string;
  expiresAt: string;
  status: ReservationStatus;
  /** số giờ giữ còn lại, do backend tính */
  remainingHours?: number | null;
  readerNote?: string | null;
  pickupAt?: string | null;
  reviewedAt?: string | null;
  rejectReason?: string | null;
  /** Mã QR đặt trước (8 ký tự), hiện QR khi đã duyệt */
  code?: string | null;
  book?: Book;
  reader?: { id: number; fullName: string; studentCode?: string | null; phone?: string | null };
}

export interface DashboardStats {
  totalBooks: number;
  borrowing: number;
  overdue: number;
  totalReaders: number;
  topBooks: { title: string; count: number }[];
}

export interface Settings {
  loanDays: number;
  finePerDay: number;
  maxBooksPerReader: number;
  reservationHours: number;
}

export interface PageResult<T> {
  data: T[];
  total: number;
}

function pick<T>(raw: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeUser(raw: unknown): User {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: toNum(pick(r, 'id')),
    username: String(pick(r, 'username') ?? ''),
    fullName: String(pick(r, 'fullName', 'full_name') ?? ''),
    role: (pick(r, 'role') as Role) ?? 'reader',
    studentCode: (pick(r, 'studentCode', 'student_code') as string | null) ?? null,
    phone: (pick(r, 'phone') as string | null) ?? null,
    email: (pick(r, 'email') as string | null) ?? null,
    emailVerified: Boolean(pick(r, 'emailVerified', 'email_verified')),
    avatarUrl: (pick(r, 'avatarUrl', 'avatar_url') as string | null) ?? null,
    active: (pick(r, 'active') as number | boolean | undefined) ?? 1,
  };
}

export function normalizeBook(raw: unknown): Book {
  const r = (raw ?? {}) as Record<string, unknown>;
  const statusRaw = String(pick(r, 'status') ?? 'available');
  return {
    id: toNum(pick(r, 'id')),
    qrCode: String(pick(r, 'qrCode', 'qr_code') ?? ''),
    bookCode: (pick(r, 'bookCode', 'book_code') as string | null) ?? null,
    title: String(pick(r, 'title') ?? ''),
    author: (pick(r, 'author') as string | null) ?? null,
    category: (pick(r, 'category') as string | null) ?? null,
    publisher: (pick(r, 'publisher') as string | null) ?? null,
    publishYear: (() => {
      const v = pick(r, 'publishYear', 'publish_year');
      return v === undefined || v === null || v === '' ? null : toNum(v);
    })(),
    status: (statusRaw === 'borrowed' ? 'borrowed' : 'available') as BookStatus,
    hasActiveReservation: Boolean(
      pick(r, 'hasActiveReservation', 'has_active_reservation', 'reserved', 'isReserved')
    ),
    coverUrl: (pick(r, 'coverUrl', 'cover_url') as string | null) ?? null,
    totalCopies: (() => {
      const v = pick(r, 'totalCopies', 'total_copies');
      return v === undefined || v === null || v === '' ? undefined : toNum(v);
    })(),
    availableCopies: (() => {
      const v = pick(r, 'availableCopies', 'available_copies');
      return v === undefined || v === null || v === '' ? undefined : toNum(v);
    })(),
    copies: Array.isArray(r.copies) ? (r.copies as unknown[]).map((c) => normalizeBook(c)) : undefined,
  };
}

export function normalizeLoan(raw: unknown): Loan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bookRaw = pick(r, 'book');
  const readerRaw = pick(r, 'reader');
  const book = bookRaw ? normalizeBook(bookRaw) : normalizeBook({
    id: pick(r, 'bookId', 'book_id'),
    title: pick(r, 'bookTitle', 'book_title'),
    qrCode: pick(r, 'bookQrCode', 'book_qr_code'),
    author: pick(r, 'bookAuthor', 'book_author'),
  });
  const reader = readerRaw ? normalizeUser(readerRaw) : normalizeUser({
    id: pick(r, 'readerId', 'reader_id'),
    fullName: pick(r, 'readerName', 'reader_name', 'fullName', 'full_name'),
    phone: pick(r, 'readerPhone', 'reader_phone', 'phone'),
    username: pick(r, 'readerUsername', 'reader_username', 'username'),
  });
  return {
    id: toNum(pick(r, 'id')),
    status: ((pick(r, 'status') as string) ?? 'borrowing') as LoanStatus,
    borrowedAt: String(pick(r, 'borrowedAt', 'borrowed_at') ?? ''),
    dueAt: String(pick(r, 'dueAt', 'due_at') ?? ''),
    returnedAt: (pick(r, 'returnedAt', 'returned_at') as string | null) ?? null,
    fineAmount: toNum(pick(r, 'fineAmount', 'fine_amount')),
    bookId: toNum(pick(r, 'bookId', 'book_id', 'book.id')),
    readerId: toNum(pick(r, 'readerId', 'reader_id', 'reader.id')),
    book,
    reader,
    overdueDays: (() => {
      const v = pick(r, 'overdueDays', 'overdue_days');
      return v === undefined || v === null ? undefined : toNum(v);
    })(),
    expectedFine: (() => {
      const v = pick(r, 'expectedFine', 'expected_fine');
      return v === undefined || v === null ? undefined : toNum(v);
    })(),
  };
}

export function normalizeReservation(raw: unknown): Reservation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bookRaw = pick(r, 'book');
  return {
    id: toNum(pick(r, 'id')),
    bookId: toNum(pick(r, 'bookId', 'book_id')),
    readerId: toNum(pick(r, 'readerId', 'reader_id')),
    reservedAt: String(pick(r, 'reservedAt', 'reserved_at') ?? ''),
    expiresAt: String(pick(r, 'expiresAt', 'expires_at') ?? ''),
    status: ((pick(r, 'status') as string) ?? 'pending') as Reservation['status'],
    readerNote: (pick(r, 'readerNote', 'reader_note') as string | null) ?? null,
    pickupAt: (pick(r, 'pickupAt', 'pickup_at') as string | null) ?? null,
    reviewedAt: (pick(r, 'reviewedAt', 'reviewed_at') as string | null) ?? null,
    rejectReason: (pick(r, 'rejectReason', 'reject_reason') as string | null) ?? null,
    code: (pick(r, 'code') as string | null) ?? null,
    reader: (() => {
      const u = pick(r, 'reader') as Record<string, unknown> | undefined;
      if (!u) return undefined;
      return {
        id: toNum(pick(u, 'id')),
        fullName: String(pick(u, 'fullName', 'full_name') ?? ''),
        studentCode: (pick(u, 'studentCode', 'student_code') as string | null) ?? null,
        phone: (pick(u, 'phone') as string | null) ?? null,
      };
    })(),
    remainingHours: (() => {
      const v = pick(r, 'remainingHours', 'remaining_hours');
      if (v !== undefined && v !== null) return Number(v);
      const ms = pick(r, 'remainingMs', 'remaining_ms');
      if (ms !== undefined && ms !== null) return Math.max(0, Number(ms) / 3600000);
      const exp = pick(r, 'expiresAt', 'expires_at');
      if (exp) return Math.max(0, (new Date(String(exp)).getTime() - Date.now()) / 3600000);
      return undefined;
    })(),
    book: bookRaw ? normalizeBook(bookRaw) : undefined,
  };
}

/** Loại thông báo -> màu sắc hiển thị. */
export type NotificationType = 'reservation' | 'loan' | 'overdue' | 'general' | 'system';

export type NotificationAudience = 'all' | 'readers' | 'librarians';

export interface NotificationItem {
  id: number;
  audience: NotificationAudience;
  type: NotificationType;
  title: string;
  body?: string | null;
  showOnLanding: boolean;
  createdAt: string;
  isRead: boolean;
}

export function normalizeNotification(raw: unknown): NotificationItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: toNum(pick(r, 'id')),
    audience: (pick(r, 'audience') as NotificationAudience) ?? 'all',
    type: (pick(r, 'type') as NotificationType) ?? 'general',
    title: String(pick(r, 'title') ?? ''),
    body: (pick(r, 'body') as string | null) ?? null,
    showOnLanding: Boolean(pick(r, 'showOnLanding', 'show_on_landing')),
    createdAt: String(pick(r, 'createdAt', 'created_at') ?? ''),
    isRead: Boolean(pick(r, 'isRead', 'is_read')),
  };
}

export interface Category {
  id: number;
  name: string;
  code: string;
}

export function normalizeCategory(raw: unknown): Category {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: toNum(pick(r, 'id')),
    name: String(pick(r, 'name') ?? ''),
    code: String(pick(r, 'code') ?? ''),
  };
}

export interface Announcement {
  id: number;
  title: string;
  body?: string | null;
  createdAt: string;
}

export function normalizeAnnouncement(raw: unknown): Announcement {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: toNum(pick(r, 'id')),
    title: String(pick(r, 'title') ?? ''),
    body: (pick(r, 'body') as string | null) ?? null,
    createdAt: String(pick(r, 'createdAt', 'created_at') ?? ''),
  };
}

export function normalizeSettings(raw: unknown): Settings {  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    loanDays: toNum(pick(r, 'loanDays', 'loan_days'), 14),
    finePerDay: toNum(pick(r, 'finePerDay', 'fine_per_day'), 5000),
    maxBooksPerReader: toNum(pick(r, 'maxBooksPerReader', 'max_books_per_reader'), 5),
    reservationHours: toNum(pick(r, 'reservationHours', 'reservation_hours'), 48),
  };
}

export function normalizePage<T>(raw: unknown, fn: (x: unknown) => T): PageResult<T> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = (pick(r, 'data', 'items', 'rows') ?? []) as unknown[];
  const arr = Array.isArray(list) ? list : [];
  return {
    data: arr.map(fn),
    total: toNum(pick(r, 'total', 'count'), arr.length),
  };
}

/** So sánh mã QR không phân biệt hoa thường (UUID hex 32 ký tự). */
export function sameQr(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Số ngày trễ theo D6: CEIL((NOW - due_at) / 86400), âm thì = 0. */
export function calcOverdueDays(dueAt: string | Date): number {
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(0, Math.ceil((Date.now() - due.getTime()) / 86400000));
}
