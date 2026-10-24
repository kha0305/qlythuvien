import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { changeEmail, changePassword, deleteAvatar, getProfile, resendVerification, updateProfile, uploadAvatar } from '../api/profile';
import type { Role, User } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordField';
import { validatePasswordPolicy } from '../utils/password';
import { Skeleton } from '../components/Skeleton';
import { Avatar } from '../components/Avatar';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Quản trị viên',
  librarian: 'Thủ thư',
  reader: 'Độc giả',
};

/** Trang cá nhân: sửa họ tên/SĐT của chính mình + đổi mật khẩu (mọi vai trò). */
export function Profile() {
  const { updateStoredUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [infoError, setInfoError] = useState('');
  const [infoSuccess, setInfoSuccess] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [resending, setResending] = useState(false);

  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  /** Đổi ảnh đại diện: chọn file xong là tải lên ngay. */
  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    setAvatarSuccess('');
    setSavingAvatar(true);
    try {
      const fresh = await uploadAvatar(file);
      setUser(fresh);
      updateStoredUser({ avatarUrl: fresh.avatarUrl ?? null });
      setAvatarSuccess('Đã cập nhật ảnh đại diện.');
    } catch (err) {
      setAvatarError(getErrorMessage(err));
    } finally {
      setSavingAvatar(false);
    }
  }

  /** Xóa ảnh đại diện, quay về chữ cái đầu tên. */
  async function handleDeleteAvatar(): Promise<void> {
    setAvatarError('');
    setAvatarSuccess('');
    setSavingAvatar(true);
    try {
      const fresh = await deleteAvatar();
      setUser(fresh);
      updateStoredUser({ avatarUrl: null });
      setAvatarSuccess('Đã xóa ảnh đại diện.');
    } catch (err) {
      setAvatarError(getErrorMessage(err));
    } finally {
      setSavingAvatar(false);
    }
  }

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await getProfile();
        if (!alive) return;
        setUser(u);
        setFullName(u.fullName);
        setPhone(u.phone ?? '');
        setEmailInput(u.email ?? '');
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleSaveInfo = async (e: FormEvent) => {
    e.preventDefault();
    setInfoError('');
    setInfoSuccess('');
    if (!fullName.trim()) {
      setInfoError('Họ tên không được để trống.');
      return;
    }
    setSavingInfo(true);
    try {
      const updated = await updateProfile({ fullName: fullName.trim(), phone: phone.trim() });
      setUser(updated);
      updateStoredUser({ fullName: updated.fullName, phone: updated.phone });
      setInfoSuccess('Đã lưu thông tin cá nhân.');
    } catch (err) {
      setInfoError(getErrorMessage(err));
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSaveEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailInput.trim())) {
      setEmailError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setSavingEmail(true);
    try {
      const updated = await changeEmail(emailInput.trim());
      setUser(updated);
      updateStoredUser({ email: updated.email, emailVerified: updated.emailVerified });
      setEmailSuccess('Đã cập nhật email. Hệ thống đã gửi liên kết xác thực tới địa chỉ mới — hãy mở hộp thư để xác thực.');
    } catch (err) {
      setEmailError(getErrorMessage(err));
    } finally {
      setSavingEmail(false);
    }
  };

  const handleResendVerification = async () => {
    setEmailError('');
    setEmailSuccess('');
    setResending(true);
    try {
      await resendVerification();
      setEmailSuccess('Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư (cả mục thư rác).');
    } catch (err) {
      setEmailError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');
    if (!currentPassword) {
      setPassError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    const missing = validatePasswordPolicy(newPassword);
    if (missing.length > 0) {
      setPassError(missing.join(' '));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Mật khẩu mới nhập lại không khớp.');
      return;
    }
    setSavingPass(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPassSuccess('Đổi mật khẩu thành công. Lần đăng nhập sau hãy dùng mật khẩu mới.');
    } catch (err) {
      setPassError(getErrorMessage(err));
    } finally {
      setSavingPass(false);
    }
  };

  if (loading)
    return (
      <div className="page profile-page">
        <div className="skeleton skeleton-title" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  if (!user) return <div className="page"><div className="alert alert-error">Không tải được thông tin cá nhân.</div></div>;

  return (
    <div className="page profile-page">
      <h2 className="page-title">Thông tin cá nhân</h2>

      <section className="card">
        <h3 className="card-title">Ảnh đại diện</h3>
        {avatarError && <div className="alert alert-error">{avatarError}</div>}
        {avatarSuccess && <div className="alert alert-success">{avatarSuccess}</div>}
        <div className="avatar-row">
          <Avatar user={user} size={88} />
          <div className="avatar-actions">
            <p className="avatar-name">{user.fullName}</p>
            <p className="field-hint">Ảnh JPEG, PNG hoặc WebP, tối đa 2MB. Ảnh sẽ được cắt giữa để vừa khung tròn.</p>
            <div className="avatar-buttons">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingAvatar}
                onClick={() => avatarInputRef.current?.click()}
              >
                {savingAvatar ? 'Đang tải...' : 'Đổi ảnh'}
              </button>
              {user.avatarUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={savingAvatar}
                  onClick={handleDeleteAvatar}
                >
                  Xóa ảnh
                </button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleAvatarChange}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <form className="form" onSubmit={handleSaveInfo}>
          {infoError && <div className="alert alert-error">{infoError}</div>}
          {infoSuccess && <div className="alert alert-success">{infoSuccess}</div>}
          <div className="form-row">
            <label className="field">
              <span>Tên đăng nhập</span>
              <input className="input" value={user.username} disabled readOnly />
            </label>
            <label className="field">
              <span>Vai trò</span>
              <input className="input" value={ROLE_LABEL[user.role]} disabled readOnly />
            </label>
          </div>
          <label className="field">
            <span>Họ tên *</span>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Số điện thoại</span>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="VD: 0901234567"
              />
            </label>
            <label className="field">
              <span>Mã sinh viên</span>
              <input className="input" value={user.studentCode || '-'} disabled readOnly />
              <small className="field-hint">Mã sinh viên do thủ thư quản lý, bạn không tự sửa được.</small>
            </label>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={savingInfo}>
              {savingInfo ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h3>Email &amp; xác thực</h3>
        <form className="form" onSubmit={handleSaveEmail}>
          {emailError && <div className="alert alert-error">{emailError}</div>}
          {emailSuccess && <div className="alert alert-success">{emailSuccess}</div>}
          <label className="field">
            <span>
              Email{' '}
              {user.email ? (
                user.emailVerified ? (
                  <span className="badge badge-green">Đã xác thực</span>
                ) : (
                  <span className="badge badge-yellow">Chưa xác thực</span>
                )
              ) : (
                <span className="badge badge-yellow">Chưa có email</span>
              )}
            </span>
            <input
              className="input"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              autoComplete="email"
              placeholder="VD: ban@example.com"
            />
            <small className="field-hint">
              Email dùng để nhận nhắc hạn trả sách, xác thực tài khoản và khôi phục mật khẩu khi quên.
              {user.email && !user.emailVerified && ' Đổi email hoặc gửi lại liên kết để hoàn tất xác thực.'}
            </small>
          </label>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={savingEmail}>
              {savingEmail ? 'Đang lưu...' : 'Cập nhật email'}
            </button>
            {user.email && !user.emailVerified && (
              <button type="button" className="btn" disabled={resending} onClick={handleResendVerification}>
                {resending ? 'Đang gửi...' : 'Gửi lại email xác thực'}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h3>Đổi mật khẩu</h3>
        <form className="form" onSubmit={handleChangePassword}>
          {passError && <div className="alert alert-error">{passError}</div>}
          {passSuccess && <div className="alert alert-success">{passSuccess}</div>}
          <PasswordField
            label="Mật khẩu hiện tại *"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordField
            label="Mật khẩu mới *"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            hint="Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số hoặc ký tự đặc biệt."
          />
          <PasswordField
            label="Nhập lại mật khẩu mới *"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={savingPass}>
              {savingPass ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
