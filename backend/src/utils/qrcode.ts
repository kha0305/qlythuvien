import crypto from 'crypto';

// Sinh qr_code cho sách: UUID hex 32 ký tự, không bao giờ đổi (D2).
export function generateQrCode(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
