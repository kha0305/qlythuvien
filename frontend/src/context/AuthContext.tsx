import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { login as apiLogin, register as apiRegister, type RegisterInput } from '../api/auth';
import { getProfile } from '../api/profile';
import type { Role, User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
  /** Cập nhật thông tin user đã lưu (sau khi sửa trang cá nhân), không cần đăng nhập lại. */
  updateStoredUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw) as User;
    return u && typeof u.id === 'number' ? u : null;
  } catch {
    return null;
  }
}

/** Trang chủ mặc định theo vai trò (đúng screenmap). */
export function homeForRole(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'reader') return '/reader';
  return '/dashboard';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = readStoredUser();
    if (t && u) {
      setToken(t);
      setUser(u);
      // Làm mới thông tin user từ server: bản đã lưu có thể cũ (ví dụ vừa bấm link
      // xác thực email ở tab khác) khiến banner/trạng thái hiển thị sai.
      getProfile()
        .then((fresh) => {
          localStorage.setItem('user', JSON.stringify(fresh));
          setUser(fresh);
        })
        .catch(() => {
          // Mất mạng/ lỗi tạm thời: giữ bản đã lưu, không đăng xuất người dùng.
        });
    }
    setLoading(false);
  }, []);

  const persist = useCallback((t: string, u: User) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<User> => {
      const payload = await apiLogin(username, password);
      persist(payload.token, payload.user);
      return payload.user;
    },
    [persist]
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<User> => {
      await apiRegister(input);
      // TC01-4: đăng ký xong tự đăng nhập
      return login(input.username, input.password);
    },
    [login]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const updateStoredUser = useCallback(
    (patch: Partial<User>) => {
      setUser((prev) => {
        const base = prev ?? readStoredUser();
        if (!base) return prev;
        const next = { ...base, ...patch };
        localStorage.setItem('user', JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, updateStoredUser }),
    [user, token, loading, login, register, logout, updateStoredUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong AuthProvider');
  return ctx;
}
