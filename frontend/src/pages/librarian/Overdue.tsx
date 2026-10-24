import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { listOverdue } from '../../api/loans';
import type { Loan } from '../../api/types';
import { formatDate, formatVND } from '../../utils/format';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';

/** UC06: danh sách phiếu quá hạn, sắp xếp theo số ngày trễ giảm dần. */
export function Overdue() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await listOverdue(sort || undefined);
        if (alive) setLoans(data);
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'Không tải được danh sách quá hạn.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sort]);

  return (
    <div className="page">
      <h2 className="page-title">Phiếu quá hạn</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <select
          className="input input-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sắp xếp phiếu quá hạn"
        >
          <option value="">Trễ nhiều nhất</option>
          <option value="due_desc">Hạn trả gần nhất</option>
        </select>
      </div>

      {loading ? (
        <Skeleton variant="table" count={5} />
      ) : loans.length === 0 ? (
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
                <th>Số điện thoại</th>
                <th>Ngày mượn</th>
                <th>Hạn trả</th>
                <th>Số ngày trễ</th>
                <th>Phạt dự kiến</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id}>
                  <td className="td-title">{l.book.title}</td>
                  <td>{l.reader.fullName}</td>
                  <td>{l.reader.phone || '-'}</td>
                  <td>{formatDate(l.borrowedAt)}</td>
                  <td>{formatDate(l.dueAt)}</td>
                  <td><span className="badge badge-red">{l.overdueDays ?? 0} ngày</span></td>
                  <td>{formatVND(l.expectedFine)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
