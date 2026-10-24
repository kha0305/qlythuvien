import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';
import { auth } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new CategoryController();

// Đọc: đăng nhập là được (form sách dùng dropdown thể loại).
router.get('/', auth, asyncHandler(controller.list));
// Route cụ thể đặt trước route :id.
router.get('/suggest-code', auth, checkRole('librarian', 'admin'), asyncHandler(controller.suggestCode));

// Ghi: thủ thư + admin.
router.post('/', auth, checkRole('librarian', 'admin'), asyncHandler(controller.create));
router.put('/:id', auth, checkRole('librarian', 'admin'), asyncHandler(controller.update));
router.delete('/:id', auth, checkRole('librarian', 'admin'), asyncHandler(controller.remove));

export default router;
