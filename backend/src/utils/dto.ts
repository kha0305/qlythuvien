import { Book } from '../entities/Book';
import { Loan } from '../entities/Loan';
import { Reservation } from '../entities/Reservation';
import { User } from '../entities/User';

// Chuyển entity thành JSON trả về client (không bao giờ để lộ password_hash).
export function toBookDto(book: Book) {
  return {
    id: book.id,
    qrCode: book.qrCode,
    bookCode: book.bookCode,
    title: book.title,
    author: book.author,
    category: book.category,
    publisher: book.publisher,
    publishYear: book.publishYear,
    coverUrl: book.coverUrl,
    status: book.status,
  };
}

// DTO public cho landing page: tuyệt đối KHÔNG trả qrCode / thông tin nhạy cảm.
// Ảnh bìa được phép hiện public.
export function toPublicBookDto(book: Book, hasActiveReservation = false) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    publisher: book.publisher,
    publishYear: book.publishYear,
    coverUrl: book.coverUrl,
    status: book.status,
    hasActiveReservation,
  };
}

export function toPublicUserDto(user: User) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    studentCode: user.studentCode,
    phone: user.phone,
    email: user.email,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    active: user.active,
  };
}

export function toLoanDto(loan: Loan) {
  return {
    id: loan.id,
    book: {
      id: loan.book.id,
      qrCode: loan.book.qrCode,
      title: loan.book.title,
      author: loan.book.author,
    },
    reader: {
      id: loan.reader.id,
      username: loan.reader.username,
      fullName: loan.reader.fullName,
      studentCode: loan.reader.studentCode,
      phone: loan.reader.phone,
    },
    borrowedAt: loan.borrowedAt,
    dueAt: loan.dueAt,
    returnedAt: loan.returnedAt,
    fineAmount: loan.fineAmount,
    status: loan.status,
  };
}

export function toReservationDto(reservation: Reservation) {
  return {
    id: reservation.id,
    book: {
      id: reservation.book.id,
      qrCode: reservation.book.qrCode,
      title: reservation.book.title,
      author: reservation.book.author,
    },
    reader: {
      id: reservation.reader.id,
      fullName: reservation.reader.fullName,
      studentCode: reservation.reader.studentCode,
      phone: reservation.reader.phone,
    },
    readerNote: reservation.readerNote,
    reservedAt: reservation.reservedAt,
    expiresAt: reservation.expiresAt,
    pickupAt: reservation.pickupAt,
    reviewedAt: reservation.reviewedAt,
    rejectReason: reservation.rejectReason,
    code: reservation.code,
    status: reservation.status,
  };
}
