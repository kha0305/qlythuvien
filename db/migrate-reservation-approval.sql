-- ============================================================================
-- Migration 16/10/2026: luồng DUYỆT ĐẶT TRƯỚC (thay đổi theo yêu cầu của kha)
-- Chạy file này trong phpMyAdmin (tab SQL) cho database library_mini HIỆN CÓ.
-- DB tạo mới từ schema.sql thì đã có sẵn các cột này, không cần chạy.
-- ============================================================================

ALTER TABLE reservations
  ADD COLUMN reader_note  VARCHAR(255) NULL COMMENT 'ghi chú giờ mong muốn đến lấy của độc giả' AFTER reader_id,
  ADD COLUMN pickup_at    DATETIME NULL COMMENT 'lịch hẹn đến lấy do thủ thư chốt khi duyệt' AFTER expires_at,
  ADD COLUMN reviewed_by  INT NULL COMMENT 'id thủ thư duyệt/từ chối' AFTER pickup_at,
  ADD COLUMN reviewed_at  DATETIME NULL AFTER reviewed_by,
  ADD COLUMN reject_reason VARCHAR(255) NULL COMMENT 'lý do từ chối (optional)' AFTER reviewed_at,
  MODIFY COLUMN status ENUM('pending','approved','rejected','fulfilled','cancelled','expired')
    NOT NULL DEFAULT 'pending' COMMENT 'pending=chờ duyệt, approved=đã duyệt, rejected=không duyệt';

ALTER TABLE reservations
  ADD CONSTRAINT fk_res_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id);
