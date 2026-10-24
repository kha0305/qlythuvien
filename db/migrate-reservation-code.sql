-- Migration: thêm mã QR cho đặt trước (chạy 1 lần trong phpMyAdmin, DB library_mini).
-- Cập nhật ngày: 16/10/2026.
ALTER TABLE reservations
  ADD COLUMN code VARCHAR(16) NULL UNIQUE COMMENT 'mã QR đặt trước, 8 ký tự A-Z0-9, sinh khi tạo';
