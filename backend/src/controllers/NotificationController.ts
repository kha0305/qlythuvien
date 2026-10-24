import { Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';

function toDto(n: {
  id: number;
  audience: string;
  type: string;
  title: string;
  body: string | null;
  showOnLanding: boolean;
  createdAt: Date;
  isRead?: boolean;
}) {
  return {
    id: n.id,
    audience: n.audience,
    type: n.type,
    title: n.title,
    body: n.body,
    showOnLanding: n.showOnLanding,
    createdAt: n.createdAt,
    isRead: n.isRead ?? false,
  };
}

export class NotificationController {
  constructor(private readonly notificationService = new NotificationService()) {}

  // GET /api/notifications — thông báo của user hiện tại.
  list = async (req: Request, res: Response): Promise<void> => {
    const items = await this.notificationService.listMine(req.user!.id, req.user!.role);
    res.json({ data: items.map(toDto) });
  };

  // GET /api/notifications/unread-count — số thông báo chưa đọc (cho chuông).
  unreadCount = async (req: Request, res: Response): Promise<void> => {
    const count = await this.notificationService.unreadCount(req.user!.id, req.user!.role);
    res.json({ data: { count } });
  };

  // POST /api/notifications/:id/read — đánh dấu đã đọc 1 thông báo.
  markRead = async (req: Request, res: Response): Promise<void> => {
    await this.notificationService.markRead(req.user!.id, Number(req.params.id));
    res.json({ message: 'Đã đánh dấu đã đọc' });
  };

  // POST /api/notifications/read-all — đánh dấu tất cả đã đọc.
  markAllRead = async (req: Request, res: Response): Promise<void> => {
    await this.notificationService.markAllRead(req.user!.id, req.user!.role);
    res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
  };

  // POST /api/notifications — admin/thủ thư tạo thông báo.
  create = async (req: Request, res: Response): Promise<void> => {
    const notif = await this.notificationService.createManual(req.user!.id, req.body);
    res.status(201).json({ data: toDto(notif), message: 'Đã tạo thông báo' });
  };
}
