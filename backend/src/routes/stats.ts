import { Router } from 'express';
import { StatsController } from '../controllers/StatsController';
import { auth } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new StatsController();

router.get('/dashboard', auth, checkRole('librarian', 'admin'), asyncHandler(controller.dashboard));
router.get('/export/excel', auth, checkRole('librarian', 'admin'), asyncHandler(controller.exportExcel));

export default router;
