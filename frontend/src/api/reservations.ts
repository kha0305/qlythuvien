import { api } from './client';
import { normalizeReservation, unwrapData, type Reservation } from './types';

/** UC11: độc giả đặt trước sách (kèm ghi chú giờ mong muốn, optional). */
export async function reserveBook(bookId: number, readerNote?: string): Promise<Reservation> {
  const { data } = await api.post('/reservations', { bookId, readerNote });
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeReservation(body.reservation ?? body);
}

/** UC08/UC12: các lượt đặt trước của chính độc giả đang đăng nhập (mọi trạng thái). */
export async function myReservations(): Promise<Reservation[]> {
  const { data } = await api.get('/reservations/my');
  const arr = Array.isArray(data) ? data : (data?.data ?? []);
  return (Array.isArray(arr) ? arr : []).map(normalizeReservation);
}

/** UC12: hủy lượt đặt trước của mình (chỉ khi còn pending). */
export async function cancelReservation(id: number): Promise<void> {
  await api.delete(`/reservations/${id}`);
}

/** Thủ thư: danh sách lượt đặt đang chờ duyệt. */
export async function listPendingReservations(sort?: string): Promise<Reservation[]> {
  const { data } = await api.get('/reservations/pending', { params: sort ? { sort } : {} });
  const arr = Array.isArray(data) ? data : (data?.data ?? []);
  return (Array.isArray(arr) ? arr : []).map(normalizeReservation);
}

/** Thủ thư: duyệt + chốt lịch hẹn (ISO datetime). */
export async function approveReservation(id: number, pickupAt: string): Promise<Reservation> {
  const { data } = await api.post(`/reservations/${id}/approve`, { pickupAt });
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeReservation(body.reservation ?? body);
}

/** Thủ thư: không duyệt (+ lý do optional). */
export async function rejectReservation(id: number, reason?: string): Promise<Reservation> {
  const { data } = await api.post(`/reservations/${id}/reject`, { reason });
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeReservation(body.reservation ?? body);
}

/** Thủ thư: tra cứu lượt đặt còn hiệu lực theo mã QR (để quét ở quầy mượn). */
export async function getReservationByCode(code: string): Promise<Reservation> {
  const { data } = await api.get(`/reservations/code/${encodeURIComponent(code.trim())}`);
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeReservation(body);
}
