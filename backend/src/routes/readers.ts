import { Router } from 'express';
import { ReaderController } from '../controllers/ReaderController';
import { auth } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new ReaderController();

router.use(auth, checkRole('librarian'));

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.put('/:id', asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));

export default router;
