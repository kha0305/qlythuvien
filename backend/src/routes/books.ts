import { Router } from 'express';
import { BookController } from '../controllers/BookController';
import { auth } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { uploadCover } from '../middleware/upload';
import { uploadExcel } from '../middleware/uploadExcel';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = new BookController();

// Đọc sách: đăng nhập là được (reader dùng để tra cứu / đặt trước, UC11).
router.get('/', auth, asyncHandler(controller.list));
// Route cụ thể phải đặt trước route :id.
router.get('/qr/:qrCode', auth, checkRole('librarian'), asyncHandler(controller.getByQr));
router.get('/publishers', auth, checkRole('librarian'), asyncHandler(controller.publishers));
// Tra cứu sách (Big Book -> iTunes fallback): route cụ thể phải đặt trước route :id
// (nếu không "lookup" bị hiểu là id sách). Giữ alias /lookup-itunes cho frontend cũ.
router.get('/lookup', auth, checkRole('librarian', 'admin'), asyncHandler(controller.lookupBooks));
router.get('/lookup-itunes', auth, checkRole('librarian', 'admin'), asyncHandler(controller.lookupBooks));
router.get('/import/template', auth, checkRole('librarian'), asyncHandler(controller.importTemplate));
router.get('/:id', auth, asyncHandler(controller.getById));

// Ghi sách: chỉ thủ thư.
router.post('/', auth, checkRole('librarian'), asyncHandler(controller.create));
router.put('/:id', auth, checkRole('librarian'), asyncHandler(controller.update));
router.delete('/:id', auth, checkRole('librarian'), asyncHandler(controller.remove));
// Nhập Excel + đồng bộ mã: thủ thư.
router.post('/import', auth, checkRole('librarian'), uploadExcel, asyncHandler(controller.importExcel));
router.post('/sync-codes', auth, checkRole('librarian'), asyncHandler(controller.syncCodes));
// Upload ảnh bìa: thủ thư + admin.
router.post('/:id/cover', auth, checkRole('librarian', 'admin'), uploadCover, asyncHandler(controller.uploadCover));
// Lấy bìa tự động (Google Books -> Open Library): thủ thư + admin, cùng quyền với upload bìa.
// Không xung đột route: fetch-covers-missing là 1 đoạn, :id/fetch-cover khác đoạn 2 với :id/cover.
router.post('/fetch-covers-missing', auth, checkRole('librarian', 'admin'), asyncHandler(controller.fetchCoversMissing));
router.post('/:id/fetch-cover', auth, checkRole('librarian', 'admin'), asyncHandler(controller.fetchCover));

export default router;
