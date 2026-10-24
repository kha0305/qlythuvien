import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { listLoans, type LoanFilters } from '../../api/loans';
import { listReaders } from '../../api/readers';
import { getDashboardStats, exportStatsExcel } from '../../api/stats';
import type { DashboardStats, Loan, User } from '../../api/types';
import { Pagination } from '../../components/Pagination';
import { StatCard } from '../../components/StatCard';
import { formatDate, formatVND, toDateInput } from '../../utils/format';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';

const PAGE_SIZE = 20;

/** UC07: 4 thẻ số + biểu đồ top 5 (tự vẽ CSS) + lịch sử mượn/trả có lọc. */
export function Stats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState('');

  const [loans, setLoans] = useState<Loan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [readers, setReaders] = useState<User[]>([]);
  const [filters, setFilters] = useState<LoanFilters>({ status: '' });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [readerId, setReaderId] = useState('');
  const [sort, setSort] = useState('');
  const [loansError, setLoansError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [loadingLoans, setLoadingLoans] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getDashboardStats();
        if (alive) setStats(s);
      } catch (err) {
        if (alive) setStatsError(getErrorMessage(err, 'Không tải được số liệu tổng quan.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listReaders();
        if (alive) setReaders(res.data);
      } catch {
        // không chặn trang thống kê nếu không tải được danh sách độc giả
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadLoans = useCallback(async () => {
    setLoadingLoans(true);
    setLoansError('');
    try {
      const res = await listLoans({
        status: filters.status || undefined,
        readerId: readerId ? Number(readerId) : undefined,
        from: from || undefined,
        to: to || undefined,
        sort: sort || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setLoans(res.data);
      setTotal(res.total);
    } catch (err) {
      setLoansError(getErrorMessage(err, 'Không tải được lịch sử mượn trả.'));
    } finally {
      setLoadingLoans(false);
    }
  }, [filters.status, readerId, from, to, sort, page]);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const applyFilters = () => {
    setPage(1);
    loadLoans();
  };

  const resetFilters = () => {
    setFilters({ status: '' });
    setFrom('');
    setTo('');
    setReaderId('');
    setSort('');
    setPage(1);
  };

  const doExportExcel = async () => {
    setExporting(true);
    try {
      await exportStatsExcel({
        status: filters.status || undefined,
        readerId: readerId ? Number(readerId) : undefined,
        from: from || undefined,
        to: to || undefined,
      });
    } catch (err) {
      setLoansError(getErrorMessage(err, 'Không xuất được file Excel.'));
    } finally {
      setExporting(false);
    }
  };

  const top = stats?.topBooks ?? [];
  const maxCount = top.length > 0 ? Math.max(...top.map((t) => t.count)) : 0;

  return (
    <div className="page">
      <h2 className="page-title">Thống kê</h2>
      {statsError && <div className="alert alert-error">{statsError}</div>}

      <div className="stat-grid">
        <StatCard label="Tổng số sách" value={stats?.totalBooks ?? 0} tone="blue" />
        <StatCard label="Đang cho mượn" value={stats?.borrowing ?? 0} tone="green" />
        <StatCard label="Quá hạn" value={stats?.overdue ?? 0} tone="red" />
        <StatCard label="Tổng độc giả" value={stats?.totalReaders ?? 0} tone="orange" />
      </div>

      <section className="card">
        <h3>Top 5 sách được mượn nhiều nhất</h3>
        {top.length === 0 ? (
          <EmptyState
            icon="chart"
            title="Chưa có dữ liệu mượn sách."
            hint="Dữ liệu sẽ hiện khi có phiếu mượn được tạo."
          />
        ) : (
          <div className="barchart">
            {top.map((t, i) => (
              <div className="barchart-row" key={`${t.title}-${i}`}>
                <span className="barchart-label" title={t.title}>{t.title}</span>
                <div className="barchart-track">
                  <div
                    className="barchart-bar"
                    style={{ width: `${maxCount > 0 ? Math.round((t.count / maxCount) * 100) : 0}%` }}
                  />
                </div>
                <span className="barchart-value">{t.count} lượt</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card print-area">
        <h3>Lịch sử mượn / trả</h3>
        <div className="filter-grid">
          <label className="field">
            <span>Độc giả</span>
            <select className="input" value={readerId} onChange={(e) => setReaderId(e.target.value)}>
              <option value="">Tất cả</option>
              {readers.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Trạng thái</span>
            <select
              className="input"
              value={filters.status ?? ''}
              onChange={(e) => setFilters({ status: e.target.value as LoanFilters['status'] })}
            >
              <option value="">Tất cả</option>
              <option value="borrowing">Đang mượn</option>
              <option value="returned">Đã trả</option>
            </select>
          </label>
          <label className="field">
            <span>Từ ngày</span>
            <input
              className="input"
              type="date"
              value={from}
              max={toDateInput(new Date())}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Đến ngày</span>
            <input
              className="input"
              type="date"
              value={to}
              min={from || undefined}
              max={toDateInput(new Date())}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Sắp xếp</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="">Ngày mượn mới nhất</option>
              <option value="oldest">Ngày mượn cũ nhất</option>
            </select>
          </label>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={applyFilters}>Lọc</button>
          <button type="button" className="btn btn-secondary" onClick={resetFilters}>Xóa lọc</button>
          <button type="button" className="btn btn-secondary" onClick={doExportExcel} disabled={exporting}>
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
            In / Lưu PDF
          </button>
        </div>

        {loansError && <div className="alert alert-error">{loansError}</div>}

        {loadingLoans ? (
          <Skeleton variant="table" count={5} />
        ) : loans.length === 0 ? (
          <EmptyState
            icon="search"
            title="Không có phiếu nào khớp bộ lọc."
            hint="Thử nới lỏng điều kiện lọc."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sách</th>
                  <th>Độc giả</th>
                  <th>Ngày mượn</th>
                  <th>Hạn trả</th>
                  <th>Ngày trả</th>
                  <th>Trạng thái</th>
                  <th>Phạt</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td className="td-title">{l.book.title}</td>
                    <td>{l.reader.fullName}</td>
                    <td>{formatDate(l.borrowedAt)}</td>
                    <td>{formatDate(l.dueAt)}</td>
                    <td>{formatDate(l.returnedAt)}</td>
                    <td>
                      {l.status === 'borrowing' ? (
                        <span className="badge badge-green">Đang mượn</span>
                      ) : (
                        <span className="badge badge-gray">Đã trả</span>
                      )}
                    </td>
                    <td>{formatVND(l.fineAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
      </section>
    </div>
  );
}
