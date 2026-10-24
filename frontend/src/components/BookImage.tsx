import { fileUrl } from '../api/client';
import type { Book } from '../api/types';
import { BookCover } from './icons';

/**
 * Ảnh bìa sách: có coverUrl thì hiện <img> thật, không thì fallback
 * về BookCover SVG vẽ tay (không dùng ảnh AI).
 */
export function BookImage({ book, className }: { book: Book; className?: string }) {
  const src = fileUrl(book.coverUrl);
  if (src) {
    return <img src={src} alt={`Bìa sách ${book.title}`} className={className} loading="lazy" />;
  }
  return <BookCover title={book.title} category={book.category} className={className} />;
}
