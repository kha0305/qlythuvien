import { Router } from 'express';
import { PublicController } from '../controllers/PublicController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new PublicController();

// API public cho landing page: không gắn middleware auth.
router.get('/books', asyncHandler(controller.listBooks));
router.get('/books/grouped', asyncHandler(controller.listGroupedBooks));
// Route cụ thể phải đặt trước route :id.
router.post('/books/ai-search', asyncHandler(controller.aiSearch));
router.get('/books/:id', asyncHandler(controller.getBookById));
router.get('/categories', asyncHandler(controller.listCategories));
router.get('/stats', asyncHandler(controller.stats));
router.get('/announcements', asyncHandler(controller.announcements));

export default router;
