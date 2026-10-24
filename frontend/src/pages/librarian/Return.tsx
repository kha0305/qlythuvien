import { useState, lazy, Suspense } from 'react';
import { getErrorMessage } from '../../api/client';
import { previewReturn, returnBook, type ReturnPreview } from '../../api/loans';
import { formatDate, formatVND } from '../../utils/format';
import { Icon } from '../../components/icons';

// Tải riêng chunk quét QR (chứa @zxing) để trang đầu nhẹ hơn
const QrScanner = lazy(() =>
  import('../../components/QrScanner').then((m) => ({ default: m.QrScanner }))
);

type Step = 'scan' | 'confirm' | 'done';

/**
 * UC05: trả sách tại quầy.
 * Quét QR -> xem phiếu + số ngày trễ + phạt -> xác nhận trả.
 */
export function Return() {
  const [step, setStep] = useState<Step>('scan');
  const [preview, setPreview] = useState<ReturnPreview | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [pasting, setPasting] = useState(false);
  const [error, setError] = useState('');
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [doneFine, setDoneFine] = useState(0);
  const [round, setRound] = useState(0);

  const reset = () => {
    setStep('scan');
    setPreview(null);
    setManualCode('');
    setError('');
    setDoneFine(0);
    setRound((r) => r + 1); // remount QrScanner để bật lại camera
  };

  const handleScan = async (code: string) => {
    setLooking(true);
    setError('');
    try {
      const p = await previewReturn(code);
      setPreview(p);
      setStep('confirm');
    } catch (err) {
      setError(getErrorMessage(err, 'Sách này không trong trạng thái cho mượn.'));
    } finally {
      setLooking(false);
    }
  };

  /** Tra phiếu mượn bằng mã sách nhập tay (mã ngắn VD VH-0001, dùng chung luồng handleScan). */
  const doManualSearch = () => {
    const code = manualCode.trim();
    if (!code) {
      setError('Vui lòng nhập mã sách.');
      return;
    }
    void handleScan(code);
  };

  /** Dán mã sách từ clipboard; báo lỗi rõ ràng nếu bị chặn, không im lặng. */
  const pasteCode = async () => {
    setPasting(true);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError('Clipboard đang trống, không có gì để dán.');
        return;
      }
      setManualCode(text.trim());
      setError('');
    } catch {
      setError('Không đọc được clipboard. Hãy cấp quyền cho trình duyệt hoặc nhập mã bằng tay.');
    } finally {
      setPasting(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setSubmitting(true);
    setError('');
    try {
      const r = await returnBook(preview.loan.id);
      setDoneFine(r.fine);
      setStep('done');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-scan">
      <h2 className="page-title">Trả sách</h2>

      {error && <div className="alert alert-error">{error}</div>}

      {step === 'scan' && (
        <>
          <Suspense fallback={<p className="muted">Đang tải camera...</p>}>
            <QrScanner key={round} mode="return" onScan={handleScan} paused={step !== 'scan'} />
          </Suspense>
          {looking && <p className="muted">Đang tra cứu phiếu mượn...</p>}
          {!looking && error && (
            <button type="button" className="btn btn-secondary" onClick={() => { setError(''); setRound((r) => r + 1); }}>
              Quét lại
            </button>
          )}
          <p className="manual-qr-label">Nhập mã sách thủ công</p>
          <div className="manual-qr">
            <input
              className="input"
              placeholder="Dán hoặc nhập mã sách (VD: VH-0001)..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doManualSearch(); }}
              aria-label="Nhập mã sách thủ công"
            />
            <button type="button" className="btn btn-secondary" onClick={pasteCode} disabled={pasting}>
              {pasting ? 'Đang dán...' : 'Dán'}
            </button>
            <button type="button" className="btn btn-primary" onClick={doManualSearch} disabled={looking}>
              Tìm
            </button>
          </div>
        </>
      )}

      {step === 'confirm' && preview && (
        <div className="scan-flow">
          <div className="card">
            <h3>Phiếu mượn</h3>
            <dl className="kv">
              <div><dt>Sách</dt><dd>{preview.loan.book.title}</dd></div>
              <div><dt>Độc giả</dt><dd>{preview.loan.reader.fullName}</dd></div>
              <div><dt>Ngày mượn</dt><dd>{formatDate(preview.loan.borrowedAt)}</dd></div>
              <div><dt>Hạn trả</dt><dd>{formatDate(preview.loan.dueAt)}</dd></div>
              <div>
                <dt>Số ngày trễ</dt>
                <dd>
                  {preview.overdueDays > 0 ? (
                    <span className="badge badge-red">{preview.overdueDays} ngày</span>
                  ) : (
                    <span className="badge badge-green">Đúng hạn</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Tiền phạt</dt>
                <dd className="fine-value">{formatVND(preview.fine)}</dd>
              </div>
            </dl>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={reset}>
                Quét lại
              </button>
              <button type="button" className="btn btn-primary btn-lg" disabled={submitting} onClick={handleConfirm}>
                <Icon name="check" size={18} />
                {submitting ? 'Đang ghi nhận...' : 'Xác nhận trả'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card success-card">
          <h3>Trả sách thành công</h3>
          <p>
            Sách <strong>{preview?.loan.book.title}</strong> đã được trả.
          </p>
          {doneFine > 0 && (
            <p className="due-highlight">Tiền phạt trễ: {formatVND(doneFine)}</p>
          )}
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={reset}>
              <Icon name="ret" size={18} />
              Trả cuốn khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
