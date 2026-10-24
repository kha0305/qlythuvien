-- Migration: bảng thể loại riêng (chạy 1 lần trong phpMyAdmin, DB library_mini).
-- Cập nhật ngày: 16/10/2026 (thêm cột code).
CREATE TABLE IF NOT EXISTS categories (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE COMMENT 'ký hiệu thể loại, vd VH, dùng để sinh mã sách'
) ENGINE=InnoDB;

-- Seed 12 thể loại chuẩn kèm mã.
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

-- Các thể loại tự do còn lại trong books (vd Toán học, Lập trình): tự sinh mã TL001, TL002...
-- (tên đã tồn tại thì INSERT IGNORE bỏ qua).
INSERT IGNORE INTO categories (name, code)
SELECT name, CONCAT('TL', LPAD(@rn := @rn + 1, 3, '0'))
FROM (SELECT DISTINCT category AS name FROM books WHERE category IS NOT NULL AND category <> '') t,
     (SELECT @rn := 0) r;
