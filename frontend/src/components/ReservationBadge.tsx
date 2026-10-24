import { Icon, type IconName } from './icons';
import type { ReservationStatus } from '../api/types';

const META: Record<ReservationStatus, { label: string; className: string; icon: IconName }> = {
  pending: { label: 'Chờ duyệt', icon: 'clock', className: 'badge badge-yellow' },
  approved: { label: 'Đã duyệt', icon: 'check', className: 'badge badge-green' },
  rejected: { label: 'Không duyệt', icon: 'x', className: 'badge badge-red' },
  fulfilled: { label: 'Đã lấy sách', icon: 'check', className: 'badge badge-gray' },
  cancelled: { label: 'Đã hủy', icon: 'x', className: 'badge badge-gray' },
  expired: { label: 'Hết hiệu lực', icon: 'clock', className: 'badge badge-gray' },
};

/** Badge trạng thái đặt trước: màu + icon SVG theo spec (vàng/xanh/đỏ/xám). */
export function ReservationBadge({ status }: { status: ReservationStatus }) {
  const meta = META[status] ?? META.pending;
  return (
    <span className={`${meta.className} badge-icon`}>
      <Icon name={meta.icon} size={13} />
      {meta.label}
    </span>
  );
}
