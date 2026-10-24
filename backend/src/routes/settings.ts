import { Router } from 'express';
import { SettingsController } from '../controllers/SettingsController';
import { auth } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new SettingsController();

router.use(auth, checkRole('admin'));

router.get('/', asyncHandler(controller.get));
router.put('/', asyncHandler(controller.update));

export default router;
