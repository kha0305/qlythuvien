import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { getBook } from '../../api/books';
import { reserveBook } from '../../api/reservations';
import { getSettings } from '../../api/settings';
import type { Book } from '../../api/types';
import { Skeleton } from '../../components/Skeleton';
import { BookImage } from '../../components/BookImage';

/** Chi tiết sách + nút đặt trước (độc giả). */
export function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => {
    if (book) document.title = `${book.title} - Thư viện Đại học`;
  }, [book]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [reservationHours, setReservationHours] = useState(48);
  const [readerNote, setReaderNote] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await getBook(Number(id));
        if (alive) setBook(b);
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'Không tải được thông tin sách.'));
      } finally {
        if (alive) setLoading(false);
      }
      try {
        const s = await getSettings();
        if (alive) setReservationHours(s.reservationHours);
      } catch {
        // giữ mặc định 48 giờ
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const handleReserve = async (bookId?: number) => {
    if (!book) return;
    setReserving(true);
    setError('');
    setNotice('');
    try {
      await reserveBook(bookId ?? book.id, readerNote.trim() || undefined);
      const b = await getBook(book.id);
      setBook(b);
      setReaderNote('');
      setNotice(`Đặt trước thành công, đang chờ thủ thư duyệt (trong ${reservationHours} giờ).`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReserving(false);
    }
  };

  if (loading)
    return (
      <div className="page">
        <div className="skeleton skeleton-title" />
        <Skeleton variant="card" />
      </div>
    );

  return (
    <div className="page">
      <Link to="/reader" className="link back-link">Quay lại tìm sách</Link>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {book && (
        <div className="card">
          <div className="book-detail-head">
            <BookImage book={book} className="book-detail-thumb" />
            <h2 className="page-title">{book.title}</h2>
          </div>
          <dl className="kv">
            <div><dt>Tác giả</dt><dd>{book.author || '-'}</dd></div>
            <div><dt>Thể loại</dt><dd>{book.category || '-'}</dd></div>
            <div><dt>Nhà xuất bản</dt><dd>{book.publisher || '-'}</dd></div>
            <div><dt>Năm xuất bản</dt><dd>{book.publishYear ?? '-'}</dd></div>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                {book.status === 'borrowed' ? (
                  <span className="badge badge-gray">Đang mượn</span>
                ) : book.hasActiveReservation ? (
                  <span className="badge badge-orange">Đã có người đặt</span>
                ) : (
                  <span className="badge badge-green">Còn</span>
                )}
              </dd>
            </div>
          </dl>

          {book.status === 'available' && !book.hasActiveReservation && (
            <>
              <label className="field">
                <span>Giờ mong muốn đến lấy (không bắt buộc)</span>
                <input
                  type="text"
                  className="input"
                  value={readerNote}
                  onChange={(e) => setReaderNote(e.target.value)}
                  placeholder="Ví dụ: chiều mai khoảng 14h"
                  maxLength={255}
                />
              </label>
              <div className="btn-row">
                <button type="button" className="btn btn-primary btn-lg" disabled={reserving} onClick={() => handleReserve()}>
                  {reserving ? 'Đang đặt...' : 'Đặt trước cuốn này'}
                </button>
              </div>
            </>
          )}
          {(book.status !== 'available' || book.hasActiveReservation) && !notice && (
            <p className="muted">Sách hiện không khả dụng để đặt trước.</p>
          )}

          {book.copies && book.copies.length > 1 && (
            <div style={{ marginTop: 20 }}>
              <h3>Các cuốn cùng đầu sách</h3>
              <dl className="kv">
                {book.copies.map((c) => (
                  <div key={c.id}>
                    <dt>{c.bookCode || `Bản #${c.id}`}</dt>
                    <dd>
                      {c.status === 'borrowed' ? (
                        <span className="badge badge-gray">Đang mượn</span>
                      ) : c.hasActiveReservation ? (
                        <span className="badge badge-orange">Đã có người đặt</span>
                      ) : (
                        <span className="badge badge-green">Còn</span>
                      )}
                      {' '}
                      {c.id === book.id ? (
                        <span className="muted">(đang xem)</span>
                      ) : c.status === 'available' && !c.hasActiveReservation ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={reserving}
                          onClick={() => handleReserve(c.id)}
                        >
                          Đặt trước bản này
                        </button>
                      ) : (
                        <Link to={`/reader/books/${c.id}`} className="link">Xem bản này</Link>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
