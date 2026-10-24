import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage } from '../../api/client';
import { createAccount, deleteAccount, listAccounts, setAccountActive } from '../../api/accounts';
import type { User } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';

function isActive(u: User): boolean {
  return u.active === 1 || u.active === true;
}

/** UC10: quản lý tài khoản thủ thư (thêm/khóa/mở/xóa). */
export function Accounts() {
  const { user: me } = useAuth();
  const [accounts, setAccounts] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    setError('');
    try {
      setAccounts(await listAccounts('librarian', s || undefined));
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách tài khoản.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(sort);
  }, [load, sort]);

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFormError('Vui lòng nhập họ tên.');
      return;
    }
    if (!username.trim()) {
      setFormError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (password.length < 6) {
      setFormError('Mật khẩu phải từ 6 ký tự trở lên.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createAccount({ fullName: fullName.trim(), username: username.trim(), password });
      setFormOpen(false);
      setFullName('');
      setUsername('');
      setPassword('');
      load(sort);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await setAccountActive(u.id, !isActive(u));
      load(sort);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAccount(deleteTarget.id);
      setDeleteTarget(null);
      load(sort);
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Quản lý tài khoản thủ thư</h2>
        <button type="button" className="btn btn-primary" onClick={() => { setFormError(''); setFormOpen(true); }}>
          Thêm thủ thư
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <select
          className="input input-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sắp xếp tài khoản"
        >
          <option value="">Mới nhất</option>
          <option value="name_asc">Tên A–Z</option>
          <option value="role">Vai trò</option>
        </select>
      </div>

      {loading ? (
        <Skeleton variant="table" count={5} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon="users"
          title="Chưa có tài khoản thủ thư nào."
          hint="Tạo tài khoản mới bằng nút bên trên."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Tên đăng nhập</th>
                <th>Trạng thái</th>
                <th className="th-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((u) => {
                const active = isActive(u);
                const isMe = me?.id === u.id;
                return (
                  <tr key={u.id}>
                    <td className="td-title">{u.fullName}</td>
                    <td>{u.username}</td>
                    <td>
                      {active ? (
                        <span className="badge badge-green">Hoạt động</span>
                      ) : (
                        <span className="badge badge-red">Bị khóa</span>
                      )}
                    </td>
                    <td className="td-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                        {active ? 'Khóa' : 'Mở khóa'}
                      </button>
                      {!isMe && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-danger-text"
                          onClick={() => setDeleteTarget(u)}
                        >
                          Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        title="Thêm tài khoản thủ thư"
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              Hủy bỏ
            </button>
            <button type="submit" form="account-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        <form id="account-form" className="form" onSubmit={submitForm}>
          <label className="field">
            <span>Họ tên *</span>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="field">
            <span>Tên đăng nhập *</span>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span>Mật khẩu (tối thiểu 6 ký tự) *</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa tài khoản"
        message={`Bạn có chắc muốn xóa tài khoản thủ thư "${deleteTarget?.fullName}"?`}
        confirmLabel="Xóa"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
