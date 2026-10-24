import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { UserRepository } from '../repositories/UserRepository';
import { EmailAccountService } from '../services/EmailAccountService';
import { AppError } from '../utils/errors';
import { toPublicUserDto } from '../utils/dto';
import { passwordPolicyViolations } from '../utils/password';
import { AVATARS_DIR } from '../middleware/upload';

const SALT_ROUNDS = 10;

/** Trang cá nhân: xem/sửa thông tin của chính mình + đổi mật khẩu (mọi vai trò). */
export class ProfileController {
  constructor(
    private readonly userRepo = new UserRepository(),
    private readonly emailAccountService = new EmailAccountService(),
  ) {}

  // GET /api/profile
  getProfile = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userRepo.findById(req.user!.id);
    if (!user) {
      throw new AppError(404, 'Không tìm thấy tài khoản');
    }
    res.json({ data: toPublicUserDto(user) });
  };

  // PUT /api/profile — chỉ cho đổi fullName và phone.
  // studentCode / username / role gửi lên sẽ bị lờ đi (chỉ thủ thư được sửa MSSV).
  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const { fullName, phone } = req.body as { fullName?: string; phone?: string };
    const fields: { fullName?: string; phone?: string | null } = {};
    if (fullName !== undefined) {
      const name = fullName.trim();
      if (!name) {
        throw new AppError(400, 'Họ tên không được để trống');
      }
      fields.fullName = name;
    }
    if (phone !== undefined) {
      const p = phone.trim();
      if (p && !/^[0-9+()\-\s.]{6,20}$/.test(p)) {
        throw new AppError(400, 'Số điện thoại không hợp lệ');
      }
      fields.phone = p || null;
    }
    await this.userRepo.update(req.user!.id, fields);
    const user = await this.userRepo.findById(req.user!.id);
    res.json({ data: toPublicUserDto(user!) });
  };

  // POST /api/profile/avatar (multipart, field "avatar") — tải ảnh đại diện mới, xóa file cũ.
  uploadAvatar = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError(400, 'Vui lòng chọn một ảnh để tải lên');
    }
    const user = await this.userRepo.findById(req.user!.id);
    if (!user) {
      throw new AppError(404, 'Không tìm thấy tài khoản');
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await this.userRepo.update(user.id, { avatarUrl });
    this.removeAvatarFile(user.avatarUrl);
    const fresh = await this.userRepo.findById(user.id);
    res.json({ data: toPublicUserDto(fresh!) });
  };

  // DELETE /api/profile/avatar — gỡ ảnh đại diện, quay về chữ cái đầu tên.
  deleteAvatar = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userRepo.findById(req.user!.id);
    if (!user) {
      throw new AppError(404, 'Không tìm thấy tài khoản');
    }
    await this.userRepo.update(user.id, { avatarUrl: null });
    this.removeAvatarFile(user.avatarUrl);
    const fresh = await this.userRepo.findById(user.id);
    res.json({ data: toPublicUserDto(fresh!) });
  };

  /** Xóa file ảnh cũ trên đĩa (chỉ file trong uploads/avatars, lỗi thì bỏ qua). */
  private removeAvatarFile(avatarUrl: string | null): void {
    if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) return;
    const file = path.join(AVATARS_DIR, path.basename(avatarUrl));
    fs.unlink(file, () => undefined);
  }

  // PUT /api/profile/password — đổi mật khẩu, phải nhập đúng mật khẩu hiện tại.
  changePassword = async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      throw new AppError(400, 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới');
    }
    const user = await this.userRepo.findById(req.user!.id);
    if (!user) {
      throw new AppError(404, 'Không tìm thấy tài khoản');
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError(400, 'Mật khẩu hiện tại không đúng');
    }
    const missing = passwordPolicyViolations(newPassword);
    if (missing.length > 0) {
      throw new AppError(400, `Mật khẩu mới phải có ${missing.join(', ')}`);
    }
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.updatePassword(user.id, hash);
    res.json({ message: 'Đổi mật khẩu thành công' });
  };

  // PUT /api/profile/email — UC19: đổi email (về trạng thái chưa xác thực + gửi link xác thực).
  changeEmail = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as { email?: string };
    const user = await this.emailAccountService.changeEmail(req.user!.id, email ?? '');
    res.json({ data: toPublicUserDto(user), message: 'Đã cập nhật email. Vui lòng mở hộp thư để xác thực địa chỉ mới.' });
  };

  // POST /api/profile/resend-verification — UC19: gửi lại email xác thực.
  resendVerification = async (req: Request, res: Response): Promise<void> => {
    await this.emailAccountService.resendVerification(req.user!.id);
    res.json({ message: 'Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư.' });
  };
}
