import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { config } from '../config';
import { ensureEmailSchema } from '../db/ensureEmailSchema';
import { User } from '../entities/User';
import { EmailTokenRepository } from '../repositories/EmailTokenRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AppError } from '../utils/errors';
import { isValidEmail, normalizeEmail } from '../utils/emailAddress';
import { passwordPolicyViolations } from '../utils/password';
import { EmailService, emailFooterText, wrapEmailHtml } from './EmailService';

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // link đặt lại mật khẩu sống 30 phút
const VERIFY_TOKEN_TTL_MS = 24 * 3600 * 1000; // link xác thực sống 24 giờ
const RESEND_COOLDOWN_MS = 60 * 1000; // mỗi phút chỉ gửi lại 1 lần

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * UC18 (quên mật khẩu) + UC19 (xác thực email).
 * Token thô (64 ký tự hex) chỉ nằm trong link email; DB chỉ lưu SHA-256 của nó,
 * dùng 1 lần, hết hạn tự động. Tạo token mới sẽ vô hiệu hóa token cũ cùng mục đích.
 */
export class EmailAccountService {
  constructor(
    private readonly emailService = new EmailService(),
    private readonly tokenRepo = new EmailTokenRepository(),
    private readonly userRepo = new UserRepository(),
  ) {}

  private async createToken(userId: number, purpose: 'verify_email' | 'reset_password', ttlMs: number): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.tokenRepo.create(userId, purpose, hashToken(raw), new Date(Date.now() + ttlMs));
    return raw;
  }

  private async consumeToken(rawToken: string, purpose: 'verify_email' | 'reset_password') {
    const token = await this.tokenRepo.findByHash(hashToken(rawToken), purpose);
    if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
      throw new AppError(400, 'Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại.');
    }
    await this.tokenRepo.markUsed(token.id);
    return token;
  }

  /** Gửi email xác thực cho user (đăng ký mới / gửi lại / đổi email). Mail tắt thì bỏ qua lặng lẽ. */
  async sendVerification(user: User): Promise<boolean> {
    if (!user.email || !this.emailService.isEnabled()) return false;
    await ensureEmailSchema();
    const raw = await this.createToken(user.id, 'verify_email', VERIFY_TOKEN_TTL_MS);
    const url = `${config.mail.appBaseUrl}/verify-email?token=${raw}`;
    const title = 'Xác thực email của bạn — Thư viện Đại học';
    await this.emailService.send({
      to: user.email,
      subject: `[Thư viện Đại học] ${title}`,
      text: `Xin chào ${user.fullName},\nVui lòng mở liên kết sau để xác thực email cho tài khoản "${user.username}" (hết hạn sau 24 giờ):\n${url}\nNếu bạn không đăng ký tài khoản này, hãy bỏ qua email.${emailFooterText()}`,
      html: wrapEmailHtml(
        title,
        [`Xin chào ${user.fullName},`, `Vui lòng bấm nút bên dưới để xác thực email cho tài khoản "<strong>${user.username}</strong>".`, 'Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email.'],
        url,
        'Xác thực email',
        [
          { label: 'Tài khoản', value: user.username },
          { label: 'Hiệu lực liên kết', value: '24 giờ · dùng 1 lần' },
        ],
      ),
    });
    return true;
  }

  /** UC19: người dùng đã đăng nhập bấm gửi lại email xác thực (chặn spam 1 lần/phút). */
  async resendVerification(userId: number): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, 'Không tìm thấy tài khoản');
    if (!user.email) throw new AppError(400, 'Tài khoản chưa có email. Hãy cập nhật email trước.');
    if (user.emailVerified) throw new AppError(400, 'Email của bạn đã được xác thực rồi');
    if (!this.emailService.isEnabled()) throw new AppError(503, 'Hệ thống email chưa được cấu hình');
    await ensureEmailSchema();
    const last = await this.tokenRepo.lastCreatedAt(userId, 'verify_email');
    if (last && Date.now() - last.getTime() < RESEND_COOLDOWN_MS) {
      throw new AppError(429, 'Email vừa được gửi. Vui lòng chờ 1 phút rồi thử lại.');
    }
    await this.sendVerification(user);
  }

  /** UC19: đổi email -> email mới ở trạng thái chưa xác thực + gửi link xác thực tới địa chỉ mới. */
  async changeEmail(userId: number, rawEmail: unknown): Promise<User> {
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) throw new AppError(400, 'Địa chỉ email không hợp lệ');
    const existed = await this.userRepo.findByEmail(email);
    if (existed && existed.id !== userId) throw new AppError(409, 'Email này đã được tài khoản khác sử dụng');
    await this.userRepo.update(userId, { email, emailVerified: false });
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, 'Không tìm thấy tài khoản');
    await this.sendVerification(user).catch((err) => {
      console.error('[email] Gửi xác thực sau đổi email thất bại:', err instanceof Error ? err.message : err);
    });
    return user;
  }

  /** UC19: bấm link trong email -> đánh dấu email đã xác thực. */
  async verifyEmail(rawToken: string): Promise<void> {
    await ensureEmailSchema();
    const token = await this.consumeToken(rawToken, 'verify_email');
    await this.userRepo.update(token.userId, { emailVerified: true });
  }

  /**
   * UC18: yêu cầu đặt lại mật khẩu. LUÔN trả về thành công (kể cả email không tồn tại)
   * để không lộ thông tin tài khoản; chỉ gửi email khi tìm thấy tài khoản active có email.
   */
  async requestPasswordReset(rawEmail: unknown): Promise<void> {
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email) || !this.emailService.isEnabled()) return;
    await ensureEmailSchema();
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.isActive()) return;
    const last = await this.tokenRepo.lastCreatedAt(user.id, 'reset_password');
    if (last && Date.now() - last.getTime() < RESEND_COOLDOWN_MS) return;
    const raw = await this.createToken(user.id, 'reset_password', RESET_TOKEN_TTL_MS);
    const url = `${config.mail.appBaseUrl}/reset-password?token=${raw}`;
    const title = 'Đặt lại mật khẩu — Thư viện Đại học';
    await this.emailService.send({
      to: email,
      subject: `[Thư viện Đại học] ${title}`,
      text: `Xin chào ${user.fullName},\nBạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản "${user.username}". Mở liên kết sau và đặt mật khẩu mới (hết hạn sau 30 phút, chỉ dùng được 1 lần):\n${url}\nNếu không phải bạn, hãy bỏ qua email này — mật khẩu của bạn không thay đổi.${emailFooterText()}`,
      html: wrapEmailHtml(
        title,
        [`Xin chào ${user.fullName},`, `Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản "<strong>${user.username}</strong>". Bấm nút bên dưới để đặt mật khẩu mới:`, 'Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không thay đổi.'],
        url,
        'Đặt lại mật khẩu',
        [
          { label: 'Tài khoản', value: user.username },
          { label: 'Hiệu lực liên kết', value: '30 phút · dùng 1 lần' },
        ],
      ),
    });
  }

  /** UC18: đặt mật khẩu mới từ link email. */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    if (!newPassword) throw new AppError(400, 'Mật khẩu mới không được để trống');
    const missing = passwordPolicyViolations(newPassword);
    if (missing.length > 0) {
      throw new AppError(400, `Mật khẩu phải có ${missing.join(', ')}`);
    }
    await ensureEmailSchema();
    const token = await this.consumeToken(rawToken, 'reset_password');
    await this.userRepo.updatePassword(token.userId, await bcrypt.hash(newPassword, SALT_ROUNDS));
  }
}
