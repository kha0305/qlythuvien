/** Định dạng ngày giờ theo chuẩn đặc tả: dd/mm/yyyy hh:mm */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Định dạng tiền Việt Nam: 15000 -> "15.000 đ" */
export function formatVND(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '0 đ';
  return `${new Intl.NumberFormat('vi-VN').format(Number(amount))} đ`;
}

/** Giá trị input type="date" (yyyy-mm-dd) theo giờ địa phương. */
export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
