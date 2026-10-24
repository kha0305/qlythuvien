interface SkeletonProps {
  /** Kiểu khung xương: line | card | table | stat | book */
  variant?: 'line' | 'card' | 'table' | 'stat' | 'book';
  /** Số khối lặp lại (cho table/book). */
  count?: number;
  className?: string;
}

/**
 * Khung xương shimmer (CSS only) hiện trong lúc tải dữ liệu,
 * thay cho dòng chữ "Đang tải..." khô khan.
 */
export function Skeleton({ variant = 'line', count, className = '' }: SkeletonProps) {
  if (variant === 'table') {
    const rows = count ?? 5;
    return (
      <div className={`skeleton-table ${className}`} aria-hidden="true">
        <div className="skeleton skeleton-table-head" />
        {Array.from({ length: rows }).map((_, i) => (
          <div className="skeleton skeleton-table-row" key={i} />
        ))}
      </div>
    );
  }
  if (variant === 'stat') {
    return (
      <div className={`skeleton-stat-grid ${className}`} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skeleton skeleton-stat" key={i} />
        ))}
      </div>
    );
  }
  if (variant === 'book') {
    const n = count ?? 8;
    return (
      <div className={`skeleton-book-grid ${className}`} aria-hidden="true">
        {Array.from({ length: n }).map((_, i) => (
          <div className="skeleton skeleton-book" key={i} />
        ))}
      </div>
    );
  }
  if (variant === 'card') {
    return (
      <div className={`skeleton-card ${className}`} aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: '45%' }} />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" style={{ width: '70%' }} />
      </div>
    );
  }
  return <div className={`skeleton skeleton-line ${className}`} aria-hidden="true" />;
}
