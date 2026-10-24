import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { auth } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new NotificationController();

// Mọi role đã đăng nhập: xem / đếm chưa đọc / đánh dấu đã đọc.
router.get('/', auth, asyncHandler(controller.list));
// Route cụ thể đặt trước route :id.
router.get('/unread-count', auth, asyncHandler(controller.unreadCount));
router.post('/read-all', auth, asyncHandler(controller.markAllRead));
router.post('/:id/read', auth, asyncHandler(controller.markRead));

// Tạo thông báo: chỉ admin + thủ thư.
router.post('/', auth, checkRole('admin', 'librarian'), asyncHandler(controller.create));

export default router;
