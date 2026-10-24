export type UserRole = 'admin' | 'librarian' | 'reader';

export class User {
  id: number;
  username: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  studentCode: string | null;
  phone: string | null;
  // UC17-UC19: email phục vụ nhắc hạn / quên mật khẩu / xác thực. Tài khoản cũ có thể NULL.
  email: string | null;
  emailVerified: boolean;
  // Ảnh đại diện (bản gọn, kha duyệt 23/10/2026): đường dẫn /uploads/avatars/...; NULL = hiện chữ cái đầu tên.
  avatarUrl: string | null;
  active: boolean;

  constructor(data: {
    id: number;
    username: string;
    passwordHash: string;
    fullName: string;
    role: UserRole;
    studentCode?: string | null;
    phone?: string | null;
    email?: string | null;
    emailVerified?: boolean;
    avatarUrl?: string | null;
    active?: boolean;
  }) {
    this.id = data.id;
    this.username = data.username;
    this.passwordHash = data.passwordHash;
    this.fullName = data.fullName;
    this.role = data.role;
    this.studentCode = data.studentCode ?? null;
    this.phone = data.phone ?? null;
    this.email = data.email ?? null;
    this.emailVerified = data.emailVerified ?? false;
    this.avatarUrl = data.avatarUrl ?? null;
    this.active = data.active ?? true;
  }

  isLibrarian(): boolean {
    return this.role === 'librarian';
  }

  isActive(): boolean {
    return this.active;
  }
}
