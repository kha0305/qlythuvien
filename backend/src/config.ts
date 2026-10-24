import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${name} (xem .env.example)`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(optional('PORT', '3000')),
  db: {
    host: optional('DB_HOST', 'localhost'),
    port: Number(optional('DB_PORT', '3306')),
    user: optional('DB_USER', 'root'),
    password: optional('DB_PASSWORD', ''),
    database: optional('DB_NAME', 'library_mini'),
    // DB cloud (vd TiDB) bật TLS: đặt DB_SSL=true. DB nội bộ (Botkeep) để false.
    ssl: process.env.DB_SSL === 'true',
  },
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: '8h' as const, // NFR06: token hết hạn sau 8 giờ
  // Deploy lên host: đặt AUTO_IMPORT_DB=true để tự nạp schema + data mẫu
  // khi database còn trống (chỉ chạy khi chưa có bảng users, không đụng dữ liệu cũ).
  autoImportDb: process.env.AUTO_IMPORT_DB === 'true',
  // UC16: tìm sách bằng AI (Gemini). Thiếu key thì hệ thống tự dùng fallback từ khóa.
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: optional('GEMINI_MODEL', 'gemini-flash-lite-latest'),
  },
  // UC17-UC19: gửi email qua Resend (nhắc hạn, quên mật khẩu, xác thực email).
  // Thiếu RESEND_API_KEY thì mọi tính năng email tự tắt, hệ thống vẫn chạy bình thường.
  mail: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: optional('MAIL_FROM', 'Thư Viện Mini <admin@thuvien.nanioe.me>'),
    apiUrl: optional('RESEND_API_URL', 'https://api.resend.com'),
    // Địa chỉ web công khai để dùng link trong email (đặt lại mật khẩu / xác thực).
    appBaseUrl: optional('APP_BASE_URL', 'http://localhost:5173').replace(/\/+$/, ''),
  },
};
