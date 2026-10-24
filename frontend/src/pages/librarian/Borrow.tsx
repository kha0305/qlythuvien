import { useRef, useState, lazy, Suspense } from 'react';
import { getErrorMessage } from '../../api/client';
import { getBookByQr } from '../../api/books';
import { borrowBook } from '../../api/loans';
import { listReaders } from '../../api/readers';
import { getReservationByCode } from '../../api/reservations';
import { ReservationBadge } from '../../components/ReservationBadge';
import type { Book, Loan, Reservation, User } from '../../api/types';
import { formatDate } from '../../utils/format';
import { CopyButton } from '../../components/CopyButton';
import { Icon } from '../../components/icons';

// Tải riêng chunk quét QR (chứa @zxing) để trang đầu nhẹ hơn
const QrScanner = lazy(() =>
  import('../../components/QrScanner').then((m) => ({ default: m.QrScanner }))
);

type Step = 'scan' | 'reader' | 'confirm' | 'done';

/**
 * UC04: mượn sách tại quầy.
 * Quét QR -> thông tin sách -> chọn độc giả -> xác nhận -> báo hạn trả.
 */
export function Borrow() {
  const [step, setStep] = useState<Step>('scan');
  const [book, setBook] = useState<Book | null>(null);
  const [scannedReservation, setScannedReservation] = useState<Reservation | null>(null);
  const [manualQr, setManualQr] = useState('');
  const [pasting, setPasting] = useState(false);
  const [readerKw, setReaderKw] = useState('');
  const [readers, setReaders] = useState<User[]>([]);
  const [readersReady, setReadersReady] = useState(false);
  const [sort, setSort] = useState('recent_borrow');
  const [selected, setSelected] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ loan: Loan; dueAt: string } | null>(null);
  const [round, setRound] = useState(0);
  const searchTimer = useRef<number | undefined>(undefined);

  const reset = () => {
    setStep('scan');
    setBook(null);
    setScannedReservation(null);
    setManualQr('');
    setReaderKw('');
    setReaders([]);
    setReadersReady(false);
    setSort('recent_borrow');
    setSelected(null);
    setError('');
    setResult(null);
    setRound((r) => r + 1); // remount QrScanner để bật lại camera
  };

  /** Tải danh sách độc giả (mặc định sort "mượn gần đây"), lọc theo từ khóa. */
  const loadReaders = async (kw: string, s: string) => {
    try {
      const res = await listReaders(kw || undefined, s || undefined, 100);
      setReaders(res.data);
    } catch {
      setReaders([]);
    } finally {
      setReadersReady(true);
    }
  };

  const handleScan = async (qrCode: string) => {
    setLooking(true);
    setError('');
    setScannedReservation(null);
    try {
      // Ưu tiên: mã đặt trước của độc giả (QR hiện khi đặt trước được duyệt).
      try {
        const r = await getReservationByCode(qrCode);
        setScannedReservation(r);
        setBook(r.book!);
        // Độc giả cố định theo lượt đặt -> bỏ qua bước chọn, vào thẳng xác nhận.
        setSelected({
          id: r.reader!.id,
          username: '',
          fullName: r.reader!.fullName,
          role: 'reader',
          studentCode: r.reader!.studentCode,
          phone: r.reader!.phone,
        });
        setStep('confirm');
        return;
      } catch {
        // Không phải mã đặt trước -> thử mã sách như cũ.
      }
      const b = await getBookByQr(qrCode);
      if (b.status === 'borrowed') {
        setError('Sách này đang được mượn, không thể cho mượn tiếp. Hãy quét mã khác.');
        return;
      }
      setBook(b);
      setStep('reader');
      // Mở lên là có list độc giả sẵn (sort mặc định: mượn gần đây nhất).
      setReadersReady(false);
      void loadReaders('', sort);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tìm thấy sách.'));
    } finally {
      setLooking(false);
    }
  };

  /** Tìm sách bằng mã nhập tay (dùng chung luồng handleScan). */
  const doManualSearch = () => {
    const code = manualQr.trim();
    if (!code) {
      setError('Vui lòng nhập mã sách.');
      return;
    }
    void handleScan(code);
  };

  /** Dán mã sách từ clipboard; báo lỗi rõ ràng nếu bị chặn, không im lặng. */
  const pasteQr = async () => {
    setPasting(true);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError('Clipboard đang trống, không có gì để dán.');
        return;
      }
      setManualQr(text.trim());
      setError('');
    } catch {
      setError('Không đọc được clipboard. Hãy cấp quyền cho trình duyệt hoặc nhập mã bằng tay.');
    } finally {
      setPasting(false);
    }
  };

  const searchReaders = (v: string) => {
    setReaderKw(v);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      void loadReaders(v.trim(), sort);
    }, 400);
  };

  const onSortChange = (v: string) => {
    setSort(v);
    void loadReaders(readerKw.trim(), v);
  };

  const handleConfirm = async () => {
    if (!book || !selected) return;
    setSubmitting(true);
    setError('');
    try {
      const r = await borrowBook(book.qrCode, selected.id);
      setResult(r);
      setStep('done');
    } catch (err) {
      setError(getErrorMessage(err));
      setStep('confirm');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-scan">
      <h2 className="page-title">Mượn sách</h2>

      {error && <div className="alert alert-error">{error}</div>}

      {step === 'scan' && (
        <>
          <Suspense fallback={<p className="muted">Đang tải camera...</p>}>
            <QrScanner key={round} mode="borrow" onScan={handleScan} paused={step !== 'scan'} />
          </Suspense>
          {looking && <p className="muted">Đang tra cứu sách...</p>}
          {!looking && error && (
            <button type="button" className="btn btn-secondary" onClick={() => { setError(''); setRound((r) => r + 1); }}>
              Quét lại
            </button>
          )}
          <p className="manual-qr-label">Nhập mã sách thủ công</p>
          <div className="manual-qr">
            <input
              className="input"
              placeholder="Dán hoặc nhập mã sách..."
              value={manualQr}
              onChange={(e) => setManualQr(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doManualSearch(); }}
              aria-label="Nhập mã sách thủ công"
            />
            <button type="button" className="btn btn-secondary" onClick={pasteQr} disabled={pasting}>
              {pasting ? 'Đang dán...' : 'Dán'}
            </button>
            <button type="button" className="btn btn-primary" onClick={doManualSearch} disabled={looking}>
              Tìm
            </button>
          </div>
        </>
      )}

      {(step === 'reader' || step === 'confirm') && book && (
        <div className="scan-flow">
          <div className="card book-card">
            <h3>{book.title}</h3>
            <p className="muted">
              {[book.author, book.category, book.publisher].filter(Boolean).join(' - ') || 'Chưa có thông tin thêm'}
            </p>
            <div className="qr-code-row">
              <p className="qr-code-text">{book.qrCode}</p>
              <CopyButton text={book.bookCode || book.qrCode} />
            </div>
            {book.hasActiveReservation && !scannedReservation && (
              <div className="alert alert-warning">
                Sách đang được đặt trước. Hệ thống sẽ kiểm tra khi xác nhận mượn.
              </div>
            )}
            {scannedReservation && (
              <div className="alert alert-success">
                <strong>Đặt trước hợp lệ.</strong> Độc giả đến lấy theo lịch hẹn, bấm Cho mượn để hoàn tất.
              </div>
            )}
          </div>

          {!scannedReservation && (
          <div className="card">
            <h3>Chọn độc giả</h3>
            <div className="pick-bar">
              <input
                className="input"
                placeholder="Nhập tên hoặc mã sinh viên..."
                value={readerKw}
                onChange={(e) => searchReaders(e.target.value)}
                aria-label="Tìm độc giả"
              />
              <select
                className="input input-sort"
                value={sort}
                onChange={(e) => onSortChange(e.target.value)}
                aria-label="Sắp xếp độc giả"
              >
                <option value="recent_borrow">Mượn gần đây</option>
                <option value="name_asc">Tên A–Z</option>
                <option value="">Mới đăng ký</option>
              </select>
            </div>
            {readersReady && readers.length === 0 && (
              <p className="muted pick-empty">Không tìm thấy độc giả nào.</p>
            )}
            {readers.length > 0 && (
              <ul className="pick-list">
                {readers.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className={`pick-item${selected?.id === u.id ? ' pick-item-active' : ''}`}
                      onClick={() => {
                        setSelected(u);
                        setStep('confirm');
                      }}
                    >
                      <span className="pick-name">{u.fullName}</span>
                      <span className="pick-sub">
                        {[u.studentCode, u.phone].filter(Boolean).join(' - ') || u.username}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
          {scannedReservation && (
          <div className="card">
            <h3>Thông tin đặt trước</h3>
            <dl className="kv">
              <div><dt>Mã đặt trước</dt><dd>{scannedReservation.code}</dd></div>
              <div><dt>Độc giả</dt><dd>{scannedReservation.reader?.fullName}</dd></div>
              {scannedReservation.pickupAt && (
                <div><dt>Lịch hẹn đến lấy</dt><dd>{formatDate(scannedReservation.pickupAt)}</dd></div>
              )}
              <div><dt>Trạng thái</dt><dd><ReservationBadge status={scannedReservation.status} /></dd></div>
            </dl>
          </div>
          )}

          {step === 'confirm' && selected && (
            <div className="card confirm-card">
              <h3>Xác nhận mượn</h3>
              <dl className="kv">
                <div><dt>Sách</dt><dd>{book.title}</dd></div>
                <div><dt>Độc giả</dt><dd>{selected.fullName}{selected.studentCode ? ` (${selected.studentCode})` : ''}</dd></div>
              </dl>
              <div className="btn-row">
                {!scannedReservation && (
                  <button type="button" className="btn btn-secondary" onClick={() => { setSelected(null); setStep('reader'); }}>
                    Chọn lại
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-lg" disabled={submitting} onClick={handleConfirm}>
                  <Icon name="check" size={18} />
                  {submitting ? 'Đang ghi nhận...' : scannedReservation ? 'Cho mượn' : 'Xác nhận mượn'}
                </button>
              </div>
            </div>
          )}

          <button type="button" className="btn btn-ghost" onClick={reset}>
            Quét sách khác
          </button>
        </div>
      )}

      {step === 'done' && result && (
        <div className="card success-card">
          <h3>Mượn thành công</h3>
          <p>
            Độc giả <strong>{result.loan.reader.fullName}</strong> đã mượn sách{' '}
            <strong>{result.loan.book.title}</strong>.
          </p>
          <p className="due-highlight">Hạn trả: {formatDate(result.dueAt)}</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={reset}>
              <Icon name="borrow" size={18} />
              Mượn cuốn khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
