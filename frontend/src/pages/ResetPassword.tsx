import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { PasswordField } from '../components/PasswordField';
import { validatePasswordPolicy } from '../utils/password';

/** UC18: đặt mật khẩu mới từ link trong email (token dùng 1 lần, hết hạn sau 30 phút). */
export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const missing = validatePasswordPolicy(password);
    if (missing.length > 0) {
      setError(missing.join(' '));
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setSubmitting(true);
    try {
      const message = await resetPassword(token, password);
      setSuccess(message || 'Đặt lại mật khẩu thành công.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/login" className="auth-back">← Trở lại đăng nhập</Link>
        <h1 className="auth-title">Đặt lại mật khẩu</h1>
        <p className="auth-subtitle">Đặt mật khẩu mới cho tài khoản của bạn</p>

        {!token && (
          <div className="alert alert-error">
            Liên kết thiếu mã xác thực. Hãy mở đúng liên kết trong email, hoặc{' '}
            <Link to="/forgot-password">yêu cầu gửi lại</Link>.
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {success ? (
          <>
            <div className="alert alert-success">{success}</div>
            <Link to="/login" className="btn btn-primary btn-block">Đến trang đăng nhập</Link>
          </>
        ) : (
          token && (
            <form onSubmit={handleSubmit} className="form">
              <PasswordField
                label="Mật khẩu mới *"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                hint="Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số hoặc ký tự đặc biệt."
              />
              <PasswordField
                label="Nhập lại mật khẩu mới *"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? 'Đang đặt lại...' : 'Đặt mật khẩu mới'}
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}
