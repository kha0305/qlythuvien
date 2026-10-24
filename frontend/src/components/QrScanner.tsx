import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';

interface QrScannerProps {
  /** Chế độ trang đang dùng: mượn hay trả (hiển thị tiêu đề phù hợp). */
  mode: 'borrow' | 'return';
  /** Gọi khi quét được mã QR hợp lệ. */
  onScan: (qrCode: string) => void;
  /** Khi true, sau khi quét xong component không tự bật lại camera. */
  paused?: boolean;
}

/**
 * Khung camera quét mã QR dùng chung cho trang Mượn sách và Trả sách.
 * Ưu tiên camera sau trên điện thoại, có ô nhập tay mã QR dự phòng
 * khi camera không khả dụng (quyền bị từ chối, không HTTPS...).
 */
export function QrScanner({ mode, onScan, paused = false }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scannedRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    if (controlsRef.current || !videoRef.current) return;
    setError(null);
    scannedRef.current = false;
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result) => {
          const text = result?.getText()?.trim();
          // Dừng camera ngay sau lần quét đầu để tránh gọi onScan lặp lại
          if (text && !scannedRef.current) {
            scannedRef.current = true;
            controlsRef.current?.stop();
            controlsRef.current = null;
            setScanning(false);
            onScanRef.current(text);
          }
        }
      );
      controlsRef.current = controls;
      setScanning(true);
    } catch (e) {
      setError(
        'Không truy cập được camera. Hãy kiểm tra quyền camera của trình duyệt ' +
          'và mở trang qua HTTPS hoặc localhost, hoặc nhập tay mã sách bên dưới.'
      );
      if (e instanceof Error && /secure|https/i.test(e.message)) {
        setError('Trình duyệt chặn camera trên kết nối không an toàn. Hãy dùng HTTPS hoặc localhost, hoặc nhập tay mã sách bên dưới.');
      }
    }
  }, []);

  // Tự dừng camera khi trang chuyển sang bước tiếp theo (paused)
  useEffect(() => {
    if (paused) stop();
  }, [paused, stop]);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    // Dừng camera để tránh quét chồng lên mã nhập tay
    scannedRef.current = true;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
    onScanRef.current(code);
  };

  return (
    <div className="qr-scanner">
      <div className="qr-viewport">
        <video ref={videoRef} className="qr-video" playsInline muted />
        {!scanning && !error && (
          <div className="qr-placeholder">
            <p>Camera chưa bật.</p>
            <button type="button" className="btn btn-primary" onClick={start}>
              Bật camera quét mã
            </button>
          </div>
        )}
        {scanning && <div className="qr-frame" aria-hidden="true" />}
      </div>

      {scanning && (
        <button type="button" className="btn btn-secondary" onClick={stop}>
          Tắt camera
        </button>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="qr-manual">
        <p className="qr-manual-label">
          {mode === 'borrow' ? 'Hoặc nhập mã sách:' : 'Hoặc nhập mã sách của cuốn cần trả:'}
        </p>
        <div className="qr-manual-row">
          <input
            type="text"
            className="input"
            placeholder="Dán hoặc nhập mã sách (VD: VH-0001)..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitManual();
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={submitManual}>
            Dùng mã này
          </button>
        </div>
      </div>
    </div>
  );
}
