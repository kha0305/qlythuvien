import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

interface EmptyStateProps {
  /** Tên icon SVG trong bộ icons.tsx. */
  icon: IconName;
  /** Tiêu đề ngắn. */
  title: string;
  /** Câu hướng dẫn thêm (optional). */
  hint?: string;
  /** Nút hành động (optional), ví dụ nút "Thêm sách". */
  action?: ReactNode;
}

/**
 * Trạng thái rỗng: minh họa SVG + lời nhắn thân thiện,
 * thay cho một dòng chữ "Không có..." đơn điệu.
 */
export function EmptyState({ icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        <Icon name={icon} size={30} />
      </span>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
