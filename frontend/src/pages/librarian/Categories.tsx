import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  createCategory,
  deleteCategory,
  listCategories,
  suggestCategoryCode,
  updateCategory,
} from '../../api/categories';
import type { Category } from '../../api/types';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';

/** Quản lý thể loại riêng: thêm/sửa/xóa. Xóa bị chặn khi còn sách dùng thể loại. */
export function Categories() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await listCategories());
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách thể loại.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setCode('');
    setCodeTouched(false);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setCode(c.code);
    setCodeTouched(true);
    setFormError('');
    setFormOpen(true);
  };

  /** Gợi ý mã tự động khi gõ tên (chỉ khi chưa sửa tay). */
  const onNameChange = async (v: string) => {
    setName(v);
    if (!codeTouched && v.trim()) {
      try {
        setCode(await suggestCategoryCode(v.trim()));
      } catch {
        // gợi ý thất bại thì để trống, không chặn
      }
    }
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Tên thể loại không được để trống.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateCategory(editing.id, name.trim(), code.trim() || undefined);
        setNotice('Đã cập nhật thể loại.');
      } else {
        await createCategory(name.trim(), code.trim() || undefined);
        setNotice('Đã thêm thể loại.');
      }
      setFormOpen(false);
      load();
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
      await deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      setNotice('Đã xóa thể loại.');
      load();
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
        <h2 className="page-title">Quản lý thể loại</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
          Thêm thể loại
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {loading ? (
        <Skeleton variant="table" count={5} />
      ) : items.length === 0 ? (
        <EmptyState icon="books" title="Chưa có thể loại nào." hint="Thêm thể loại để dùng trong form sách." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tên thể loại</th>
                <th>Mã</th>
                <th className="th-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="td-title">{c.name}</td>
                  <td><span className="badge badge-gray">{c.code}</span></td>
                  <td className="td-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-danger-text"
                      onClick={() => setDeleteTarget(c)}
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
        title={editing ? 'Sửa thể loại' : 'Thêm thể loại'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              Hủy bỏ
            </button>
            <button type="submit" form="category-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        <form id="category-form" className="form" onSubmit={submitForm}>
          <label className="field">
            <span>Tên thể loại *</span>
            <input className="input" value={name} onChange={(e) => onNameChange(e.target.value)} />
          </label>
          <label className="field">
            <span>Mã thể loại (viết hoa, tối đa 10 ký tự)</span>
            <input
              className="input"
              value={code}
              maxLength={10}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setCodeTouched(true);
              }}
              placeholder="VD: VH"
            />
          </label>
          <p className="muted">Mã dùng để sinh mã sách (VD: VH-0001). Để trống sẽ tự gợi ý từ tên.</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa thể loại"
        message={`Bạn có chắc muốn xóa thể loại "${deleteTarget?.name}"? Không xóa được nếu còn sách dùng thể loại này.`}
        confirmLabel="Xóa"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
