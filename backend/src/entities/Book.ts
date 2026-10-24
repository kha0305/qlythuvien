export type BookStatus = 'available' | 'borrowed';

export class Book {
  id: number;
  qrCode: string;
  /** Mã hiển thị đọc được, vd VH-0001. Sách mới: qr_code = book_code. Sách cũ: NULL. */
  bookCode: string | null;
  title: string;
  author: string | null;
  category: string | null;
  publisher: string | null;
  publishYear: number | null;
  coverUrl: string | null;
  status: BookStatus;

  constructor(data: {
    id: number;
    qrCode: string;
    bookCode?: string | null;
    title: string;
    author?: string | null;
    category?: string | null;
    publisher?: string | null;
    publishYear?: number | null;
    coverUrl?: string | null;
    status?: BookStatus;
  }) {
    this.id = data.id;
    this.qrCode = data.qrCode;
    this.bookCode = data.bookCode ?? null;
    this.title = data.title;
    this.author = data.author ?? null;
    this.category = data.category ?? null;
    this.publisher = data.publisher ?? null;
    this.publishYear = data.publishYear ?? null;
    this.coverUrl = data.coverUrl ?? null;
    this.status = data.status ?? 'available';
  }

  isAvailable(): boolean {
    return this.status === 'available';
  }
}
