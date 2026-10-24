import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { listOverdue } from '../../api/loans';
import { getDashboardStats } from '../../api/stats';
import type { DashboardStats, Loan } from '../../api/types';
import { StatCard } from '../../components/StatCard';
import { Icon } from '../../components/icons';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { formatDate, formatVND } from '../../utils/format';

/** Dashboard thủ thư: 4 thẻ số + 5 phiếu quá hạn mới nhất + nút nhanh Mượn/Trả. */
export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overdue, setOverdue] = useState<Loan[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, o] = await Promise.all([getDashboardStats(), listOverdue()]);
        if (!alive) return;
        setStats(s);
        setOverdue(o.slice(0, 5));
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'Không tải được dữ liệu tổng quan.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading)
    return (
      <div className="page">
        <div className="skeleton skeleton-title" />
        <Skeleton variant="stat" />
        <Skeleton variant="card" />
      </div>
    );

  return (
    <div className="page">
      <h2 className="page-title">Tổng quan</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <StatCard label="Tổng số sách" value={stats?.totalBooks ?? 0} tone="blue" icon="books" />
        <StatCard label="Đang cho mượn" value={stats?.borrowing ?? 0} tone="green" icon="borrow" />
        <StatCard label="Quá hạn" value={stats?.overdue ?? 0} tone="red" icon="clock" />
        <StatCard label="Tổng độc giả" value={stats?.totalReaders ?? 0} tone="orange" icon="users" />
      </div>

      <div className="quick-actions">
        <Link to="/borrow" className="btn btn-primary btn-lg"><Icon name="borrow" size={18} />Mượn sách</Link>
        <Link to="/return" className="btn btn-secondary btn-lg"><Icon name="ret" size={18} />Trả sách</Link>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Phiếu quá hạn cần xử lý</h3>
          <Link to="/overdue" className="link">Xem tất cả</Link>
        </div>
        {overdue.length === 0 ? (
          <EmptyState
            icon="check"
            title="Không có phiếu quá hạn."
            hint="Mọi phiếu mượn đều trong hạn."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sách</th>
                  <th>Độc giả</th>
                  <th>Hạn trả</th>
                  <th>Trễ</th>
                  <th>Phạt dự kiến</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((l) => (
                  <tr key={l.id}>
                    <td>{l.book.title}</td>
                    <td>{l.reader.fullName}</td>
                    <td>{formatDate(l.dueAt)}</td>
                    <td><span className="badge badge-red">{l.overdueDays ?? 0} ngày</span></td>
                    <td>{formatVND(l.expectedFine)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
