import { fileUrl } from '../api/client';
import type { User } from '../api/types';

/** Chữ cái đại diện: ký tự đầu của tên gọi (từ cuối của họ tên tiếng Việt), viết hoa. */
export function nameInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const last = parts.length > 0 ? parts[parts.length - 1] : '?';
  return last.charAt(0).toUpperCase();
}

interface AvatarProps {
  user: Pick<User, 'fullName' | 'avatarUrl'>;
  size?: number;
}

/**
 * Ảnh đại diện tròn của người dùng: có avatarUrl thì hiện ảnh (cắt giữa cho vừa khung),
 * chưa có thì hiện vòng tròn xanh chứa chữ cái đầu tên (kiểu Gmail).
 */
export function Avatar({ user, size = 36 }: AvatarProps) {
  const src = fileUrl(user.avatarUrl);
  if (src) {
    return (
      <img
        className="avatar-circle"
        src={src}
        alt={`Ảnh đại diện của ${user.fullName}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="avatar-circle avatar-initials"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      aria-hidden="true"
    >
      {nameInitial(user.fullName)}
    </span>
  );
}
