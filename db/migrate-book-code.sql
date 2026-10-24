-- Migration: mã sách hiển thị (chạy 1 lần trong phpMyAdmin, DB library_mini).
-- Cập nhật ngày: 16/10/2026.
ALTER TABLE books
  ADD COLUMN book_code VARCHAR(20) NULL UNIQUE COMMENT 'mã hiển thị, vd VH-0001, sinh 1 lần không đổi';
