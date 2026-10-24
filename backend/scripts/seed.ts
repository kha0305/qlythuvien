// Seed dữ liệu mẫu: chạy bằng `npm run seed` (tsx scripts/seed.ts).
// Idempotent: bỏ qua user nếu username đã tồn tại, bỏ qua sách nếu tiêu đề đã tồn tại.
import bcrypt from 'bcrypt';
import { pool } from '../src/db/pool';
import { generateQrCode } from '../src/utils/qrcode';
import { RowDataPacket } from 'mysql2/promise';

const SALT_ROUNDS = 10;

interface SeedUser {
  username: string;
  password: string;
  fullName: string;
  role: 'admin' | 'librarian' | 'reader';
}

const USERS: SeedUser[] = [
  { username: 'admin', password: 'admin123', fullName: 'Quản trị viên', role: 'admin' },
  { username: 'thuthu', password: 'lib123', fullName: 'Thủ thư', role: 'librarian' },
  { username: 'docgia', password: 'read123', fullName: 'Độc giả mẫu', role: 'reader' },
];

interface SeedBook {
  title: string;
  author: string;
  category: string;
  publisher: string;
  publishYear: number;
}

const BOOKS: SeedBook[] = [
  { title: 'Dế Mèn phiêu lưu ký', author: 'Tô Hoài', category: 'Văn học', publisher: 'Kim Đồng', publishYear: 2020 },
  { title: 'Truyện Kiều', author: 'Nguyễn Du', category: 'Văn học', publisher: 'Văn học', publishYear: 2019 },
  { title: 'Số đỏ', author: 'Vũ Trọng Phụng', category: 'Văn học', publisher: 'Văn học', publishYear: 2018 },
  { title: 'Tắt đèn', author: 'Ngô Tất Tố', category: 'Văn học', publisher: 'Văn học', publishYear: 2017 },
  { title: 'Chí Phèo', author: 'Nam Cao', category: 'Văn học', publisher: 'Văn học', publishYear: 2021 },
  { title: 'Đại số tuyến tính', author: 'Nguyễn Đình Trí', category: 'Toán học', publisher: 'Giáo dục', publishYear: 2022 },
  { title: 'Giải tích 1', author: 'Trần Bình', category: 'Toán học', publisher: 'Giáo dục', publishYear: 2021 },
  { title: 'Nhập môn lập trình Python', author: 'Trần Đan Thư', category: 'Lập trình', publisher: 'Khoa học Kỹ thuật', publishYear: 2023 },
  { title: 'Cấu trúc dữ liệu và giải thuật', author: 'Lê Minh Hoàng', category: 'Lập trình', publisher: 'Đại học Quốc gia', publishYear: 2022 },
  { title: 'Cơ sở dữ liệu quan hệ', author: 'Nguyễn Bá Tường', category: 'Công nghệ thông tin', publisher: 'Giáo dục', publishYear: 2020 },
];

async function main(): Promise<void> {
  for (const u of USERS) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [u.username]);
    if (rows.length > 0) {
      console.log(`Bỏ qua user đã tồn tại: ${u.username}`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    await pool.query(
      'INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 1)',
      [u.username, hash, u.fullName, u.role],
    );
    console.log(`Đã tạo user: ${u.username} (${u.role})`);
  }

  for (const b of BOOKS) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM books WHERE title = ?', [b.title]);
    if (rows.length > 0) {
      console.log(`Bỏ qua sách đã tồn tại: ${b.title}`);
      continue;
    }
    await pool.query(
      `INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
       VALUES (?, ?, ?, ?, ?, ?, 'available')`,
      [generateQrCode(), b.title, b.author, b.category, b.publisher, b.publishYear],
    );
    console.log(`Đã tạo sách: ${b.title}`);
  }

  await pool.end();
  console.log('Seed hoàn tất.');
}

main().catch((err) => {
  console.error('Seed thất bại:', err);
  process.exit(1);
});
