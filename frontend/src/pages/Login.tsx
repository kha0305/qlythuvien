import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { homeForRole, useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordField';

/** UC01: đăng nhập, điều hướng theo vai trò. */
export function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setSubmitting(true);
    try {
      const u = await login(username.trim(), password);
      navigate(homeForRole(u.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Sai tên đăng nhập hoặc mật khẩu.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-back">← Trở lại trang chủ</Link>
        <h1 className="auth-title">Thư viện Mini</h1>
        <p className="auth-subtitle">Đăng nhập để quản lý mượn, trả sách</p>

        {searchParams.get('phien') === 'hethan' && (
          <div className="alert alert-warning">
            Phiên đăng nhập đã hết hạn hoặc bạn không có quyền truy cập. Vui lòng đăng nhập lại.
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Tên đăng nhập</span>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>
          <PasswordField
            label="Mật khẩu"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </p>
        <p className="auth-footer">
          Chưa có tài khoản độc giả? <Link to="/register">Đăng ký tại đây</Link>
        </p>
      </div>
    </div>
  );
}
