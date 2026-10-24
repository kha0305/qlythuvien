import { Router } from 'express';
import { ReservationController } from '../controllers/ReservationController';
import { auth } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new ReservationController();

// Độc giả: đặt trước / xem của mình / hủy.
router.post('/', auth, checkRole('reader'), asyncHandler(controller.create));
router.get('/my', auth, checkRole('reader'), asyncHandler(controller.my));
router.delete('/:id', auth, checkRole('reader'), asyncHandler(controller.cancel));

// Thủ thư: duyệt đặt trước. Route cụ thể đặt trước route :id.
router.get('/pending', auth, checkRole('librarian'), asyncHandler(controller.pending));
router.get('/code/:code', auth, checkRole('librarian'), asyncHandler(controller.getByCode));
router.post('/:id/approve', auth, checkRole('librarian'), asyncHandler(controller.approve));
router.post('/:id/reject', auth, checkRole('librarian'), asyncHandler(controller.reject));

export default router;
