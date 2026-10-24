import { Router } from 'express';
import { LoanController } from '../controllers/LoanController';
import { auth } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new LoanController();

// Route cụ thể phải đặt trước (không có route /:id nhưng giữ thứ tự an toàn).
router.get('/overdue', auth, checkRole('librarian'), asyncHandler(controller.overdue));
router.get('/my', auth, checkRole('reader'), asyncHandler(controller.my));
router.get('/return-preview', auth, checkRole('librarian'), asyncHandler(controller.previewReturn));

// Trang Thống kê dùng chung cho thủ thư + admin: admin được xem lịch sử (chỉ đọc).
router.get('/', auth, checkRole('librarian', 'admin'), asyncHandler(controller.list));
router.post('/borrow', auth, checkRole('librarian'), asyncHandler(controller.borrow));
router.post('/return', auth, checkRole('librarian'), asyncHandler(controller.returnBook));

export default router;
