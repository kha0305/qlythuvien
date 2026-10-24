import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import {
  getPublicStats,
  listGroupedPublicBooks,
  listPublicCategories,
  type PublicStats,
} from '../api/public';
import { AiSearchPanel, SearchModeToggle, type SearchMode } from '../components/AiBookSearch';
import type { Book, BookGroup } from '../api/types';
import { bookAvailability } from '../api/types';
import { homeForRole, useAuth } from '../context/AuthContext';
import { listAnnouncements } from '../api/notifications';
import type { Announcement } from '../api/types';
import { Icon, type IconName } from '../components/icons';
import { BookImage } from '../components/BookImage';
import { Pagination } from '../components/Pagination';
import { CountUp } from '../components/CountUp';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

const PAGE_SIZE = 12;

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: 'qr',
    title: 'Mượn – trả bằng QR',
    desc: 'Mỗi cuốn sách có mã QR riêng, thủ thư chỉ cần quét là xong, không nhập tay.',
  },
  {
    icon: 'clock',
    title: 'Nhắc hạn và phạt trễ tự động',
    desc: 'Hạn trả và tiền phạt được tính tự động theo quy định thư viện.',
  },
  {
    icon: 'check',
    title: 'Đặt trước online, giữ chỗ 48h',
    desc: 'Độc giả đặt sách online, sách được giữ trong 48 giờ chờ đến mượn.',
  },
  {
    icon: 'chart',
    title: 'Thống kê trực quan',
    desc: 'Sách mượn nhiều, phiếu quá hạn, độc giả tích cực — nhìn là thấy ngay.',
  },
];

function BookCard({ book }: { book: Book }) {
  const state = bookAvailability(book);
  const badgeClass =
    state === 'available' ? 'badge-green' : state === 'reserved' ? 'badge-yellow' : 'badge-gray';
  const badgeLabel =
    state === 'available' ? 'Còn sách' : state === 'reserved' ? 'Đang giữ chỗ' : 'Đang mượn';
  return (
    <Link to={`/sach/${book.id}`} className="landing-book-card">
      <div className="landing-book-cover">
        <BookImage book={book} className="landing-book-cover-svg" />
        <span className={`badge ${badgeClass} landing-book-badge`}>
          {badgeLabel}
        </span>
      </div>
      <div className="landing-book-body">
        <h3 className="landing-book-title">{book.title}</h3>
        <p className="landing-book-meta">{book.author || 'Không rõ tác giả'}</p>
        {book.category && <p className="landing-book-cat">{book.category}</p>}
      </div>
    </Link>
  );
}

/** Thẻ đầu sách gom nhóm: 1 thẻ / tựa + tác giả, bìa từ cuốn đầu tiên có bìa thật. */
function GroupCard({ group }: { group: BookGroup }) {
  const pseudo: Book = {
    id: group.representativeId,
    qrCode: '',
    title: group.title,
    author: group.author,
    category: group.category,
    publisher: group.publisher,
    publishYear: group.publishYear,
    status: group.availableCopies > 0 ? 'available' : 'borrowed',
    coverUrl: group.coverUrl,
  };
  return (
    <Link to={`/sach/${group.representativeId}`} className="landing-book-card">
      <div className="landing-book-cover">
        <BookImage book={pseudo} className="landing-book-cover-svg" />
        <span className={`badge ${group.availableCopies > 0 ? 'badge-green' : 'badge-gray'} landing-book-badge`}>
          {group.availableCopies > 0 ? `Còn ${group.availableCopies} cuốn` : 'Hết sách'}
        </span>
      </div>
      <div className="landing-book-body">
        <h3 className="landing-book-title">{group.title}</h3>
        <p className="landing-book-meta">{group.author || 'Không rõ tác giả'}</p>
        {group.category && <p className="landing-book-cat">{group.category}</p>}
        <p className="landing-book-meta">Tổng {group.totalCopies} bản</p>
      </div>
    </Link>
  );
}

/** Landing page public: giới thiệu + tra cứu sách không cần đăng nhập. */
export function Landing() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [groups, setGroups] = useState<BookGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState({ keyword: '', category: '', page: 1 });
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  // UC16: chế độ tìm bằng mô tả (AI) — UI dùng chung ở components/AiBookSearch.
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, c, a] = await Promise.all([getPublicStats(), listPublicCategories(), listAnnouncements().catch(() => [])]);
        if (alive) {
          setStats(s);
          setCategories(c);
          setAnnouncements(a);
        }
      } catch {
        // Số liệu tổng quan là phụ: lỗi thì ẩn đi, không chặn trang.
        if (alive) setStats(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await listGroupedPublicBooks({
          keyword: query.keyword || undefined,
          category: query.category || undefined,
          page: query.page,
          limit: PAGE_SIZE,
        });
        if (!alive) return;
        setGroups(res.data);
        setTotal(res.total);
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'Không tải được danh sách sách.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [query]);

  const onSearchInput = (value: string) => {
    setKeywordInput(value);
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      setQuery((q) => ({ ...q, keyword: value, page: 1 }));
    }, 400);
  };

  const onCategoryChange = (value: string) => {
    setQuery((q) => ({ ...q, category: value, page: 1 }));
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (debounce.current) window.clearTimeout(debounce.current);
    setQuery((q) => ({ ...q, keyword: keywordInput, page: 1 }));
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (authLoading) {
    return (
      <div className="center-page">
        <div className="skeleton skeleton-line" style={{ width: '220px' }} />
      </div>
    );
  }
  if (user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

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

      <section className="landing-hero">
        <svg className="landing-hero-deco back" viewBox="0 0 200 200" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="6">
          <rect x="45" y="30" width="110" height="140" rx="10" />
          <line x1="70" y1="65" x2="130" y2="65" />
          <line x1="70" y1="92" x2="130" y2="92" />
          <line x1="70" y1="119" x2="108" y2="119" />
        </svg>
        <svg className="landing-hero-deco" viewBox="0 0 200 200" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="6">
          <path d="M100 32 C 72 46, 44 46, 28 41 L 28 158 C 44 163, 72 163, 100 149 C 128 163, 156 163, 172 158 L 172 41 C 156 46, 128 46, 100 32 Z" />
          <line x1="100" y1="32" x2="100" y2="149" />
        </svg>
        <div className="landing-hero-inner">
          <h1>Thư viện trong tầm tay</h1>
          <p className="landing-hero-desc">
            Tra cứu kho sách, đặt trước online và theo dõi phiếu mượn — mọi thứ gói gọn
            trong một ứng dụng quản lý thư viện đại học.
          </p>
          <form className="landing-search" onSubmit={onSearchSubmit}>
            <Icon name="search" size={20} className="landing-search-icon" />
            <input
              className="input landing-search-input"
              placeholder="Tìm tên sách, tác giả..."
              value={keywordInput}
              onChange={(e) => onSearchInput(e.target.value)}
              aria-label="Tìm kiếm sách"
            />
            <button type="submit" className="btn btn-primary">
              Tìm sách
            </button>
          </form>
          {stats && (
            <div className="landing-stats">
              <div className="landing-stat">
                <strong><CountUp value={stats.totalBooks} /></strong>
                <span>Đầu sách</span>
              </div>
              <div className="landing-stat">
                <strong><CountUp value={stats.availableBooks} /></strong>
                <span>Có thể mượn</span>
              </div>
              <div className="landing-stat">
                <strong><CountUp value={stats.totalReaders} /></strong>
                <span>Độc giả</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="landing-features">
        <h2>Tính năng nổi bật</h2>
        <div className="landing-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <span className="landing-feature-icon" aria-hidden="true">
                <Icon name={f.icon} size={26} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-catalog" id="catalog">
        <h2>Khám phá kho sách</h2>
        <SearchModeToggle mode={searchMode} onChange={setSearchMode} />

        {searchMode === 'ai' ? (
          <AiSearchPanel renderCard={(r) => <BookCard book={r.book} />} />
        ) : (
          <>
        <div className="landing-filters">
          <input
            className="input input-search"
            placeholder="Tìm theo tên sách, tác giả..."
            value={keywordInput}
            onChange={(e) => onSearchInput(e.target.value)}
            aria-label="Tìm kiếm sách"
          />
          <select
            className="input landing-category"
            value={query.category}
            onChange={(e) => onCategoryChange(e.target.value)}
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
            className={`category-chip${query.category === '' ? ' category-chip-active' : ''}`}
            onClick={() => onCategoryChange('')}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`category-chip${query.category === c ? ' category-chip-active' : ''}`}
              onClick={() => onCategoryChange(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <Skeleton variant="book" count={8} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="search"
            title="Không tìm thấy sách nào phù hợp."
            hint="Thử từ khóa hoặc thể loại khác."
          />
        ) : (
          <div className="landing-book-grid">
            {groups.map((g) => (
              <GroupCard key={g.representativeId} group={g} />
            ))}
          </div>
        )}
        <Pagination
          page={query.page}
          total={total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setQuery((q) => ({ ...q, page: p }))}
        />
          </>
        )}
      </section>

      {announcements.filter((a) => !dismissed.includes(a.id)).length > 0 && (
        <div className="landing-announcements" role="complementary" aria-label="Thông báo">
          {announcements
            .filter((a) => !dismissed.includes(a.id))
            .map((a) => (
              <div key={a.id} className="announce-card">
                <div className="announce-body">
                  <strong className="announce-title">{a.title}</strong>
                  {a.body && <p>{a.body}</p>}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label="Tắt thông báo"
                  onClick={() => setDismissed((d) => [...d, a.id])}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
        </div>
      )}

      <footer className="landing-footer">
        <p>
          <strong>Thư viện Đại học</strong> — đồ án CDIO 4, ngành Công nghệ phần mềm.
        </p>
        <p className="muted">Mượn – trả bằng QR, nhắc hạn tự động, đặt trước online 48h.</p>
      </footer>
    </div>
  );
}
