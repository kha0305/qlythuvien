import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '../context/AuthContext';
import type { Role } from '../api/types';
import { listPendingReservations } from '../api/reservations';
import { unreadNotificationCount } from '../api/notifications';
import { Icon, type IconName } from './icons';
import { Avatar } from './Avatar';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  /** key badge động: 'pendingReservations' -> số lượt đặt chờ duyệt (thủ thư). */
  badgeKey?: 'pendingReservations';
}

const MENUS: Record<Role, NavItem[]> = {
  librarian: [
    { to: '/dashboard', label: 'Tổng quan', icon: 'home', end: true },
    { to: '/books', label: 'Quản lý sách', icon: 'books' },
    { to: '/categories', label: 'Thể loại', icon: 'books' },
    { to: '/readers', label: 'Quản lý độc giả', icon: 'users' },
    { to: '/borrow', label: 'Mượn sách', icon: 'borrow' },
    { to: '/return', label: 'Trả sách', icon: 'ret' },
    { to: '/reservations', label: 'Đặt trước', icon: 'clock', badgeKey: 'pendingReservations' },
    { to: '/overdue', label: 'Quá hạn', icon: 'clock' },
    { to: '/stats', label: 'Thống kê', icon: 'chart' },
    { to: '/notifications', label: 'Thông báo', icon: 'bell' },
    { to: '/profile', label: 'Thông tin cá nhân', icon: 'user' },
  ],
  admin: [
    { to: '/admin', label: 'Tổng quan', icon: 'home', end: true },
    { to: '/admin/accounts', label: 'Quản lý tài khoản', icon: 'userPlus' },
    { to: '/admin/settings', label: 'Cài đặt hệ thống', icon: 'settings' },
    { to: '/stats', label: 'Thống kê', icon: 'chart' },
    { to: '/notifications', label: 'Thông báo', icon: 'bell' },
    { to: '/profile', label: 'Thông tin cá nhân', icon: 'user' },
  ],
  reader: [
    { to: '/reader', label: 'Tìm sách', icon: 'search', end: true },
    { to: '/my-books', label: 'Sách của tôi', icon: 'book' },
    { to: '/notifications', label: 'Thông báo', icon: 'bell' },
    { to: '/profile', label: 'Thông tin cá nhân', icon: 'user' },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Quản trị viên',
  librarian: 'Thủ thư',
  reader: 'Độc giả',
};

/** Layout khung chính: sidebar menu theo vai trò, responsive mobile-first. */
export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Badge số lượt đặt chờ duyệt cho thủ thư (fetch nhẹ mỗi khi vào layout).
  useEffect(() => {
    if (user?.role !== 'librarian') return;
    let alive = true;
    listPendingReservations()
      .then((items) => {
        if (alive) setPendingCount(items.length);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user?.role]);

  // Chuông thông báo: poll số chưa đọc mỗi 5 giây (chỉ khi đã đăng nhập).
  // Tránh request chồng nhau: bỏ qua tick nếu request trước chưa xong.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    let busy = false;
    let timer: number | undefined;
    const tick = async () => {
      if (busy || !alive) return;
      busy = true;
      try {
        const count = await unreadNotificationCount();
        if (alive) setUnreadCount(count);
      } catch {
        // lỗi mạng: giữ số cũ, không chặn UI
      } finally {
        busy = false;
      }
    };
    void tick();
    timer = window.setInterval(tick, 5000);
    return () => {
      alive = false;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [user]);

  if (!user) return null;
  const menu = MENUS[user.role];
  // Tránh lặp "Quản trị viên (Quản trị viên)" khi họ tên trùng tên vai trò.
  const showRole = user.fullName.trim() !== ROLE_LABEL[user.role];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="layout">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => navigate(homeForRole(user.role), { replace: true })}
        >
          Thư viện Đại học
        </button>
        <div className="topbar-user">
          <button
            type="button"
            className="icon-bell"
            onClick={() => navigate('/notifications')}
            aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
            title="Thông báo"
          >
            <Icon name="bell" size={20} />
            {unreadCount > 0 && (
              <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
          <Avatar user={user} size={34} />
          <span className="topbar-name" title={user.username}>
            {user.fullName}{showRole && <em> ({ROLE_LABEL[user.role]})</em>}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            <Icon name="logout" size={16} />
            Đăng xuất
          </button>
        </div>
      </header>

      <nav className="sidenav" aria-label="Menu chính">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
          >
            <Icon name={item.icon} size={18} className="nav-icon" />
            {item.label}
            {item.badgeKey === 'pendingReservations' && pendingCount > 0 && (
              <span className="nav-badge" title={`${pendingCount} lượt chờ duyệt`}>
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <main className="content">
        {user && !user.emailVerified && (
          <div className="email-verify-banner" role="alert">
            {user.email ? (
              <>
                Email <strong>{user.email}</strong> chưa được xác thực — bạn sẽ không nhận được nhắc hạn
                và không khôi phục được mật khẩu khi quên. Hãy mở hộp thư bấm liên kết xác thực, hoặc{' '}
                <Link to="/profile">gửi lại / đổi email tại trang cá nhân</Link>.
              </>
            ) : (
              <>
                Tài khoản của bạn chưa có email — hãy{' '}
                <Link to="/profile">cập nhật email thật tại trang cá nhân</Link> để nhận nhắc hạn trả
                sách và khôi phục mật khẩu khi quên.
              </>
            )}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
