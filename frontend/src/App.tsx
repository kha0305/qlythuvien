import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { homeForRole, useAuth } from './context/AuthContext';
import type { Role } from './api/types';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { VerifyEmail } from './pages/VerifyEmail';
import { Profile } from './pages/Profile';
import { Landing } from './pages/Landing';
import { BookDetailPublic } from './pages/BookDetailPublic';
import { AdminHome } from './pages/admin/AdminHome';
import { Accounts } from './pages/admin/Accounts';
import { Settings } from './pages/admin/Settings';
import { Dashboard } from './pages/librarian/Dashboard';
import { Books } from './pages/librarian/Books';
import { Readers } from './pages/librarian/Readers';
import { Borrow } from './pages/librarian/Borrow';
import { Return } from './pages/librarian/Return';
import { Overdue } from './pages/librarian/Overdue';
import { LibrarianReservations } from './pages/librarian/Reservations';
import { Stats } from './pages/librarian/Stats';
import { ReaderHome } from './pages/reader/Home';
import { BookDetail } from './pages/reader/BookDetail';
import { MyBooks } from './pages/reader/MyBooks';
import { Notifications } from './pages/Notifications';
import { Categories } from './pages/librarian/Categories';

/** Chặn route theo đăng nhập và vai trò; sai vai trò thì về trang chủ của chính mình. */
function ProtectedRoute({ children, roles }: { children: ReactElement; roles?: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="center-page">
        <div className="skeleton skeleton-line" style={{ width: '220px' }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return children;
}

/** Route gốc: điều hướng về trang chủ đúng vai trò. */
function RootRoute() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="center-page">
        <div className="skeleton skeleton-line" style={{ width: '220px' }} />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeForRole(user.role)} replace />;
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Trang chủ',
  '/login': 'Đăng nhập',
  '/register': 'Đăng ký',
  '/forgot-password': 'Quên mật khẩu',
  '/reset-password': 'Đặt lại mật khẩu',
  '/verify-email': 'Xác thực email',
  '/dashboard': 'Tổng quan',
  '/books': 'Quản lý sách',
  '/readers': 'Quản lý độc giả',
  '/borrow': 'Mượn sách',
  '/return': 'Trả sách',
  '/reservations': 'Đơn đặt trước',
  '/overdue': 'Sách quá hạn',
  '/categories': 'Thể loại',
  '/admin': 'Quản trị hệ thống',
  '/admin/accounts': 'Quản lý tài khoản',
  '/admin/settings': 'Cài đặt hệ thống',
  '/stats': 'Thống kê',
  '/reader': 'Trang độc giả',
  '/my-books': 'Sách đang mượn',
  '/profile': 'Thông tin cá nhân',
  '/notifications': 'Thông báo',
};

// Cập nhật tiêu đề tab trình duyệt theo trang đang mở: "<Trang> - Thư Viện Mini"
function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Trang chi tiết sách tự đặt tiêu đề theo tên sách khi đã tải xong dữ liệu
    if (pathname.startsWith('/sach/') || pathname.startsWith('/reader/books/')) return;
    const name = PAGE_TITLES[pathname];
    document.title = name ? `${name} - Thư Viện Mini` : 'Thư Viện Mini';
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <PageTitle />
      <Routes>
        {/* Landing page public: không cần đăng nhập. */}
        <Route path="/" element={<Landing />} />
        <Route path="/sach/:id" element={<BookDetailPublic />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Thủ thư */}
        <Route
          element={
            <ProtectedRoute roles={['librarian']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/books" element={<Books />} />
          <Route path="/readers" element={<Readers />} />
          <Route path="/borrow" element={<Borrow />} />
          <Route path="/return" element={<Return />} />
          <Route path="/reservations" element={<LibrarianReservations />} />
          <Route path="/overdue" element={<Overdue />} />
          <Route path="/categories" element={<Categories />} />
        </Route>

        {/* Admin */}
        <Route
          element={
            <ProtectedRoute roles={['admin']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/accounts" element={<Accounts />} />
          <Route path="/admin/settings" element={<Settings />} />
        </Route>

        {/* Thống kê: thủ thư + admin */}
        <Route
          element={
            <ProtectedRoute roles={['librarian', 'admin']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/stats" element={<Stats />} />
        </Route>

        {/* Độc giả */}
        <Route
          element={
            <ProtectedRoute roles={['reader']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/reader" element={<ReaderHome />} />
          <Route path="/reader/books/:id" element={<BookDetail />} />
          <Route path="/my-books" element={<MyBooks />} />
        </Route>

        {/* Trang cá nhân: mọi vai trò đã đăng nhập đều dùng được */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        <Route path="*" element={<RootRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
