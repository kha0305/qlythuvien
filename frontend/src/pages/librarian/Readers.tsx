import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage } from '../../api/client';
import { createReader, deleteReader, listReaders, updateReader } from '../../api/readers';
import type { User } from '../../api/types';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';

interface ReaderForm {
  fullName: string;
  username: string;
  studentCode: string;
  phone: string;
}

const emptyForm: ReaderForm = { fullName: '', username: '', studentCode: '', phone: '' };

/** UC03: quản lý độc giả (thêm/sửa/xóa). */
export function Readers() {
  const [readers, setReaders] = useState<User[]>([]);
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<ReaderForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [formInfo, setFormInfo] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchTimer = useRef<number | undefined>(undefined);

  const load = useCallback(async (kw: string, s: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await listReaders(kw || undefined, s || undefined);
      setReaders(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách độc giả.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(debounced, sort);
  }, [load, debounced, sort]);

  const onSearchChange = (v: string) => {
    setKeyword(v);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => setDebounced(v.trim()), 400);
  };

  const onSortChange = (v: string) => {
    setSort(v);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setFormInfo('Mật khẩu mặc định của độc giả mới là 123456. Hãy chuyển cho độc giả sau khi tạo.');
    setFormOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      fullName: u.fullName,
      username: u.username,
      studentCode: u.studentCode ?? '',
      phone: u.phone ?? '',
    });
    setFormError('');
    setFormInfo('');
    setFormOpen(true);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setFormError('Họ tên không được để trống.');
      return;
    }
    if (!editing && !form.username.trim()) {
      setFormError('Tên đăng nhập không được để trống.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateReader(editing.id, {
          fullName: form.fullName.trim(),
          studentCode: form.studentCode.trim() || undefined,
          phone: form.phone.trim() || undefined,
        });
      } else {
        await createReader({
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          studentCode: form.studentCode.trim() || undefined,
          phone: form.phone.trim() || undefined,
        });
      }
      setFormOpen(false);
      load(debounced, sort);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteReader(deleteTarget.id);
      setDeleteTarget(null);
      load(debounced, sort);
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
        <h2 className="page-title">Quản lý độc giả</h2>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          Thêm độc giả
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input
          className="input input-search"
          placeholder="Tìm theo tên, mã sinh viên, tên đăng nhập..."
          value={keyword}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select
          className="input input-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Sắp xếp độc giả"
        >
          <option value="">Mới đăng ký nhất</option>
          <option value="name_asc">Tên A–Z</option>
          <option value="recent_borrow">Mượn gần đây nhất</option>
        </select>
      </div>

      {loading ? (
        <Skeleton variant="table" count={6} />
      ) : readers.length === 0 ? (
        <EmptyState
          icon="users"
          title="Không tìm thấy độc giả nào."
          hint="Thử từ khóa khác."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Mã SV</th>
                <th>Số điện thoại</th>
                <th>Tên đăng nhập</th>
                <th className="th-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {readers.map((u) => (
                <tr key={u.id}>
                  <td className="td-title">{u.fullName}</td>
                  <td>{u.studentCode || '-'}</td>
                  <td>{u.phone || '-'}</td>
                  <td>{u.username}</td>
                  <td className="td-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-danger-text"
                      onClick={() => setDeleteTarget(u)}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        title={editing ? 'Sửa thông tin độc giả' : 'Thêm độc giả mới'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              Hủy bỏ
            </button>
            <button type="submit" form="reader-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        {formInfo && <div className="alert alert-info">{formInfo}</div>}
        <form id="reader-form" className="form" onSubmit={submitForm}>
          <label className="field">
            <span>Họ tên *</span>
            <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </label>
          {!editing && (
            <label className="field">
              <span>Tên đăng nhập *</span>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </label>
          )}
          <div className="form-row">
            <label className="field">
              <span>Mã sinh viên</span>
              <input className="input" value={form.studentCode} onChange={(e) => setForm({ ...form, studentCode: e.target.value })} />
            </label>
            <label className="field">
              <span>Số điện thoại</span>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa độc giả"
        message={`Bạn có chắc muốn xóa độc giả "${deleteTarget?.fullName}"? Chỉ xóa được khi độc giả không còn cuốn nào chưa trả.`}
        confirmLabel="Xóa"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
