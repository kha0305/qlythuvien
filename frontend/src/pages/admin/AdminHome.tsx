import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { getDashboardStats } from '../../api/stats';
import type { DashboardStats } from '../../api/types';
import { StatCard } from '../../components/StatCard';
import { Skeleton } from '../../components/Skeleton';

/** Trang tổng quan của admin: thẻ số + điều hướng nhanh tới các chức năng quản trị. */
export function AdminHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getDashboardStats();
        if (alive) setStats(s);
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'Không tải được số liệu tổng quan.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <h2 className="page-title">Trang quản trị</h2>
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <>
          <Skeleton variant="stat" />
          <Skeleton variant="card" />
        </>
      ) : (
        <div className="stat-grid">
          <StatCard label="Tổng số sách" value={stats?.totalBooks ?? 0} tone="blue" />
          <StatCard label="Đang cho mượn" value={stats?.borrowing ?? 0} tone="green" />
          <StatCard label="Quá hạn" value={stats?.overdue ?? 0} tone="red" />
          <StatCard label="Tổng độc giả" value={stats?.totalReaders ?? 0} tone="orange" />
        </div>
      )}

      <div className="nav-cards">
        <Link to="/admin/accounts" className="nav-card">
          <h3>Quản lý tài khoản</h3>
          <p>Tạo, khóa/mở khóa và xóa tài khoản thủ thư.</p>
        </Link>
        <Link to="/admin/settings" className="nav-card">
          <h3>Cài đặt hệ thống</h3>
          <p>Số ngày được mượn, mức phạt, giới hạn mượn, thời gian giữ sách đặt trước.</p>
        </Link>
        <Link to="/stats" className="nav-card">
          <h3>Thống kê</h3>
          <p>Top sách mượn nhiều nhất và lịch sử mượn/trả.</p>
        </Link>
      </div>
    </div>
  );
}
