# Web Quản Lý Thư Viện Mini — Đồ án CDIO 4

## 0. Lấy code mới bằng git pull (từ 24/10/2026, thay cho gói zip)

Repo code app: https://github.com/kha0305/qlythuvien (public).

```bash
git clone https://github.com/kha0305/qlythuvien.git
cd qlythuvien
# Lần sau có cập nhật, chỉ cần:
git pull
```

Lưu ý khi pull rồi deploy:
- Không bao giờ commit `.env` (đã có trong `.gitignore`); file `.env` trên server giữ nguyên, chỉ thêm key mới khi có tính năng mới cần (vd `BIGBOOK_API_KEY` cho tra cứu sách, để trống thì tự fallback sang iTunes Search).
- Build backend: `cd backend && npm run build` (không dùng `npx tsc -b`, lệnh đó không xuất `dist/`).
- Build frontend để deploy: bắt buộc `VITE_API_URL=/api npm run build` rồi grep bundle kiểm tra 0 lần `localhost:3001` (file `.env` local ghim `localhost:3001` chỉ dùng cho dev).
- Sau khi pull + build xong thì Restart server rồi test thật.

Website quản lý thư viện mini: mượn/trả sách bằng quét mã QR, độc giả đặt trước
sách online, tự động tính hạn trả và phạt trễ, thống kê trực quan.

- **Backend:** Node 24 + Express + TypeScript, kiến trúc OOP
  (Entity → Service → Controller → Repository → MySQL)
- **Frontend:** React 18 + Vite + TypeScript, react-router-dom, axios
- **Database:** MySQL 8

Tài liệu đặc tả (bản chốt): `../HO-SO-PHAN-TICH-THIET-KE.md`.

## 1. Yêu cầu môi trường

- Node.js >= 18, npm >= 9
- MySQL 8 (tạo database và user trước)

## 2. Tạo database

```bash
mysql -u root -p < db/schema.sql
```

File `db/schema.sql` tạo database `library_mini` và 5 bảng:
`users`, `books`, `loans`, `reservations`, `settings` (kèm 1 dòng cấu hình mặc định:
mượn 14 ngày, phạt 5.000đ/ngày, tối đa 5 cuốn, giữ đặt trước 48 giờ).

> **Nâng cấp DB hiện có (16/10/2026 — luồng duyệt đặt trước):** nếu database
> `library_mini` đã tạo từ trước, chạy file `db/migrate-reservation-approval.sql`
> trong phpMyAdmin (chọn DB → tab SQL → dán nội dung file → Go) để thêm các cột
> `reader_note`, `pickup_at`, `reviewed_by`, `reviewed_at`, `reject_reason` và mở
> rộng `status` của bảng `reservations`. DB tạo mới từ `db/schema.sql` thì đã có
> sẵn, không cần chạy.

## 3. Chạy cả backend + frontend bằng 1 lệnh (Windows)

Mở 1 terminal duy nhất tại thư mục `app/`, chạy:

```bat
run-all.bat
```

File này dùng `npx concurrently` để chạy backend (xanh lá) và frontend (xanh dương) chung 1 cửa sổ, log có gắn tên từng bên. Nhấn `Ctrl+C` là dừng cả 2. Lần chạy đầu tiên cần mạng để npx tải concurrently.

## 4. Chạy backend (riêng lẻ)

```bash
cd backend
npm install
cp .env.example .env
# sửa .env: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME=library_mini, JWT_SECRET, PORT=3001
npm run seed   # tạo sẵn: admin/admin123, thuthu/lib123, docgia/read123 + 10 sách mẫu
npm run dev    # chạy dev tại http://localhost:3001
```

Các lệnh khác:

| Lệnh | Mô tả |
|---|---|
| `npm run build` | biên dịch TypeScript ra `dist/` |
| `npm start` | chạy bản đã build (`node dist/index.js`) |
| `npx tsc --noEmit` | kiểm tra kiểu |
| `npx tsx tests/logic.test.ts` | test logic thuần (quá hạn/phạt/đặt trước, không cần DB) |

## 5. Chạy frontend (riêng lẻ)

```bash
cd frontend
npm install
cp .env.example .env
# sửa .env nếu backend không chạy ở mặc định: VITE_API_URL=http://localhost:3001/api
npm run dev    # chạy dev tại http://localhost:5173
```

Các lệnh khác:

| Lệnh | Mô tả |
|---|---|
| `npm run build` | build production ra `dist/` |
| `npm run preview` | xem thử bản build |
| `npx tsc --noEmit` | kiểm tra kiểu |

## 6. Tài khoản dùng thử (sau khi seed)

| Vai trò | Username | Mật khẩu |
|---|---|---|
| Admin | `admin` | `admin123` |
| Thủ thư | `thuthu` | `lib123` |
| Độc giả | `docgia` | `read123` |

## 7. Quy ước API

- Prefix: `/api`. Mọi API (trừ đăng nhập/đăng ký và API public) cần header
  `Authorization: Bearer <token>` (JWT hết hạn sau 8 giờ).
- Response thành công dạng `{ data: ... }`; lỗi dạng `{ message: "..." }`
  (tiếng Việt có dấu).
- Sai vai trò → HTTP 403.

### 6.1. API public (không cần đăng nhập, phục vụ landing page `/`)

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/public/books?keyword=&category=&page=&limit=` | Danh sách sách, phân trang |
| GET | `/api/public/books/:id` | Chi tiết một sách |
| GET | `/api/public/categories` | Danh sách thể loại (distinct) |
| GET | `/api/public/stats` | `{ totalBooks, availableBooks, totalReaders }` |

DTO public chỉ gồm `id, title, author, category, publisher, publishYear, status` —
không bao giờ trả `qr_code` hay thông tin người dùng.

### 6.2. Landing page public

Route `/` là trang giới thiệu không cần đăng nhập: hero + tìm kiếm sách,
số liệu thật từ API public, 4 thẻ tính năng, catalog sách (tìm kiếm, lọc thể
loại, phân trang), bấm vào sách xem chi tiết tại `/sach/:id`. Đã đăng nhập mà
vào `/` sẽ tự chuyển về trang chủ theo vai trò.

### 6.3. Duyệt đặt trước (mới 16/10/2026)

Luồng: độc giả đặt trước (+ ghi chú giờ mong muốn) → `pending` (badge vàng,
khóa đúng id cuốn đó) → thủ thư vào trang **Đặt trước** (menu có badge đếm số
chờ duyệt) bấm **Duyệt** + chốt lịch hẹn → `approved` (badge xanh, giữ chỗ đến
giờ hẹn + 2 giờ), hoặc **Không duyệt** (+ lý do) → `rejected` (badge đỏ). Quá
hạn duyệt (48h) hoặc quá giờ hẹn + 2h không đến → tự `expired` (lazy, không cần
cron). Độc giả xem trạng thái + lịch hẹn ở tab "Đặt trước", chỉ hủy được khi còn
`pending`.

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/reservations` | reader | `{ bookId, readerNote? }` → `pending` |
| GET | `/api/reservations/my` | reader | Mọi lượt đặt của mình (mọi trạng thái) |
| DELETE | `/api/reservations/:id` | reader | Hủy (chỉ khi `pending`) |
| GET | `/api/reservations/pending` | librarian | Danh sách chờ duyệt |
| POST | `/api/reservations/:id/approve` | librarian | `{ pickupAt }` (ISO datetime tương lai) |
| POST | `/api/reservations/:id/reject` | librarian | `{ reason? }` |

### 6.4. Trang cá nhân (cần đăng nhập, mọi vai trò)

Route `/profile` trong menu: sửa họ tên/SĐT của chính mình; mã sinh viên chỉ
xem (chỉ thủ thư sửa được ở trang Quản lý độc giả); đổi mật khẩu phải nhập
đúng mật khẩu hiện tại, mật khẩu mới theo policy (8+ ký tự, 1 hoa, 1 thường,
1 số/ký tự đặc biệt).

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/profile` | Thông tin của chính mình (không trả password_hash) |
| PUT | `/api/profile` | Chỉ đổi được `fullName`, `phone` (MSSV/role/username bị bỏ qua) |
| PUT | `/api/profile/password` | `{ currentPassword, newPassword }`, check pass cũ + policy |

Danh sách endpoint đầy đủ xem `../HO-SO-PHAN-TICH-THIET-KE.md`.
Lưu ý: trả sách gồm 2 bước theo UC05 —
`GET /api/loans/return-preview?qrCode=` (xem trước, chưa chốt) rồi
`POST /api/loans/return { loanId }` (xác nhận, chốt phạt).

## 8. Lưu ý khi dùng camera quét QR

- Trang Mượn/Trả sách dùng camera của thiết bị; trình duyệt yêu cầu
  **HTTPS hoặc localhost** mới cho phép camera.
- Nếu camera bị chặn, có ô nhập tay mã QR dự phòng.
