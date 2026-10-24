import axios from 'axios';

/**
 * Axios client dùng chung cho toàn bộ frontend.
 * - baseURL lấy từ biến môi trường VITE_API_URL, mặc định http://localhost:3001/api
 * - Tự gắn header Authorization: Bearer <token> cho mọi request
 * - Gặp 401/403: xóa phiên và đá về trang đăng nhập kèm thông báo
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 15000,
});

/** Origin của backend (bỏ đuôi /api): dùng để tạo URL tuyệt đối cho file uploads. */
export const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

/** Tạo URL tuyệt đối cho cover (coverUrl dạng /uploads/covers/...). */
export function fileUrl(p: string | null | undefined): string | undefined {
  if (!p) return undefined;
  if (/^https?:\/\//i.test(p)) return p;
  return `${API_ORIGIN}${p.startsWith('/') ? p : `/${p}`}`;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?phien=hethan';
    }
    return Promise.reject(err);
  }
);

/** Trích message lỗi tiếng Việt mà backend trả về. */
export function getErrorMessage(err: unknown, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object' && 'message' in data) {
      const msg = (data as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
