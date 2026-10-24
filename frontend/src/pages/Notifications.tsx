import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type CreateNotificationInput,
} from '../api/notifications';
import type { NotificationItem, NotificationType } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Modal } from '../components/Modal';
import { formatDate } from '../utils/format';

/** Màu badge theo loại thông báo. */
const TYPE_META: Record<NotificationType, { label: string; badge: string }> = {
  reservation: { label: 'Đặt trước', badge: 'badge-yellow' },
  loan: { label: 'Mượn / trả', badge: 'badge-blue' },
  overdue: { label: 'Quá hạn', badge: 'badge-red' },
  general: { label: 'Chung', badge: 'badge-green' },
  system: { label: 'Hệ thống', badge: 'badge-gray' },
};

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'Toàn hệ thống',
  readers: 'Độc giả',
  librarians: 'Thủ thư',
};

/** Trang thông báo cho cả 3 vai trò: xem, đánh dấu đã đọc; admin/thủ thư tạo mới. */
export function Notifications() {
  const { user } = useAuth();
  const canCreate = user?.role === 'admin' || user?.role === 'librarian';

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CreateNotificationInput>({
    audience: 'all',
    type: 'general',
    title: '',
    body: '',
    showOnLanding: false,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await listNotifications());
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được thông báo.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // im lặng: không chặn UI vì chỉ là đánh dấu
    }
  };

  const doMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setNotice('Đã đánh dấu tất cả đã đọc.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Tiêu đề không được để trống.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createNotification({
        audience: form.audience,
        type: form.type,
        title: form.title.trim(),
        body: form.body?.trim() || undefined,
        showOnLanding: form.type === 'general' ? form.showOnLanding : false,
      });
      setFormOpen(false);
      setForm({ audience: 'all', type: 'general', title: '', body: '', showOnLanding: false });
      setNotice('Đã tạo thông báo.');
      load();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Thông báo{unread > 0 ? ` (${unread} chưa đọc)` : ''}</h2>
        <div className="btn-row">
          {items.length > 0 && unread > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={doMarkAllRead}>
              Đánh dấu tất cả đã đọc
            </button>
          )}
          {canCreate && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormOpen(true)}>
              Tạo thông báo
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {loading ? (
        <Skeleton variant="card" count={4} />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title="Chưa có thông báo nào." hint="Thông báo mới sẽ hiện ở đây." />
      ) : (
        <div className="notif-list">
          {items.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.system;
            return (
              <article key={n.id} className={`card notif-card${n.isRead ? ' notif-read' : ''}`}>
                <div className="notif-head">
                  <span className={`badge ${meta.badge}`}>{meta.label}</span>
                  <span className="muted notif-time">{formatDate(n.createdAt)}</span>
                </div>
                <h3 className="notif-title">{n.title}</h3>
                {n.body && <p className="notif-body">{n.body}</p>}
                <div className="notif-foot">
                  <span className="muted">Đến: {AUDIENCE_LABEL[n.audience] ?? n.audience}</span>
                  {!n.isRead && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => doMarkRead(n.id)}
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Form tạo thông báo (admin/thủ thư) */}
      <Modal
        open={formOpen}
        title="Tạo thông báo mới"
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              Hủy bỏ
            </button>
            <button type="submit" form="notif-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang gửi...' : 'Gửi thông báo'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        <form id="notif-form" className="form" onSubmit={submitForm}>
          <label className="field">
            <span>Tiêu đề *</span>
            <input
              className="input"
              value={form.title}
              maxLength={255}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Nội dung</span>
            <textarea
              className="input"
              rows={3}
              maxLength={2000}
              value={form.body ?? ''}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Đối tượng nhận</span>
              <select
                className="input"
                value={form.audience}
                onChange={(e) =>
                  setForm({ ...form, audience: e.target.value as CreateNotificationInput['audience'] })
                }
              >
                <option value="all">Toàn hệ thống</option>
                <option value="readers">Tất cả độc giả</option>
                <option value="librarians">Tất cả thủ thư</option>
              </select>
            </label>
            <label className="field">
              <span>Loại thông báo</span>
              <select
                className="input"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as CreateNotificationInput['type'] })
                }
              >
                <option value="general">Chung (xanh lá)</option>
                <option value="reservation">Đặt trước (vàng)</option>
                <option value="loan">Mượn / trả (xanh dương)</option>
                <option value="overdue">Quá hạn (đỏ)</option>
                <option value="system">Hệ thống (xám)</option>
              </select>
            </label>
          </div>
          {form.type === 'general' && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.showOnLanding}
                onChange={(e) => setForm({ ...form, showOnLanding: e.target.checked })}
              />
              <span>Hiển thị dạng thẻ nổi ở trang chủ (landing)</span>
            </label>
          )}
        </form>
      </Modal>
    </div>
  );
}
