import { Request, Response } from 'express';
import { signToken } from '../middleware/auth';
import { EmailAccountService } from '../services/EmailAccountService';
import { UserService } from '../services/UserService';
import { toPublicUserDto } from '../utils/dto';

export class AuthController {
  constructor(
    private readonly userService = new UserService(),
    private readonly emailAccountService = new EmailAccountService(),
  ) {}

  // POST /api/auth/login
  login = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body as { username?: string; password?: string };
    const user = await this.userService.authenticate(username ?? '', password ?? '');
    const authUser = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    res.json({ token: signToken(authUser), user: toPublicUserDto(user) });
  };

  // POST /api/auth/register — tạo reader, đồng thời trả token để tự đăng nhập (TC01-4).
  // UC19: sau khi tạo tài khoản, gửi email xác thực (lỗi gửi mail không làm hỏng đăng ký).
  register = async (req: Request, res: Response): Promise<void> => {
    const { username, password, fullName, email, studentCode, phone } = req.body as {
      username?: string;
      password?: string;
      fullName?: string;
      email?: string;
      studentCode?: string;
      phone?: string;
    };
    const user = await this.userService.registerReader({
      username: username ?? '',
      password: password ?? '',
      fullName: fullName ?? '',
      email: email ?? '',
      studentCode,
      phone,
    });
    await this.emailAccountService.sendVerification(user).catch((err) => {
      console.error('[email] Gửi xác thực đăng ký thất bại:', err instanceof Error ? err.message : err);
    });
    const authUser = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    res.status(201).json({ token: signToken(authUser), user: toPublicUserDto(user) });
  };

  // POST /api/auth/forgot-password — UC18. Luôn trả cùng 1 thông điệp (bảo mật).
  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as { email?: string };
    await this.emailAccountService.requestPasswordReset(email ?? '').catch((err) => {
      console.error('[email] Quên mật khẩu thất bại:', err instanceof Error ? err.message : err);
    });
    res.json({ message: 'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư (cả mục thư rác).' });
  };

  // POST /api/auth/reset-password — UC18: token trong link email + mật khẩu mới.
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    await this.emailAccountService.resetPassword(token ?? '', newPassword ?? '');
    res.json({ message: 'Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.' });
  };

  // POST /api/auth/verify-email — UC19: token trong link email xác thực.
  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body as { token?: string };
    await this.emailAccountService.verifyEmail(token ?? '');
    res.json({ message: 'Xác thực email thành công. Cảm ơn bạn!' });
  };
}
