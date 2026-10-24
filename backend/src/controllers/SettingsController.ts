import { Request, Response } from 'express';
import { SettingsService } from '../services/SettingsService';

export class SettingsController {
  constructor(private readonly settingsService = new SettingsService()) {}

  // GET /api/settings
  get = async (_req: Request, res: Response): Promise<void> => {
    const settings = await this.settingsService.getSettings();
    res.json({
      data: {
        loanDays: settings.loanDays,
        finePerDay: settings.finePerDay,
        maxBooksPerReader: settings.maxBooksPerReader,
        reservationHours: settings.reservationHours,
      },
    });
  };

  // PUT /api/settings
  update = async (req: Request, res: Response): Promise<void> => {
    const settings = await this.settingsService.updateSettings(req.body);
    res.json({
      data: {
        loanDays: settings.loanDays,
        finePerDay: settings.finePerDay,
        maxBooksPerReader: settings.maxBooksPerReader,
        reservationHours: settings.reservationHours,
      },
      message: 'Đã lưu cấu hình, áp dụng cho các phiếu mượn mới',
    });
  };
}
