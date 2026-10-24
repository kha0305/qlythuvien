import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getPublicBook } from '../api/public';
import type { Book } from '../api/types';
import { bookAvailability } from '../api/types';
import { Icon } from '../components/icons';
import { BookImage } from '../components/BookImage';
import { Skeleton } from '../components/Skeleton';

/** Trang chi tiết sách public: không cần đăng nhập. */
export function BookDetailPublic() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => {
    if (book) document.title = `${book.title} - Thư viện Đại học`;
  }, [book]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await getPublicBook(Number(id));
        if (alive) setBook(b);
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'Không tìm thấy sách.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const state = book ? bookAvailability(book) : 'available';
  const badgeClass =
    state === 'available' ? 'badge-green' : state === 'reserved' ? 'badge-yellow' : 'badge-gray';
  const badgeLabel =
    state === 'available' ? 'Còn sách' : state === 'reserved' ? 'Đang giữ chỗ' : 'Đang mượn';

  return (
    <div className="landing">
      <header className="landing-header">
        <Link to="/" className="landing-brand">
          <Icon name="library" size={26} />
          <span>Thư viện Đại học</span>
        </Link>
        <nav className="landing-nav">
          <Link to="/login" className="btn btn-ghost">
            Đăng nhập
          </Link>
          <Link to="/register" className="btn btn-primary">
            Đăng ký
          </Link>
        </nav>
      </header>

      <main className="book-detail-page">
        <Link to="/" className="link back-link">
          Về trang chủ
        </Link>
        {loading ? (
          <Skeleton variant="card" />
        ) : error || !book ? (
          <div className="alert alert-error">{error || 'Không tìm thấy sách.'}</div>
        ) : (
          <div className="book-detail-card">
            <BookImage book={book} className="book-detail-cover" />
            <div className="book-detail-info">
              <h1>{book.title}</h1>
              <p className="book-detail-author">{book.author || 'Không rõ tác giả'}</p>
              <p>
                <span className={`badge ${badgeClass}`}>
                  {badgeLabel}
                </span>
              </p>
              <dl className="kv">
                {book.totalCopies !== undefined && (
                  <div>
                    <dt>Số bản</dt>
                    <dd>Còn {book.availableCopies ?? 0} trên {book.totalCopies} bản</dd>
                  </div>
                )}
                {book.category && (
                  <div>
                    <dt>Thể loại</dt>
                    <dd>{book.category}</dd>
                  </div>
                )}
                {book.publisher && (
                  <div>
                    <dt>Nhà xuất bản</dt>
                    <dd>{book.publisher}</dd>
                  </div>
                )}
                {book.publishYear && (
                  <div>
                    <dt>Năm xuất bản</dt>
                    <dd>{book.publishYear}</dd>
                  </div>
                )}
              </dl>
              <div className="btn-row">
                <Link to="/login" className="btn btn-primary btn-lg">
                  <Icon name="borrow" size={18} />
                  Đăng nhập để mượn sách
                </Link>
              </div>
              {book.copies && book.copies.length > 1 && (
                <div style={{ marginTop: 20 }}>
                  <h3>Các cuốn cùng đầu sách</h3>
                  <dl className="kv">
                    {book.copies.map((c) => (
                      <div key={c.id}>
                        <dt>{c.bookCode || `Bản #${c.id}`}</dt>
                        <dd>
                          <Link to={`/sach/${c.id}`} className="link">
                            {c.status === 'available'
                              ? c.hasActiveReservation
                                ? 'Đang giữ chỗ'
                                : 'Còn sách'
                              : 'Đang mượn'}
                          </Link>
                          {c.id === book.id ? ' (đang xem)' : ''}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="landing-footer">
        <p>
          <strong>Thư viện Đại học</strong> — đồ án CDIO 4, ngành Công nghệ phần mềm.
        </p>
      </footer>
    </div>
  );
}
