import { Router } from 'express';
import { ProfileController } from '../controllers/ProfileController';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { uploadAvatar } from '../middleware/upload';

const router = Router();
const controller = new ProfileController();

// Trang cá nhân: mọi vai trò đã đăng nhập đều dùng được.
router.get('/', auth, asyncHandler(controller.getProfile));
router.put('/', auth, asyncHandler(controller.updateProfile));
router.put('/password', auth, asyncHandler(controller.changePassword));
router.put('/email', auth, asyncHandler(controller.changeEmail));
router.post('/resend-verification', auth, asyncHandler(controller.resendVerification));
router.post('/avatar', auth, uploadAvatar, asyncHandler(controller.uploadAvatar));
router.delete('/avatar', auth, asyncHandler(controller.deleteAvatar));

export default router;
