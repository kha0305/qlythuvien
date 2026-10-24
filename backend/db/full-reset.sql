-- ============================================================================
-- CDIO 4 - Web Quản Lý Thư Viện Mini: FILE RESET FULL (1 file duy nhất)
-- Chạy 1 lần trong phpMyAdmin (tab SQL) hoặc: mysql -u root -p < cdio4-full-reset.sql
-- File này: XÓA SẠCH 8 bảng cũ -> tạo mới -> nạp sẵn data mẫu.
-- CẢNH BÁO: mọi dữ liệu cũ trong DB library_mini sẽ MẤT HOÀN TOÀN.
-- MySQL: chạy port 3307 (XAMPP của kha).
-- ============================================================================


-- Xóa sạch bảng cũ (tắt kiểm tra khóa ngoại để drop không bị vướng FK)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS notification_reads;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- Tạo mới 8 bảng
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt hash (D8)',
  full_name     VARCHAR(100) NOT NULL,
  role          ENUM('admin','librarian','reader') NOT NULL,
  student_code  VARCHAR(20) NULL COMMENT 'chỉ dùng cho reader',
  phone         VARCHAR(20) NULL,
  email         VARCHAR(150) NULL COMMENT 'UC17-UC19: nhắc hạn / quên MK / xác thực; tài khoản cũ có thể NULL',
  email_verified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = email đã xác thực qua link (UC19)',
  avatar_url VARCHAR(255) NULL COMMENT 'Đường dẫn ảnh đại diện (/uploads/avatars/...)',
  active        TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=hoạt động, 0=bị khóa',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS books (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  qr_code      VARCHAR(50) NOT NULL UNIQUE COMMENT 'UUID hex 32 ký tự, sinh 1 lần không đổi (D2)',
  title        VARCHAR(255) NOT NULL,
  author       VARCHAR(100) NULL,
  category     VARCHAR(100) NULL,
  publisher    VARCHAR(100) NULL,
  publish_year INT NULL,
  cover_url    VARCHAR(500) NULL COMMENT 'Đường dẫn ảnh bìa, vd /uploads/covers/12-1699999999999.jpg',
  book_code    VARCHAR(20) NULL UNIQUE COMMENT 'mã hiển thị, vd VH-0001, sinh 1 lần không đổi',
  status       ENUM('available','borrowed') NOT NULL DEFAULT 'available',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_books_title (title),
  INDEX idx_books_qr (qr_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loans (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  book_id     INT NOT NULL,
  reader_id   INT NOT NULL,
  borrowed_at DATETIME NOT NULL,
  due_at      DATETIME NOT NULL COMMENT 'borrowed_at + loan_days (D4)',
  returned_at DATETIME NULL COMMENT 'NULL = chưa trả',
  fine_amount INT NOT NULL DEFAULT 0 COMMENT 'tiền phạt (đồng), chốt lúc trả (D7)',
  status      ENUM('borrowing','returned') NOT NULL DEFAULT 'borrowing',
  overdue_notified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = đã gửi thông báo quá hạn',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_book   FOREIGN KEY (book_id)   REFERENCES books(id),
  CONSTRAINT fk_loans_reader FOREIGN KEY (reader_id) REFERENCES users(id),
  INDEX idx_loans_status (status),
  INDEX idx_loans_reader (reader_id),
  INDEX idx_loans_due (due_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  book_id     INT NOT NULL,
  reader_id   INT NOT NULL,
  reader_note VARCHAR(255) NULL COMMENT 'ghi chú giờ mong muốn đến lấy của độc giả',
  reserved_at DATETIME NOT NULL,
  expires_at  DATETIME NOT NULL COMMENT 'hạn duyệt: reserved_at + reservation_hours (D11)',
  pickup_at   DATETIME NULL COMMENT 'lịch hẹn đến lấy do thủ thư chốt khi duyệt',
  reviewed_by INT NULL COMMENT 'id thủ thư duyệt/từ chối',
  reviewed_at DATETIME NULL,
  reject_reason VARCHAR(255) NULL COMMENT 'lý do từ chối (optional)',
  code        VARCHAR(16) NULL UNIQUE COMMENT 'mã QR đặt trước, 8 ký tự A-Z0-9, sinh khi tạo',
  status      ENUM('pending','approved','rejected','fulfilled','cancelled','expired') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_book     FOREIGN KEY (book_id)     REFERENCES books(id),
  CONSTRAINT fk_res_reader   FOREIGN KEY (reader_id)   REFERENCES users(id),
  CONSTRAINT fk_res_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id),
  INDEX idx_res_status (status),
  INDEX idx_res_book (book_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE COMMENT 'ký hiệu thể loại, vd VH, dùng để sinh mã sách'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  audience       ENUM('all','readers','librarians') NOT NULL DEFAULT 'all' COMMENT 'đối tượng nhận',
  type           ENUM('reservation','loan','overdue','general','system') NOT NULL COMMENT 'loại thông báo (quyết định màu sắc)',
  title          VARCHAR(255) NOT NULL,
  body           TEXT NULL,
  show_on_landing TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = hiện dạng thẻ nổi ở landing page',
  user_id         INT NULL COMMENT 'thông báo riêng cho 1 user (NULL = gửi theo audience)',
  created_by     INT NULL COMMENT 'id admin/thủ thư tạo (NULL = hệ thống tự động)',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_audience (audience),
  INDEX idx_notif_type (type),
  INDEX idx_notif_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INT NOT NULL,
  user_id         INT NOT NULL,
  read_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  CONSTRAINT fk_read_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_read_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
  id                 INT PRIMARY KEY COMMENT 'luôn = 1, chỉ 1 dòng cấu hình',
  loan_days          INT NOT NULL DEFAULT 14 COMMENT 'số ngày được mượn (D3)',
  fine_per_day       INT NOT NULL DEFAULT 5000 COMMENT 'phạt mỗi ngày trễ, đồng (D3)',
  max_books_per_reader INT NOT NULL DEFAULT 5 COMMENT 'số cuốn tối đa cùng lúc (D3)',
  reservation_hours  INT NOT NULL DEFAULT 48 COMMENT 'số giờ giữ sách khi đặt trước (D11)'
) ENGINE=InnoDB;

-- email_tokens: token dùng 1 lần cho xác thực email (UC19) + đặt lại mật khẩu (UC18)
CREATE TABLE IF NOT EXISTS email_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  purpose     ENUM('verify_email','reset_password') NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL COMMENT 'NULL = chưa dùng',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_etokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_etokens_user_purpose (user_id, purpose),
  INDEX idx_etokens_hash (token_hash)
) ENGINE=InnoDB;

-- email_reminders: nhật ký email nhắc hạn đã gửi (UC17) — chống gửi trùng
CREATE TABLE IF NOT EXISTS email_reminders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  loan_id         INT NOT NULL,
  type            ENUM('due_soon','overdue') NOT NULL,
  recipient_email VARCHAR(150) NOT NULL,
  provider_id     VARCHAR(100) NULL COMMENT 'id email phía Resend',
  sent_day        DATE NOT NULL,
  sent_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ereminders_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  UNIQUE KEY uq_ereminder (loan_id, type, sent_day),
  INDEX idx_ereminder_loan (loan_id, type)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- DỮ LIỆU MẪU
-- ----------------------------------------------------------------------------
INSERT INTO settings (id, loan_days, fine_per_day, max_books_per_reader, reservation_hours)
VALUES (1, 14, 5000, 5, 48);

-- 3 tài khoản demo (mật khẩu đã băm bcrypt, đăng nhập bình thường)
--   admin / admin123 (admin)
INSERT INTO users (username, password_hash, full_name, role, active)
VALUES ('admin', '$2b$10$whB6zgKEaIZiX5xjD23Tr.Sv8KhedPd2WJIAdIEgmeOPXjNgPQY.W', 'Quản trị viên', 'admin', 1);
--   thuthu / lib123 (librarian)
INSERT INTO users (username, password_hash, full_name, role, active)
VALUES ('thuthu', '$2b$10$H89P8MyfugLl2ITgdnB9TefuUQurCXa7PpvffYQxt8kBI/e/6l34a', 'Thủ thư', 'librarian', 1);
--   docgia / read123 (reader)
INSERT INTO users (username, password_hash, full_name, role, active)
VALUES ('docgia', '$2b$10$ervyj42m2A9E5YSgJEtl9O/S15/8s7bsNEfvckc78WPoq7x5FZ4YG', 'Độc giả mẫu', 'reader', 1);

-- 100 đầu sách mẫu (mỗi cuốn 1 qr_code duy nhất)
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('bd4568023577e15cb1cc6dfcbffe2faa', 'Dế Mèn phiêu lưu ký', 'Tô Hoài', 'Văn học', 'Kim Đồng', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('de637d145a2e839f56a7fdbae6e82b13', 'Truyện Kiều', 'Nguyễn Du', 'Văn học', 'Văn học', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('27420b3c11cbb31ef83c7da4a92cd42f', 'Số đỏ', 'Vũ Trọng Phụng', 'Văn học', 'Văn học', 2018, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('65c04c06932820079e91abead529004c', 'Tắt đèn', 'Ngô Tất Tố', 'Văn học', 'Văn học', 2017, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('c29fd153d95386433c2d71332d6c1452', 'Chí Phèo', 'Nam Cao', 'Văn học', 'Văn học', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('7729d3adb6be161965a5e83451e75171', 'Lão Hạc', 'Nam Cao', 'Văn học', 'Kim Đồng', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('71db39c224a6666dbca67e91a1d27e08', 'Vợ nhặt', 'Kim Lân', 'Văn học', 'Hội Nhà văn', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('5d6281b611095c706e43e2de362dec8d', 'Làng', 'Kim Lân', 'Văn học', 'Hội Nhà văn', 2018, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('a27204fb5a085cb58e01ed2f306599a8', 'Vợ chồng A Phủ', 'Tô Hoài', 'Văn học', 'Kim Đồng', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('79ef6535e5e454527e7d4af4a224714f', 'Chiếc thuyền ngoài xa', 'Nguyễn Minh Châu', 'Văn học', 'Văn học', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('db9a7d49ccdca6e53636ad2d9baf7f86', 'Bến quê', 'Nguyễn Minh Châu', 'Văn học', 'Văn học', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('217e4b16a2f9c15305e804de22a06902', 'Rừng xà nu', 'Nguyễn Trung Thành', 'Văn học', 'Quân đội Nhân dân', 2018, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('c52aa33008757de6739e6247c13405c4', 'Đất rừng phương Nam', 'Đoàn Giỏi', 'Văn học', 'Kim Đồng', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('81731fb4eaeab854fc67352b9c4033a9', 'Tuổi thơ dữ dội', 'Phùng Quán', 'Văn học', 'Kim Đồng', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('0d0df870a71db829ec7181af03b9c75b', 'Nỗi buồn chiến tranh', 'Bảo Ninh', 'Văn học', 'Trẻ', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('a464adcf12bebadd0cb48ebea76d4011', 'Nhật ký Đặng Thùy Trâm', 'Đặng Thùy Trâm', 'Văn học', 'Hội Nhà văn', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('2bb219da65e18c8569c170c2d48527e4', 'Cho tôi xin một vé đi tuổi thơ', 'Nguyễn Nhật Ánh', 'Văn học', 'Trẻ', 2023, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('3045846cf835f129d1cac2e1783b095e', 'Tôi thấy hoa vàng trên cỏ xanh', 'Nguyễn Nhật Ánh', 'Văn học', 'Trẻ', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('4af06ec977e0fccea2cb7ca0ffd345bd', 'Mắt biếc', 'Nguyễn Nhật Ánh', 'Văn học', 'Trẻ', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('f609abc20e74867c397fdf7d40d2d312', 'Kính vạn hoa - Tập 1', 'Nguyễn Nhật Ánh', 'Văn học', 'Kim Đồng', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('119ee00e02f5c8c3a6e6ece356f84a54', 'Hoàng tử bé', 'Antoine de Saint-Exupéry', 'Văn học', 'Kim Đồng', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('acea3cea3580d1b98d04a87d3670d341', 'Nhà giả kim', 'Paulo Coelho', 'Văn học', 'Hội Nhà văn', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('f2fd28a09ba693fe31974c823c610942', 'Ông già và biển cả', 'Ernest Hemingway', 'Văn học', 'Văn học', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('0c1cbf899e5af512902f83c6251656a2', 'Giết con chim nhại', 'Harper Lee', 'Văn học', 'Nhã Nam', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('34b72dba9d92c65e2452cc4dd2205294', '1984', 'George Orwell', 'Văn học', 'Nhã Nam', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('cfc73ab1d036b33330f7a64f380aa3bb', 'Trại súc vật', 'George Orwell', 'Văn học', 'Nhã Nam', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('cc01b2c5f1552ffc2230359856cbdd89', 'Trăm năm cô đơn', 'Gabriel García Márquez', 'Văn học', 'Văn học', 2018, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('5e9af41bea2f7244c7af0a1f3ee24ec2', 'Kiêu hãnh và định kiến', 'Jane Austen', 'Văn học', 'Nhã Nam', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('fc40f0a6c984de7b61802ac37737f72f', 'Đồi gió hú', 'Emily Brontë', 'Văn học', 'Nhã Nam', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('5d7d2de5c2c4cc40e7aaea50575e7d59', 'Những người khốn khổ', 'Victor Hugo', 'Văn học', 'Văn học', 2017, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('88517314fa164bc3ad3927cd9d48d213', 'Nhà thờ Đức Bà Paris', 'Victor Hugo', 'Văn học', 'Văn học', 2018, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('0708a775314cdc870d21f3df61dd9a62', 'Bá tước Monte Cristo', 'Alexandre Dumas', 'Văn học', 'Văn học', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('0972d47e17012b2ee285f59ab96c0ef3', 'Tội ác và trừng phạt', 'Fyodor Dostoevsky', 'Văn học', 'Văn học', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('f7374597842db0ee313a98fc8a032ba5', 'Chiến tranh và hòa bình', 'Leo Tolstoy', 'Văn học', 'Văn học', 2018, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('0986d0d78bb0ad64473a4e0e6ee1bc55', 'Harry Potter và Hòn đá Phù thủy', 'J.K. Rowling', 'Văn học', 'Trẻ', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('bc6edb5304d365166e544c165eaa4679', 'Harry Potter và Phòng chứa Bí mật', 'J.K. Rowling', 'Văn học', 'Trẻ', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('78c92d4a2ab571a0e656a3cf70b43b73', 'Người Hobbit', 'J.R.R. Tolkien', 'Văn học', 'Nhã Nam', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('d9ad82172ffd5fc92a480f737aea6d60', 'Chúa tể những chiếc nhẫn', 'J.R.R. Tolkien', 'Văn học', 'Nhã Nam', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('b427efc83b9e12a3873842fc4d04cb8e', 'Người đua diều', 'Khaled Hosseini', 'Văn học', 'Nhã Nam', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('4d71090898625e6fb3359c8cf698faee', 'Totto-chan bên cửa sổ', 'Tetsuko Kuroyanagi', 'Văn học', 'Nhã Nam', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('c290c30e7e20539a6c147979a3a895ba', 'Đắc nhân tâm', 'Dale Carnegie', 'Kỹ năng sống', 'Trẻ', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('a4fbbd989a5b287a51941e460020f4f6', 'Tuổi trẻ đáng giá bao nhiêu', 'Rosie Nguyễn', 'Kỹ năng sống', 'Nhã Nam', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('bed3d3f59eab424cc6a3e61d2db3e3a0', 'Trên đường băng', 'Tony Buổi Sáng', 'Kỹ năng sống', 'Trẻ', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('f79c3c6ee0bf425851506d45d8fd881e', 'Cà phê cùng Tony', 'Tony Buổi Sáng', 'Kỹ năng sống', 'Trẻ', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('cb6b09fbce13c2d098e2d53e62922a35', 'Nhà lãnh đạo không chức danh', 'Robin Sharma', 'Kỹ năng sống', 'Trẻ', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('84d6240f3a4beec6e9db2c49e6c9bce2', '7 thói quen hiệu quả', 'Stephen R. Covey', 'Kỹ năng sống', 'Trẻ', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('c368957ad3d43853f753734bfb091c11', 'Tư duy nhanh và chậm', 'Daniel Kahneman', 'Kỹ năng sống', 'Nhã Nam', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('01ec0899d2268b9a1614b74b4a61936b', 'Đánh thức con người phi thường trong bạn', 'Anthony Robbins', 'Kỹ năng sống', 'Lao động', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('d2a4a50aa7fbd47b662e2b2a990695e1', 'Sức mạnh của thói quen', 'Charles Duhigg', 'Kỹ năng sống', 'Nhã Nam', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('1edabdb757e72f0328092c3e0ee32d64', 'Dám nghĩ lớn', 'David J. Schwartz', 'Kỹ năng sống', 'Trẻ', 2018, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('1673d2a3847bbc206f933f9ebd0af25b', 'Đại số tuyến tính', 'Nguyễn Đình Trí', 'Toán học', 'Giáo dục', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('fc344ce9e7afcc9daaa1318866c455ca', 'Giải tích 1', 'Trần Bình', 'Toán học', 'Giáo dục', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('494e167f0b9b4af1d9e4b39908ac043d', 'Giải tích 2', 'Trần Bình', 'Toán học', 'Giáo dục', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('5ad74990d1876132641a05ec03f1afd1', 'Toán rời rạc', 'Nguyễn Đức Nghĩa', 'Toán học', 'Đại học Quốc gia', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('e70582789d8ccde348facb135b0f7989', 'Xác suất thống kê', 'Đặng Hùng Thắng', 'Toán học', 'Giáo dục', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('b38b6a68a909f3673bcba5c20b42a8a0', 'Hình học giải tích', 'Đoàn Quỳnh', 'Toán học', 'Giáo dục', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('fc8a8f6e7c2a6a3b0abafb3d5f743b42', 'Số học và ứng dụng', 'Hà Huy Khoái', 'Toán học', 'Giáo dục', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('2e6ba47d2fb0dbe5ad4fe0c6b380a47f', 'Phương trình vi phân', 'Nguyễn Thế Hoàn', 'Toán học', 'Đại học Quốc gia', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('16c4814003c5a62971efcc642d019a04', 'Toán cao cấp - Tập 1', 'Nguyễn Đình Trí', 'Toán học', 'Giáo dục', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('b2aa0982a9a09593a732bef0987d4e4b', 'Logic toán', 'Phạm Huy Điển', 'Toán học', 'Đại học Quốc gia', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('f6df21da2f2792bc91655abd1976bcc5', 'Nhập môn lập trình Python', 'Trần Đan Thư', 'Lập trình', 'Khoa học Kỹ thuật', 2023, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('da88d6ea99df0a9b95b85078243b8300', 'Cấu trúc dữ liệu và giải thuật', 'Lê Minh Hoàng', 'Lập trình', 'Đại học Quốc gia', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('ad8078f3354e0eb2a849b07623b5af06', 'Lập trình C++ từ cơ bản đến nâng cao', 'Phạm Văn Ất', 'Lập trình', 'Khoa học Kỹ thuật', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('387b245fee5b4f26f27ab0138b53736d', 'Lập trình Java căn bản', 'Nguyễn Văn Linh', 'Lập trình', 'Giáo dục', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('bc9f8f462f0a632fb01f33babb643dbb', 'Lập trình Web với JavaScript', 'Trần Minh Tuấn', 'Lập trình', 'Khoa học Kỹ thuật', 2023, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('4b027caee47d6e0ca7963e27a890a6f4', 'Clean Code', 'Robert C. Martin', 'Lập trình', 'Dân trí', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('15874aa235e85b71c06d4f9ce26353a0', 'Design Patterns', 'Erich Gamma', 'Lập trình', 'Khoa học Kỹ thuật', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('19f1339caa87c2d7a789b413929da6ce', 'Trí tuệ nhân tạo nhập môn', 'Võ Văn Tới', 'Lập trình', 'Đại học Quốc gia', 2023, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('3dad2f815cc642bf70b3f5ef31aa83dd', 'Học sâu với Python', 'François Chollet', 'Lập trình', 'Khoa học Kỹ thuật', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('779bf423fd46f44323837faa6202cea3', 'Hệ điều hành hiện đại', 'Andrew Tanenbaum', 'Lập trình', 'Giáo dục', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('8d01ec1e311071e1cacb1ef6dc8a2d4b', 'Cơ sở dữ liệu quan hệ', 'Nguyễn Bá Tường', 'Công nghệ thông tin', 'Giáo dục', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('ff2474490bfc2f45a077087ecdc65ed5', 'Mạng máy tính', 'Nguyễn Thúc Hải', 'Công nghệ thông tin', 'Giáo dục', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('9044e350916af8124a0bbf9cabba39ee', 'An toàn thông tin', 'Trần Đức Sự', 'Công nghệ thông tin', 'Khoa học Kỹ thuật', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('cdf65677423c2ed0b8a292e894a0e4f2', 'Phân tích thiết kế hệ thống', 'Nguyễn Văn Ba', 'Công nghệ thông tin', 'Đại học Quốc gia', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('bf2170c95a73072069427de58a2cf368', 'Công nghệ phần mềm', 'Phạm Huy Điển', 'Công nghệ thông tin', 'Giáo dục', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('e54382ad2b74b5e73451d5651a55265c', 'Khai phá dữ liệu', 'Jiawei Han', 'Công nghệ thông tin', 'Khoa học Kỹ thuật', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('11155684208529a38db1bf3520e72297', 'Điện toán đám mây', 'Nguyễn Thanh Tùng', 'Công nghệ thông tin', 'Đại học Quốc gia', 2023, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('82d57e616c197def5a6971adb394d058', 'Quản trị mạng Linux', 'Evi Nemeth', 'Công nghệ thông tin', 'Khoa học Kỹ thuật', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('8ec60d6b6587e3a9cd887f79f9633dc9', 'Lập trình di động Android', 'Phạm Đức Thắng', 'Công nghệ thông tin', 'Giáo dục', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('9e8245a6412654499f1e4ced663c1d33', 'Kiểm thử phần mềm', 'Nguyễn Thị Hương', 'Công nghệ thông tin', 'Đại học Quốc gia', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('43ead70eca00bf9ce3c60980fef805fc', 'Vật lý đại cương - Tập 1', 'Lương Duyên Bình', 'Vật lý', 'Giáo dục', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('b56f2dcb90b5ce0c5ac4863154b8a4ec', 'Vật lý đại cương - Tập 2', 'Lương Duyên Bình', 'Vật lý', 'Giáo dục', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('4fb913ab87038e09d0a59d6ea9e66eab', 'Cơ học lượng tử nhập môn', 'Phạm Quý Tư', 'Vật lý', 'Đại học Quốc gia', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('adaeddaa365a03985cf269931bb29d5e', 'Nhiệt động lực học', 'Nguyễn Văn Hiệu', 'Vật lý', 'Giáo dục', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('76b51029538682c9d91541fc96c2281b', 'Hóa học đại cương', 'Nguyễn Đức Chuy', 'Hóa học', 'Giáo dục', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('585777721a3ec4800217f63c963ddd45', 'Hóa hữu cơ', 'Trần Quốc Sơn', 'Hóa học', 'Đại học Quốc gia', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('d3d5a3180578d8563d317ee0877b700e', 'English Grammar in Use', 'Raymond Murphy', 'Tiếng Anh', 'Giáo dục', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('547b72e84e57110dcb3f8798be2be224', 'TOEIC 900 từ vựng thiết yếu', 'Kim Hiền', 'Tiếng Anh', 'Nhân trí Việt', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('631846b2d0d2fec4587fbdab113167ef', 'Luyện thi IELTS Writing', 'Sam McCarter', 'Tiếng Anh', 'Tổng hợp TP.HCM', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('7bedc34614b5baf50a1ed3da03110b70', '3000 từ vựng tiếng Anh thông dụng', 'Mai Lan Hương', 'Tiếng Anh', 'Đà Nẵng', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('2bf3e6f608d47c0785ae9d3d6ea45c77', 'Phát âm tiếng Anh chuẩn', 'Paul Gruber', 'Tiếng Anh', 'Nhân trí Việt', 2019, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('0d5e73e1e19d5c1b730ef0db2a7fe64a', 'Giao tiếp tiếng Anh thương mại', 'Nguyễn Quốc Hùng', 'Tiếng Anh', 'Lao động', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('ad3cbef6c86c0b7af8ce2b557a52e1d5', 'Đại Việt sử ký toàn thư', 'Ngô Sĩ Liên', 'Lịch sử', 'Khoa học Xã hội', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('dde7dba511dc0dc98ef3443abaf5d230', 'Lịch sử Việt Nam - Tập 1', 'Viện Sử học', 'Lịch sử', 'Khoa học Xã hội', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('032ccc170f0cd46aebdfe9bc155dcb70', 'Triết học Mác-Lênin', 'Bộ Giáo dục và Đào tạo', 'Triết học', 'Chính trị Quốc gia', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('ca53f00c5c9b9605d6bcb6269dd1af55', 'Tư tưởng Hồ Chí Minh', 'Bộ Giáo dục và Đào tạo', 'Triết học', 'Chính trị Quốc gia', 2022, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('f94458e856edfc99c9e50c39f6b5bd94', 'Kinh tế vi mô', 'N. Gregory Mankiw', 'Kinh tế', 'Thống kê', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('f422676e527744adfa891479ebb982af', 'Kinh tế vĩ mô', 'N. Gregory Mankiw', 'Kinh tế', 'Thống kê', 2021, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('45986da9e7ea9e0bea20a8d1e5459498', 'Marketing căn bản', 'Philip Kotler', 'Kinh tế', 'Lao động', 2020, 'available');
INSERT INTO books (qr_code, title, author, category, publisher, publish_year, status)
VALUES ('23f1c95579a8c403b30e5ae2cc750e30', 'Kế toán tài chính', 'Võ Văn Nhị', 'Kinh tế', 'Tài chính', 2022, 'available');

-- ============================================================================
-- DEPLOY THÊM: seed bảng thể loại (giống migrate-categories.sql trên máy local)
-- ============================================================================
INSERT IGNORE INTO categories (name, code) VALUES
('Văn học','VH'),
('Tiểu thuyết','TT'),
('Truyện ngắn','TRN'),
('Thơ ca','THO'),
('Lịch sử','LS'),
('Khoa học','KHO'),
('Công nghệ thông tin','CNTT'),
('Kinh tế','KT'),
('Tâm lý học','TLH'),
('Triết học','TRI'),
('Thiếu nhi','TNH'),
('Ngoại ngữ','NN');

INSERT IGNORE INTO categories (name, code)
SELECT name, CONCAT('TL', LPAD(@rn := @rn + 1, 3, '0'))
FROM (SELECT DISTINCT category AS name FROM books WHERE category IS NOT NULL AND category <> '') t,
     (SELECT @rn := 0) r;
