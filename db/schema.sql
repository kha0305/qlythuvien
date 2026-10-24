-- ============================================================================
-- SCHEMA CSDL MySQL 8 — Web Quản Lý Thư Viện Mini (Đồ án CDIO 4)
-- Đặc tả bản chốt: workspace/cdio4-thu-vien/dac-ta-chuc-nang.md (D1-D13)
-- Cách dùng: mysql -u root -p < schema.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS library_mini
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE library_mini;

-- ----------------------------------------------------------------------------
-- users: admin / librarian / reader (D1, D8, D9)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt hash (D8)',
  full_name     VARCHAR(100) NOT NULL,
  role          ENUM('admin','librarian','reader') NOT NULL,
  student_code  VARCHAR(20) NULL COMMENT 'chỉ dùng cho reader',
  phone         VARCHAR(20) NULL,
  active        TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=hoạt động, 0=bị khóa',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- books: mỗi cuốn sách vật lý có 1 qr_code duy nhất (D2)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- loans: phiếu mượn. status chỉ borrowing/returned (D5).
-- "Quá hạn" tính động: status='borrowing' AND due_at < NOW() (D5, D6)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- reservations: đặt trước sách (D11, D12, D13).
-- Hết hạn tính động: status='pending' AND expires_at < NOW() (D11)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- categories: thể loại sách (quản lý riêng, form sách dùng dropdown)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE COMMENT 'ký hiệu thể loại, vd VH, dùng để sinh mã sách'
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- notifications: hệ thống thông báo (tự động + thủ công)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- settings: tham số nghiệp vụ, admin sửa được (D3, D10)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id                 INT PRIMARY KEY COMMENT 'luôn = 1, chỉ 1 dòng cấu hình',
  loan_days          INT NOT NULL DEFAULT 14 COMMENT 'số ngày được mượn (D3)',
  fine_per_day       INT NOT NULL DEFAULT 5000 COMMENT 'phạt mỗi ngày trễ, đồng (D3)',
  max_books_per_reader INT NOT NULL DEFAULT 5 COMMENT 'số cuốn tối đa cùng lúc (D3)',
  reservation_hours  INT NOT NULL DEFAULT 48 COMMENT 'số giờ giữ sách khi đặt trước (D11)'
) ENGINE=InnoDB;

INSERT INTO settings (id, loan_days, fine_per_day, max_books_per_reader, reservation_hours)
VALUES (1, 14, 5000, 5, 48)
ON DUPLICATE KEY UPDATE id = id;
