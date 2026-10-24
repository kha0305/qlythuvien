import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** UC19: trang đích của link xác thực email — tự gọi API 1 lần khi mở. */
export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user, updateStoredUser } = useAuth();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    if (!token) {
      setState('error');
      setMessage('Liên kết thiếu mã xác thực.');
      return;
    }
    (async () => {
      try {
        const msg = await verifyEmail(token);
        setState('ok');
        setMessage(msg || 'Xác thực email thành công.');
        updateStoredUser({ emailVerified: true });
      } catch (err) {
        setState('error');
        setMessage(getErrorMessage(err));
      }
    })();
    // Chỉ chạy 1 lần khi mở trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Xác thực email</h1>
        {state === 'loading' && <p className="auth-subtitle">Đang xác thực, vui lòng chờ...</p>}
        {state === 'ok' && (
          <>
            <div className="alert alert-success">{message}</div>
            <p className="auth-subtitle">Từ nay thư viện có thể gửi nhắc hạn trả sách và hỗ trợ khôi phục mật khẩu qua email này.</p>
            <Link to={user ? '/profile' : '/login'} className="btn btn-primary btn-block">
              {user ? 'Về trang cá nhân' : 'Đến trang đăng nhập'}
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="alert alert-error">{message}</div>
            <p className="auth-subtitle">Liên kết có thể đã hết hạn (24 giờ) hoặc đã được dùng. Bạn có thể gửi lại email xác thực trong trang cá nhân.</p>
            <Link to={user ? '/profile' : '/login'} className="btn btn-primary btn-block">
              {user ? 'Về trang cá nhân' : 'Đến trang đăng nhập'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
