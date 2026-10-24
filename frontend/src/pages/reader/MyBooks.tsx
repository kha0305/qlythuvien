import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { getErrorMessage } from '../../api/client';
import { myLoans } from '../../api/loans';
import { cancelReservation, myReservations } from '../../api/reservations';
import { calcOverdueDays, type Loan, type Reservation } from '../../api/types';
import { ConfirmDialog } from '../../components/Modal';
import { CopyButton } from '../../components/CopyButton';
import { ReservationBadge } from '../../components/ReservationBadge';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { formatDate, formatVND } from '../../utils/format';

type Tab = 'borrowing' | 'reservations' | 'history';

/** UC08 + UC12: sách của tôi — 3 tab Đang mượn / Đặt trước / Lịch sử. */
export function MyBooks() {
  const [tab, setTab] = useState<Tab>('borrowing');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ls, rs] = await Promise.all([myLoans(), myReservations()]);
      setLoans(ls);
      setReservations(rs);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được dữ liệu.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelReservation(cancelTarget.id);
      setCancelTarget(null);
      setNotice('Đã hủy đặt trước. Sách được nhả cho người khác.');
      load();
    } catch (err) {
      setError(getErrorMessage(err));
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  const borrowing = loans.filter((l) => l.status === 'borrowing');
  const history = loans.filter((l) => l.status === 'returned');
  const pendingCount = reservations.filter((r) => r.status === 'pending').length;

  /** Nhãn cảnh báo cho phiếu đang mượn: Quá hạn / Sắp hết hạn (còn <= 2 ngày). */
  const loanBadge = (l: Loan) => {
    const overdue = calcOverdueDays(l.dueAt);
    if (overdue > 0) return <span className="badge badge-red">Quá hạn {overdue} ngày</span>;
    const remainingDays = Math.ceil((new Date(l.dueAt).getTime() - Date.now()) / 86400000);
    if (remainingDays <= 2) return <span className="badge badge-orange">Sắp hết hạn</span>;
    return <span className="badge badge-green">Đang mượn</span>;
  };

  const remainingText = (r: Reservation): string | null => {
    if (r.status !== 'pending' && r.status !== 'approved') return null;
    if (typeof r.remainingHours === 'number') {
      const h = Math.floor(Math.max(0, r.remainingHours));
      return r.status === 'approved' ? `Còn ${h} giờ đến lấy` : `Còn ${h} giờ chờ duyệt`;
    }
    return null;
  };

  return (
    <div className="page">
      <h2 className="page-title">Sách của tôi</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`tab${tab === 'borrowing' ? ' tab-active' : ''}`}
          onClick={() => setTab('borrowing')}
        >
          Đang mượn ({borrowing.length})
        </button>
        <button
          type="button"
          role="tab"
          className={`tab${tab === 'reservations' ? ' tab-active' : ''}`}
          onClick={() => setTab('reservations')}
        >
          Đặt trước ({pendingCount})
        </button>
        <button
          type="button"
          role="tab"
          className={`tab${tab === 'history' ? ' tab-active' : ''}`}
          onClick={() => setTab('history')}
        >
          Lịch sử
        </button>
      </div>

      {loading ? (
        <Skeleton variant="card" />
      ) : (
        <>
          {tab === 'borrowing' &&
            (borrowing.length === 0 ? (
              <EmptyState
                icon="book"
                title="Bạn chưa mượn cuốn nào."
                hint="Tìm sách ở trang chủ và mượn tại quầy thư viện."
              />
            ) : (
              <div className="loan-list">
                {borrowing.map((l) => (
                  <div className="card loan-card" key={l.id}>
                    <div className="loan-head">
                      <h3>{l.book.title}</h3>
                      {loanBadge(l)}
                    </div>
                    <dl className="kv">
                      <div><dt>Ngày mượn</dt><dd>{formatDate(l.borrowedAt)}</dd></div>
                      <div><dt>Hạn trả</dt><dd>{formatDate(l.dueAt)}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
            ))}

          {tab === 'reservations' &&
            (reservations.length === 0 ? (
              <EmptyState
                icon="clock"
                title="Bạn chưa đặt trước cuốn nào."
                hint="Đặt trước sách ở trang chi tiết sách."
              />
            ) : (
              <div className="loan-list">
                {reservations.map((r) => {
                  const remain = remainingText(r);
                  return (
                    <div className="card loan-card" key={r.id}>
                      <div className="loan-head">
                        <h3>{r.book?.title ?? `Sách #${r.bookId}`}</h3>
                        <ReservationBadge status={r.status} />
                      </div>
                      <dl className="kv">
                        <div><dt>Đặt lúc</dt><dd>{formatDate(r.reservedAt)}</dd></div>
                        {r.status === 'approved' && r.pickupAt && (
                          <div><dt>Lịch hẹn đến lấy</dt><dd>{formatDate(r.pickupAt)}</dd></div>
                        )}
                        {r.status === 'rejected' && r.rejectReason && (
                          <div><dt>Lý do từ chối</dt><dd>{r.rejectReason}</dd></div>
                        )}
                        {remain && (
                          <div><dt>Còn lại</dt><dd>{remain}</dd></div>
                        )}
                      </dl>
                      {r.status === 'approved' && r.code && (
                        <div className="resv-qr">
                          <QRCode value={r.code} size={140} />
                          <div className="qr-code-row">
                            <p className="qr-code-text">Mã lấy sách: {r.code}</p>
                            <CopyButton text={r.code} />
                          </div>
                          <p className="muted">Đưa mã này cho thủ thư khi đến lấy sách.</p>
                        </div>
                      )}
                      {r.status === 'pending' && (
                        <div className="btn-row">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setCancelTarget(r)}
                          >
                            Hủy đặt trước
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          {tab === 'history' &&
            (history.length === 0 ? (
              <EmptyState
                icon="books"
                title="Chưa có lịch sử mượn sách."
                hint="Các phiếu đã trả sẽ hiện ở đây."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sách</th>
                      <th>Ngày mượn</th>
                      <th>Ngày trả</th>
                      <th>Tiền phạt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((l) => (
                      <tr key={l.id}>
                        <td className="td-title">{l.book.title}</td>
                        <td>{formatDate(l.borrowedAt)}</td>
                        <td>{formatDate(l.returnedAt)}</td>
                        <td>{formatVND(l.fineAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Hủy đặt trước"
        message={`Bạn có chắc muốn hủy đặt trước cuốn "${cancelTarget?.book?.title ?? ''}"? Sách sẽ được nhả cho người khác.`}
        confirmLabel="Hủy đặt trước"
        danger
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
