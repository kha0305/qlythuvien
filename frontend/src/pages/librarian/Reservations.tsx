import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  approveReservation,
  listPendingReservations,
  rejectReservation,
} from '../../api/reservations';
import type { Reservation } from '../../api/types';
import { Icon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { formatDate } from '../../utils/format';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';

/** Thủ thư: quản lý các lượt đặt trước đang chờ duyệt. */
export function LibrarianReservations() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [approveTarget, setApproveTarget] = useState<Reservation | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Reservation | null>(null);
  const [pickupAt, setPickupAt] = useState('');
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const [sort, setSort] = useState('');

  const load = useCallback(async (s: string) => {
    setLoading(true);
    setError('');
    try {
      setItems(await listPendingReservations(s || undefined));
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách đặt trước.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(sort);
  }, [load, sort]);

  const openApprove = (r: Reservation) => {
    setPickupAt('');
    setApproveTarget(r);
  };

  const doApprove = async () => {
    if (!approveTarget) return;
    if (!pickupAt) {
      setError('Vui lòng chọn ngày giờ hẹn.');
      return;
    }
    if (new Date(pickupAt).getTime() <= Date.now()) {
      setError('Lịch hẹn phải ở tương lai.');
      return;
    }
    setActing(true);
    setError('');
    try {
      await approveReservation(approveTarget.id, new Date(pickupAt).toISOString());
      setApproveTarget(null);
      setNotice(`Đã duyệt, hẹn độc giả đến lấy lúc ${formatDate(pickupAt)}.`);
      load(sort);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const doReject = async () => {
    if (!rejectTarget) return;
    setActing(true);
    setError('');
    try {
      await rejectReservation(rejectTarget.id, reason.trim() || undefined);
      setRejectTarget(null);
      setReason('');
      setNotice('Đã từ chối lượt đặt trước, sách được mở lại.');
      load(sort);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">Quản lý đặt trước</h2>
      <p className="muted">Các lượt đặt đang chờ duyệt. Duyệt kèm lịch hẹn cụ thể để độc giả đến lấy.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="toolbar">
        <select
          className="input input-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sắp xếp lượt đặt trước"
        >
          <option value="">Cũ nhất trước</option>
          <option value="newest">Mới nhất trước</option>
        </select>
      </div>

      {loading ? (
        <Skeleton variant="table" count={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="clock"
          title="Không có lượt đặt nào đang chờ duyệt."
          hint="Yêu cầu đặt trước mới sẽ hiện ở đây."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sách</th>
                <th>Độc giả</th>
                <th>MSSV</th>
                <th>Giờ mong muốn</th>
                <th>Đặt lúc</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="td-title">{r.book?.title ?? `Sách #${r.bookId}`}</td>
                  <td>{r.reader?.fullName ?? '-'}</td>
                  <td>{r.reader?.studentCode || '-'}</td>
                  <td>{r.readerNote || <span className="muted">—</span>}</td>
                  <td>{formatDate(r.reservedAt)}</td>
                  <td>
                    <div className="td-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => openApprove(r)}
                      >
                        <Icon name="check" size={14} /> Duyệt
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setReason('');
                          setRejectTarget(r);
                        }}
                      >
                        <Icon name="x" size={14} /> Không duyệt
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!approveTarget}
        title="Duyệt đặt trước"
        onClose={() => setApproveTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setApproveTarget(null)}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={doApprove} disabled={acting}>
              {acting ? 'Đang duyệt...' : 'Xác nhận duyệt'}
            </button>
          </>
        }
      >
        <p>
          Duyệt cho <strong>{approveTarget?.reader?.fullName}</strong> mượn cuốn{' '}
          <strong>{approveTarget?.book?.title}</strong>.
        </p>
        <label className="field">
          <span>Lịch hẹn đến lấy</span>
          <input
            type="datetime-local"
            className="input"
            value={pickupAt}
            onChange={(e) => setPickupAt(e.target.value)}
          />
        </label>
        <p className="field-hint">Sách được giữ đến giờ hẹn + 2 giờ. Quá giờ không đến sẽ tự hết hiệu lực.</p>
      </Modal>

      <Modal
        open={!!rejectTarget}
        title="Không duyệt đặt trước"
        onClose={() => setRejectTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRejectTarget(null)}>
              Hủy
            </button>
            <button type="button" className="btn btn-danger" onClick={doReject} disabled={acting}>
              {acting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
            </button>
          </>
        }
      >
        <p>
          Từ chối lượt đặt của <strong>{rejectTarget?.reader?.fullName}</strong> cho cuốn{' '}
          <strong>{rejectTarget?.book?.title}</strong>. Sách sẽ được mở lại ngay.
        </p>
        <label className="field">
          <span>Lý do (không bắt buộc)</span>
          <textarea
            className="input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: sách đang được ưu tiên cho lớp học..."
          />
        </label>
      </Modal>
    </div>
  );
}
