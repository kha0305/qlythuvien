-- Migration: hệ thống thông báo (chạy 1 lần trong phpMyAdmin, DB library_mini).
-- Cập nhật ngày: 16/10/2026.
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

-- Cờ báo quá hạn (chống gửi trùng): 1 = đã gửi thông báo quá hạn cho độc giả.
ALTER TABLE loans
  ADD COLUMN overdue_notified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = đã gửi thông báo quá hạn';
