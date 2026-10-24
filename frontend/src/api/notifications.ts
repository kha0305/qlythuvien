import { api } from './client';
import { normalizeAnnouncement, normalizeNotification, type Announcement, type NotificationItem } from './types';

function toList<T>(data: unknown, fn: (x: unknown) => T): T[] {
  const arr = Array.isArray(data) ? data : (data as { data?: unknown })?.data ?? [];
  return (Array.isArray(arr) ? arr : []).map(fn);
}

/** Thông báo của user hiện tại (mới nhất trước, kèm isRead). */
export async function listNotifications(): Promise<NotificationItem[]> {
  const { data } = await api.get('/notifications');
  return toList(data, normalizeNotification);
}

/** Số thông báo chưa đọc (cho chuông ở topbar). */
export async function unreadNotificationCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  const body = (data as { data?: { count?: number } })?.data;
  return typeof body?.count === 'number' ? body.count : 0;
}

/** Đánh dấu 1 thông báo là đã đọc. */
export async function markNotificationRead(id: number): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

/** Đánh dấu tất cả đã đọc. */
export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

export interface CreateNotificationInput {
  audience: 'all' | 'readers' | 'librarians';
  type: 'reservation' | 'loan' | 'overdue' | 'general' | 'system';
  title: string;
  body?: string;
  showOnLanding?: boolean;
}

/** Admin/thủ thư tạo thông báo. */
export async function createNotification(input: CreateNotificationInput): Promise<NotificationItem> {
  const { data } = await api.post('/notifications', input);
  const body = (data as { data?: unknown })?.data ?? data;
  return normalizeNotification(body);
}

/** Thông báo chung hiện ở landing page (public). */
export async function listAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get('/public/announcements');
  return toList(data, normalizeAnnouncement);
}
