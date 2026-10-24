import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { homeForRole, useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordField';
import { validatePasswordPolicy } from '../utils/password';

/** UC01: độc giả tự đăng ký tài khoản, xong tự đăng nhập (TC01-4). */
export function Register() {
  const { user, register, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
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
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ tên.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Vui lòng nhập địa chỉ email hợp lệ để nhận nhắc hạn và khôi phục mật khẩu.');
      return;
    }
    if (!username.trim()) {
      setError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    const missing = validatePasswordPolicy(password);
    if (missing.length > 0) {
      setError(missing.join(' '));
      return;
    }
    setSubmitting(true);
    try {
      const u = await register({
        fullName: fullName.trim(),
        username: username.trim(),
        password,
        email: email.trim(),
        studentCode: studentCode.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      navigate(homeForRole(u.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-back">← Trở lại trang chủ</Link>
        <h1 className="auth-title">Đăng ký độc giả</h1>
        <p className="auth-subtitle">Tạo tài khoản để đặt trước và theo dõi sách mượn</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Họ tên *</span>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Mã sinh viên</span>
              <input className="input" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} />
            </label>
            <label className="field">
              <span>Số điện thoại</span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Email *</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="VD: ban@example.com"
            />
            <small className="field-hint">Dùng email thật: thư viện gửi nhắc hạn, link khôi phục mật khẩu và email xác thực vào địa chỉ này.</small>
          </label>
          <label className="field">
            <span>Tên đăng nhập *</span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <PasswordField
            label="Mật khẩu *"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint="Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số hoặc ký tự đặc biệt."
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <p className="auth-footer">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
