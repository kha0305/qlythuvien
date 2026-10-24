-- Migration: thêm cột cover_url cho bảng books (upload bìa sách).
-- Chạy 1 LẦN trong phpMyAdmin (tab SQL, DB library_mini). Chạy lặp lại sẽ báo trùng cột.
ALTER TABLE books ADD COLUMN cover_url VARCHAR(500) NULL COMMENT 'Đường dẫn ảnh bìa, vd /uploads/covers/12-1699999999999.jpg' AFTER publish_year;
