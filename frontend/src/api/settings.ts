import { api } from './client';
import { normalizeSettings, unwrapData, type Settings } from './types';

/** UC09: đọc tham số hệ thống. */
export async function getSettings(): Promise<Settings> {
  const { data } = await api.get('/settings');
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeSettings(body.settings ?? body);
}

export interface SettingsInput {
  loanDays: number;
  finePerDay: number;
  maxBooksPerReader: number;
  reservationHours: number;
}

/** UC09: lưu tham số (tất cả phải là số nguyên dương). */
export async function updateSettings(input: SettingsInput): Promise<Settings> {
  const { data } = await api.put('/settings', {
    loan_days: input.loanDays,
    fine_per_day: input.finePerDay,
    max_books_per_reader: input.maxBooksPerReader,
    reservation_hours: input.reservationHours,
    // gửi kèm dạng camelCase phòng backend dùng quy ước khác
    loanDays: input.loanDays,
    finePerDay: input.finePerDay,
    maxBooksPerReader: input.maxBooksPerReader,
    reservationHours: input.reservationHours,
  });
  const body = unwrapData<Record<string, unknown>>(data);
  return normalizeSettings(body.settings ?? body);
}
