import { Settings } from '../entities/Settings';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { AppError } from '../utils/errors';

export interface UpdateSettingsInput {
  loanDays?: number;
  finePerDay?: number;
  maxBooksPerReader?: number;
  reservationHours?: number;
}

// UC09 + D10: tham số mới chỉ áp dụng cho phiếu tạo sau thời điểm sửa.
export class SettingsService {
  constructor(private readonly settingsRepo = new SettingsRepository()) {}

  async getSettings(): Promise<Settings> {
    return this.settingsRepo.get();
  }

  async updateSettings(input: UpdateSettingsInput): Promise<Settings> {
    const fields: UpdateSettingsInput = {};
    const entries: [keyof UpdateSettingsInput, string][] = [
      ['loanDays', 'Số ngày được mượn'],
      ['finePerDay', 'Mức phạt mỗi ngày'],
      ['maxBooksPerReader', 'Số cuốn tối đa mỗi độc giả'],
      ['reservationHours', 'Số giờ giữ sách khi đặt trước'],
    ];
    for (const [key, label] of entries) {
      const value = input[key];
      if (value === undefined) continue;
      if (!Number.isInteger(value) || value <= 0) {
        throw new AppError(400, `${label}: Giá trị phải là số nguyên dương`);
      }
      (fields as Record<string, number>)[key] = value;
    }
    await this.settingsRepo.update(fields);
    return this.settingsRepo.get();
  }
}
