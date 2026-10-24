import bcrypt from 'bcrypt';
import { User, UserRole } from '../entities/User';
import { UserRepository } from '../repositories/UserRepository';
import { LoanRepository } from '../repositories/LoanRepository';
import { AppError } from '../utils/errors';
import { isValidEmail, normalizeEmail } from '../utils/emailAddress';
import { passwordPolicyViolations } from '../utils/password';

export interface RegisterReaderInput {
  username: string;
  password: string;
  fullName: string;
  email: string;
  studentCode?: string;
  phone?: string;
}

export interface CreateReaderByLibrarianInput {
  username: string;
  fullName: string;
  studentCode?: string;
  phone?: string;
}

const SALT_ROUNDS = 10;
const DEFAULT_READER_PASSWORD = '123456'; // D8: mật khẩu mặc định khi thủ thư tạo độc giả

export class UserService {
  constructor(
    private readonly userRepo = new UserRepository(),
    private readonly loanRepo = new LoanRepository(),
  ) {}

  // UC01: đăng nhập. Sai thông tin -> 401; tài khoản bị khóa -> 403.
  async authenticate(username: string, password: string): Promise<User> {
    const user = await this.userRepo.findByUsername(username.trim());
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'Sai tên đăng nhập hoặc mật khẩu');
    }
    if (!user.isActive()) {
      throw new AppError(403, 'Tài khoản đã bị khóa');
    }
    return user;
  }

  // UC01 + UC19: độc giả tự đăng ký — bắt buộc email thật (phục vụ xác thực,
  // quên mật khẩu và nhắc hạn). Email chưa xác thực vẫn đăng nhập được bình thường.
  async registerReader(input: RegisterReaderInput): Promise<User> {
    const username = input.username?.trim();
    const fullName = input.fullName?.trim();
    const email = normalizeEmail(input.email);
    if (!username) {
      throw new AppError(400, 'Tên đăng nhập không được để trống');
    }
    if (!fullName) {
      throw new AppError(400, 'Họ tên không được để trống');
    }
    if (!isValidEmail(email)) {
      throw new AppError(400, 'Vui lòng nhập địa chỉ email hợp lệ');
    }
    if (!input.password) {
      throw new AppError(400, 'Mật khẩu không được để trống');
    }
    const missing = passwordPolicyViolations(input.password);
    if (missing.length > 0) {
      throw new AppError(400, `Mật khẩu phải có ${missing.join(', ')}`);
    }
    const existed = await this.userRepo.findByUsername(username);
    if (existed) {
      throw new AppError(409, 'Tên đăng nhập đã được sử dụng');
    }
    const emailExisted = await this.userRepo.findByEmail(email);
    if (emailExisted) {
      throw new AppError(409, 'Email này đã được tài khoản khác sử dụng');
    }
    const user = new User({
      id: 0,
      username,
      passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
      fullName,
      role: 'reader',
      studentCode: input.studentCode?.trim() || null,
      phone: input.phone?.trim() || null,
      email,
      emailVerified: false,
      active: true,
    });
    return this.userRepo.save(user);
  }

  // UC03: thủ thư tạo độc giả, mật khẩu mặc định 123456 (D8).
  async createReader(input: CreateReaderByLibrarianInput): Promise<User> {
    const username = input.username?.trim();
    const fullName = input.fullName?.trim();
    if (!username) {
      throw new AppError(400, 'Tên đăng nhập không được để trống');
    }
    if (!fullName) {
      throw new AppError(400, 'Họ tên không được để trống');
    }
    const existed = await this.userRepo.findByUsername(username);
    if (existed) {
      throw new AppError(409, 'Tên đăng nhập đã được sử dụng');
    }
    const user = new User({
      id: 0,
      username,
      passwordHash: await bcrypt.hash(DEFAULT_READER_PASSWORD, SALT_ROUNDS),
      fullName,
      role: 'reader',
      studentCode: input.studentCode?.trim() || null,
      phone: input.phone?.trim() || null,
      active: true,
    });
    return this.userRepo.save(user);
  }

  async listReaders(keyword: string | undefined, page: number, limit: number, sort?: string) {
    return this.userRepo.listReaders(keyword?.trim() || undefined, page, limit, sort);
  }

  // UC03: sửa họ tên / mã SV / SĐT, không đổi username.
  async updateReader(id: number, input: { fullName?: string; studentCode?: string | null; phone?: string | null }): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user || user.role !== 'reader') {
      throw new AppError(404, 'Không tìm thấy độc giả');
    }
    if (input.fullName !== undefined && !input.fullName.trim()) {
      throw new AppError(400, 'Họ tên không được để trống');
    }
    await this.userRepo.update(id, {
      fullName: input.fullName?.trim(),
      studentCode: input.studentCode,
      phone: input.phone,
    });
    const updated = await this.userRepo.findById(id);
    if (!updated) {
      throw new AppError(404, 'Không tìm thấy độc giả');
    }
    return updated;
  }

  // UC03 + D9: chỉ xóa khi độc giả không còn phiếu borrowing.
  async deleteReader(id: number): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user || user.role !== 'reader') {
      throw new AppError(404, 'Không tìm thấy độc giả');
    }
    const activeCount = await this.loanRepo.countActiveByReader(id);
    if (activeCount > 0) {
      throw new AppError(400, `Độc giả còn ${activeCount} cuốn chưa trả, không thể xóa`);
    }
    await this.userRepo.delete(id);
  }

  // UC10: admin tạo tài khoản thủ thư.
  async createLibrarian(input: { username: string; password: string; fullName: string }): Promise<User> {
    const username = input.username?.trim();
    const fullName = input.fullName?.trim();
    if (!username) {
      throw new AppError(400, 'Tên đăng nhập không được để trống');
    }
    if (!fullName) {
      throw new AppError(400, 'Họ tên không được để trống');
    }
    if (!input.password || input.password.length < 6) {
      throw new AppError(400, 'Mật khẩu phải từ 6 ký tự trở lên');
    }
    const existed = await this.userRepo.findByUsername(username);
    if (existed) {
      throw new AppError(409, 'Tên đăng nhập đã được sử dụng');
    }
    const user = new User({
      id: 0,
      username,
      passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
      fullName,
      role: 'librarian',
      active: true,
    });
    return this.userRepo.save(user);
  }

  // UC10: khóa / mở khóa tài khoản; không được tự khóa chính mình.
  async setAccountActive(id: number, active: boolean, actorId: number): Promise<User> {
    if (id === actorId) {
      throw new AppError(400, 'Không thể tự khóa tài khoản của chính mình');
    }
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new AppError(404, 'Không tìm thấy tài khoản');
    }
    await this.userRepo.update(id, { active });
    const updated = await this.userRepo.findById(id);
    if (!updated) {
      throw new AppError(404, 'Không tìm thấy tài khoản');
    }
    return updated;
  }

  // UC10 + D9: không tự xóa, không xóa admin cuối cùng.
  async deleteAccount(id: number, actorId: number): Promise<void> {
    if (id === actorId) {
      throw new AppError(400, 'Không thể tự xóa tài khoản của chính mình');
    }
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new AppError(404, 'Không tìm thấy tài khoản');
    }
    if (user.role === 'admin') {
      const adminCount = await this.userRepo.countByRole('admin');
      if (adminCount <= 1) {
        throw new AppError(400, 'Không thể xóa admin cuối cùng của hệ thống');
      }
    }
    await this.userRepo.delete(id);
  }

  async listAccounts(role: UserRole | undefined, sort?: string) {
    if (role) {
      return this.userRepo.listByRole(role, sort);
    }
    return this.userRepo.listByRoles(['admin', 'librarian'], sort);
  }
}
