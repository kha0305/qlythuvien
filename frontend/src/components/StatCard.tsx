import { Icon, type IconName } from './icons';

interface StatCardProps {
  label: string;
  value: number | string;
  tone?: 'default' | 'blue' | 'green' | 'orange' | 'red';
  icon?: IconName;
}

/** Thẻ số liệu dùng cho Dashboard và Thống kê. */
export function StatCard({ label, value, tone = 'default', icon }: StatCardProps) {
  return (
    <div className={`stat-card stat-${tone}`}>
      {icon && (
        <span className="stat-icon" aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
      )}
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
