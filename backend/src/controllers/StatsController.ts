import { Request, Response } from 'express';
import { StatsService } from '../services/StatsService';
import { toBookDto } from '../utils/dto';

export class StatsController {
  constructor(private readonly statsService = new StatsService()) {}

  // GET /api/stats/dashboard
  dashboard = async (_req: Request, res: Response): Promise<void> => {
    const stats = await this.statsService.getDashboard();
    res.json({
      data: {
        totalBooks: stats.totalBooks,
        borrowing: stats.borrowing,
        overdue: stats.overdue,
        totalReaders: stats.totalReaders,
        topBooks: stats.topBooks.map(({ book, borrowCount }) => ({ ...toBookDto(book), borrowCount })),
      },
    });
  };

  // GET /api/stats/export/excel?status=&readerId=&from=&to= — tải báo cáo Excel.
  exportExcel = async (req: Request, res: Response): Promise<void> => {
    const readerId = Number(req.query.readerId);
    const buffer = await this.statsService.exportExcel({
      status: req.query.status as string | undefined,
      readerId: Number.isInteger(readerId) && readerId > 0 ? readerId : undefined,
      from: (req.query.from as string | undefined) || undefined,
      to: (req.query.to as string | undefined) || undefined,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-thu-vien-${stamp}.xlsx"`);
    res.send(buffer);
  };
}
