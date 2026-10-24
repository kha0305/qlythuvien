import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage } from '../../api/client';
import { getSettings, updateSettings } from '../../api/settings';
import type { Settings as SettingsData } from '../../api/types';
import { Skeleton } from '../../components/Skeleton';

/** UC09: cấu hình tham số hệ thống (chỉ áp dụng cho phiếu tạo sau thời điểm sửa). */
export function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loanDays, setLoanDays] = useState('');
  const [finePerDay, setFinePerDay] = useState('');
  const [maxBooks, setMaxBooks] = useState('');
  const [reservationHours, setReservationHours] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSettings();
        if (!alive) return;
        setSettings(s);
        setLoanDays(String(s.loanDays));
        setFinePerDay(String(s.finePerDay));
        setMaxBooks(String(s.maxBooksPerReader));
        setReservationHours(String(s.reservationHours));
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'Không tải được cấu hình hệ thống.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const parsePositiveInt = (v: string): number | null => {
    if (!/^\d+$/.test(v.trim())) return null;
    const n = Number(v.trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const parsed = {
      loanDays: parsePositiveInt(loanDays),
      finePerDay: parsePositiveInt(finePerDay),
      maxBooksPerReader: parsePositiveInt(maxBooks),
      reservationHours: parsePositiveInt(reservationHours),
    };
    if (Object.values(parsed).some((v) => v === null)) {
      setError('Giá trị phải là số nguyên dương.');
      return;
    }
    setSaving(true);
    try {
      const s = await updateSettings({
        loanDays: parsed.loanDays as number,
        finePerDay: parsed.finePerDay as number,
        maxBooksPerReader: parsed.maxBooksPerReader as number,
        reservationHours: parsed.reservationHours as number,
      });
      setSettings(s);
      setSuccess('Đã lưu cấu hình. Tham số mới chỉ áp dụng cho các phiếu mượn được tạo sau thời điểm này.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="page">
        <div className="skeleton skeleton-title" />
        <Skeleton variant="card" />
      </div>
    );

  return (
    <div className="page">
      <h2 className="page-title">Cài đặt hệ thống</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {settings && (
        <form className="form card settings-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Số ngày được mượn (loan_days)</span>
            <input className="input" type="number" min={1} value={loanDays} onChange={(e) => setLoanDays(e.target.value)} />
          </label>
          <label className="field">
            <span>Mức phạt mỗi ngày trễ, đồng (fine_per_day)</span>
            <input className="input" type="number" min={1} value={finePerDay} onChange={(e) => setFinePerDay(e.target.value)} />
          </label>
          <label className="field">
            <span>Số cuốn tối đa một độc giả được mượn cùng lúc (max_books_per_reader)</span>
            <input className="input" type="number" min={1} value={maxBooks} onChange={(e) => setMaxBooks(e.target.value)} />
          </label>
          <label className="field">
            <span>Số giờ giữ sách khi đặt trước (reservation_hours)</span>
            <input className="input" type="number" min={1} value={reservationHours} onChange={(e) => setReservationHours(e.target.value)} />
          </label>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
          <p className="muted">
            Lưu ý: tham số mới chỉ áp dụng cho các phiếu mượn/đặt trước tạo sau thời điểm lưu;
            các phiếu cũ giữ nguyên hạn trả và mức phạt đã có.
          </p>
        </form>
      )}
    </div>
  );
}
