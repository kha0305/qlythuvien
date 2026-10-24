import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { listBooks } from '../../api/books';
import { listPublicCategories } from '../../api/public';
import { reserveBook } from '../../api/reservations';
import { getSettings } from '../../api/settings';
import type { Book } from '../../api/types';
import { bookAvailability } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { Pagination } from '../../components/Pagination';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { BookImage } from '../../components/BookImage';
import { Icon } from '../../components/icons';
import { AiSearchPanel, SearchModeToggle, type SearchMode } from '../../components/AiBookSearch';

const PAGE_SIZE = 12;

/** Trang chủ độc giả: giao diện theo mẫu Landing — hero tìm kiếm, lọc thể loại,
 *  tìm bằng mô tả AI (UC16), thẻ sách + đặt trước (UC11). */
export function ReaderHome() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reservationHours, setReservationHours] = useState(48);
  const [reservingId, setReservingId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const searchTimer = useRef<number | undefined>(undefined);

  const load = useCallback(async (p: number, kw: string, cat: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await listBooks({
        keyword: kw || undefined,
        category: cat || undefined,
        page: p,
        pageSize: PAGE_SIZE,
      });
      setBooks(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách sách.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, debounced, category);
  }, [load, page, debounced, category]);

  useEffect(() => {
    getSettings()
      .then((s) => setReservationHours(s.reservationHours))
      .catch(() => undefined);
    listPublicCategories()
      .then(setCategories)
      .catch(() => undefined);
  }, []);

  const onSearchChange = (v: string) => {
    setKeyword(v);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setPage(1);
      setDebounced(v.trim());
    }, 400);
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    window.clearTimeout(searchTimer.current);
    setPage(1);
    setDebounced(keyword.trim());
    document.getElementById('reader-catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleReserve = async (bookId: number) => {
    setReservingId(bookId);
    setNotice('');
    setError('');
    try {
      await reserveBook(bookId);
      setNotice(`Đặt thành công. Vui lòng đến thư viện lấy sách trong ${reservationHours} giờ.`);
      load(page, debounced, category);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReservingId(null);
    }
  };

  const renderCard = (b: Book) => {
    const state = bookAvailability(b);
    const badgeClass =
      state === 'available' ? 'badge-green' : state === 'reserved' ? 'badge-yellow' : 'badge-gray';
    const badgeLabel =
      state === 'available' ? 'Còn sách' : state === 'reserved' ? 'Đang giữ chỗ' : 'Đang mượn';
    const canReserve = state === 'available';
    return (
      <div className="reader-book-card">
        <Link to={`/reader/books/${b.id}`} className="reader-book-main">
          <div className="landing-book-cover">
            <BookImage book={b} className="landing-book-cover-svg" />
            <span className={`badge ${badgeClass} landing-book-badge`}>{badgeLabel}</span>
          </div>
          <div className="landing-book-body">
            <h3 className="landing-book-title">{b.title}</h3>
            <p className="landing-book-meta">{b.author || 'Không rõ tác giả'}</p>
            {b.category && <p className="landing-book-cat">{b.category}</p>}
          </div>
        </Link>
        <div className="reader-book-foot">
          {canReserve ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={reservingId === b.id}
              onClick={() => handleReserve(b.id)}
            >
              {reservingId === b.id ? 'Đang đặt...' : 'Đặt trước'}
            </button>
          ) : (
            <span className="muted">Không đặt được</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <section className="reader-hero">
        <div className="reader-hero-inner">
          <h2>Xin chào{user ? `, ${user.fullName}` : ''}</h2>
          <p className="reader-hero-desc">
            Tra cứu kho sách và đặt trước online — sách được giữ {reservationHours} giờ chờ bạn
            đến lấy.
          </p>
          <form className="landing-search reader-search" onSubmit={onSearchSubmit}>
            <Icon name="search" size={20} className="landing-search-icon" />
            <input
              className="input landing-search-input"
              placeholder="Tìm tên sách, tác giả..."
              value={keyword}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Tìm kiếm sách"
            />
            <button type="submit" className="btn btn-primary">
              Tìm sách
            </button>
          </form>
        </div>
      </section>

      <section className="reader-catalog" id="reader-catalog">
        <h2 className="page-title">Khám phá kho sách</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}

        <div className="reader-sticky-tools">
          <SearchModeToggle mode={searchMode} onChange={setSearchMode} />

          {searchMode === 'keyword' && (
            <>
              <div className="landing-filters">
                <input
                  className="input input-search"
                  placeholder="Tìm theo tên sách, tác giả..."
                  value={keyword}
                  onChange={(e) => onSearchChange(e.target.value)}
                  aria-label="Tìm kiếm sách"
                />
                <select
                  className="input landing-category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Lọc theo thể loại"
                >
                  <option value="">Tất cả thể loại</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="category-chips" aria-label="Lọc nhanh theo thể loại">
                <button
                  type="button"
                  className={`category-chip${category === '' ? ' category-chip-active' : ''}`}
                  onClick={() => {
                    setCategory('');
                    setPage(1);
                  }}
                >
                  Tất cả
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`category-chip${category === c ? ' category-chip-active' : ''}`}
                    onClick={() => {
                      setCategory(c);
                      setPage(1);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {searchMode === 'ai' ? (
          <AiSearchPanel gridClassName="reader-book-grid" renderCard={(r) => renderCard(r.book)} />
        ) : (
          <>
            {loading ? (
              <Skeleton variant="book" count={8} />
            ) : books.length === 0 ? (
              <EmptyState
                icon="search"
                title="Không tìm thấy sách nào phù hợp."
                hint="Thử từ khóa hoặc thể loại khác."
              />
            ) : (
              <div className="reader-book-grid">
                {books.map((b) => (
                  <Fragment key={b.id}>{renderCard(b)}</Fragment>
                ))}
              </div>
            )}
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
