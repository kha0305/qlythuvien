import { Router } from 'express';
import { AccountController } from '../controllers/AccountController';
import { auth } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new AccountController();

router.use(auth, checkRole('admin'));

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.put('/:id/active', asyncHandler(controller.setActive));
router.delete('/:id', asyncHandler(controller.remove));

export default router;
