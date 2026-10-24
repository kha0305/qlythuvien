import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import { getErrorMessage } from '../api/client';

/** UC18: nhập email để nhận link đặt lại mật khẩu. */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setSubmitting(true);
    try {
      const message = await forgotPassword(email.trim());
      setSuccess(message || 'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi.');
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
        <h1 className="auth-title">Quên mật khẩu</h1>
        <p className="auth-subtitle">Nhập email bạn đã đăng ký, thư viện sẽ gửi liên kết đặt lại mật khẩu (hiệu lực 30 phút)</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Email đã đăng ký *</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              placeholder="VD: ban@example.com"
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
          </button>
        </form>

        <p className="auth-footer">
          Chưa có tài khoản? <Link to="/register">Đăng ký tại đây</Link>
        </p>
      </div>
    </div>
  );
}
