import { Request, Response } from 'express';
import { ReservationService } from '../services/ReservationService';
import { NotificationService } from '../services/NotificationService';
import { toReservationDto } from '../utils/dto';

export class ReservationController {
  private readonly reservationService: ReservationService;
  private readonly notificationService = new NotificationService();

  constructor() {
    // Callback thông báo tự động (tránh vòng lặp phụ thuộc giữa các service).
    this.reservationService = new ReservationService(
      undefined,
      undefined,
      undefined,
      undefined,
      (bookTitle, readerName) => this.notificationService.notifyNewReservation(bookTitle, readerName),
      (readerId, approved, bookTitle, extra) =>
        this.notificationService.notifyReservationReviewed(readerId, approved, bookTitle, extra),
    );
  }

  // POST /api/reservations {bookId, readerNote?} — độc giả đặt trước -> pending (chờ duyệt).
  create = async (req: Request, res: Response): Promise<void> => {
    const { bookId, readerNote } = req.body as { bookId?: number; readerNote?: string };
    const { reservation, reservationHours } = await this.reservationService.reserveBook(
      Number(bookId),
      req.user!.id,
      readerNote,
    );
    res.status(201).json({
      data: toReservationDto(reservation),
      message: `Đặt trước thành công, đang chờ thủ thư duyệt (trong ${reservationHours} giờ)`,
    });
  };

  // GET /api/reservations/my — tất cả lượt đặt của độc giả.
  my = async (req: Request, res: Response): Promise<void> => {
    const items = await this.reservationService.listMyReservations(req.user!.id);
    res.json({
      data: items.map(({ reservation, remainingMs }) => ({
        ...toReservationDto(reservation),
        remainingMs,
        remainingHours: remainingMs === null ? null : Math.round((remainingMs / 3600000) * 10) / 10,
      })),
    });
  };

  // DELETE /api/reservations/:id — chỉ được hủy khi còn pending và là của chính mình.
  cancel = async (req: Request, res: Response): Promise<void> => {
    await this.reservationService.cancelReservation(Number(req.params.id), req.user!.id);
    res.json({ message: 'Đã hủy đặt trước' });
  };

  // GET /api/reservations/code/:code — thủ thư tra cứu đặt trước còn hiệu lực theo mã QR.
  getByCode = async (req: Request, res: Response): Promise<void> => {
    const reservation = await this.reservationService.findActiveByCode(req.params.code as string);
    res.json({ data: toReservationDto(reservation) });
  };

  // GET /api/reservations/pending — thủ thư: danh sách chờ duyệt.
  pending = async (req: Request, res: Response): Promise<void> => {
    const reservations = await this.reservationService.listPendingForLibrarian(
      req.query.sort as string | undefined,
    );
    res.json({ data: reservations.map(toReservationDto) });
  };

  // POST /api/reservations/:id/approve {pickupAt} — thủ thư duyệt + chốt lịch hẹn.
  approve = async (req: Request, res: Response): Promise<void> => {
    const { pickupAt } = req.body as { pickupAt?: unknown };
    const reservation = await this.reservationService.approveReservation(Number(req.params.id), pickupAt, req.user!.id);
    res.json({ data: toReservationDto(reservation), message: 'Đã duyệt đặt trước' });
  };

  // POST /api/reservations/:id/reject {reason?} — thủ thư không duyệt.
  reject = async (req: Request, res: Response): Promise<void> => {
    const { reason } = req.body as { reason?: string };
    const reservation = await this.reservationService.rejectReservation(Number(req.params.id), req.user!.id, reason);
    res.json({ data: toReservationDto(reservation), message: 'Đã từ chối lượt đặt trước' });
  };
}
