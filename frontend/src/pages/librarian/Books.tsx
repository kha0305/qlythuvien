import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import QRCode from 'react-qr-code';
import { getErrorMessage, fileUrl } from '../../api/client';
import {
  createBook,
  deleteBook,
  downloadImportTemplate,
  fetchBookCover,
  fetchMissingCovers,
  importBooks,
  listBooks,
  listPublishers,
  searchBooksLookup,
  syncBookCodes,
  updateBook,
  uploadBookCover,
  type BookInput,
  type FetchMissingResult,
  type LookupBookInfo,
} from '../../api/books';
import {
  createCategory,
  listCategories,
} from '../../api/categories';
import type { Category } from '../../api/types';
import type { Book } from '../../api/types';
import { loadRecent, loadRecentNumbers, pushRecent, pushRecentNumber, RECENT_KEYS } from '../../utils/recent';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { CopyButton } from '../../components/CopyButton';
import { Icon } from '../../components/icons';

const PAGE_SIZE = 20;

const emptyForm: BookInput = { title: '', author: '', category: '', publisher: '', publishYear: null };

/** Tải mã QR của sách thành file PNG để in dán lên sách. */
function downloadQrPng(svgId: string, filename: string) {
  const svg = document.getElementById(svgId) as unknown as SVGSVGElement | null;
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.onload = () => {
    const scale = 4;
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    a.click();
    URL.revokeObjectURL(img.src);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
}

/** UC02: quản lý sách (thêm/sửa/xóa/tìm kiếm/xem + tải QR). */
export function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [publishers, setPublishers] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<BookInput>(emptyForm);
  // Nhớ gần đây (localStorage): chỉ cập nhật khi Thêm sách thành công.
  const [recentPublishers, setRecentPublishers] = useState<string[]>(() => loadRecent(RECENT_KEYS.publishers));
  const [recentAuthors, setRecentAuthors] = useState<string[]>(() => loadRecent(RECENT_KEYS.authors));
  const [recentYears, setRecentYears] = useState<number[]>(() => loadRecentNumbers(RECENT_KEYS.years));
  // Dropdown NXB: false = chọn từ danh sách, true = đang gõ NXB mới.
  const [publisherCustom, setPublisherCustom] = useState(false);
  const [customPublisher, setCustomPublisher] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [quickCatOpen, setQuickCatOpen] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickCatError, setQuickCatError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; reason: string }[] } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [fetchingCoverId, setFetchingCoverId] = useState<number | null>(null);
  const [fetchingMissing, setFetchingMissing] = useState(false);
  const [coverReport, setCoverReport] = useState<FetchMissingResult | null>(null);
  const [lookupTerm, setLookupTerm] = useState('');
  const [lookupResults, setLookupResults] = useState<LookupBookInfo[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverObjectUrl = useRef<string | null>(null);

  // Giải phóng object URL khi unmount để không rò rỉ bộ nhớ.
  useEffect(() => () => {
    if (coverObjectUrl.current) URL.revokeObjectURL(coverObjectUrl.current);
  }, []);

  const [qrBook, setQrBook] = useState<Book | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchTimer = useRef<number | undefined>(undefined);

  const load = useCallback(
    async (
      p: number,
      kw: string,
      s: string,
      st: string,
      pub: string,
      yr: string,
    ) => {
      setLoading(true);
      setError('');
      try {
        const yearNum = Number(yr);
        const res = await listBooks({
          keyword: kw || undefined,
          page: p,
          pageSize: PAGE_SIZE,
          sort: s || undefined,
          status: (st === 'available' || st === 'borrowed' || st === 'reserved' ? st : undefined),
          publisher: pub || undefined,
          year: yr && Number.isInteger(yearNum) && yearNum > 0 ? yearNum : undefined,
        });
        setBooks(res.data);
        setTotal(res.total);
      } catch (err) {
        setError(getErrorMessage(err, 'Không tải được danh sách sách.'));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(page, debounced, sort, statusFilter, publisherFilter, yearFilter);
  }, [load, page, debounced, sort, statusFilter, publisherFilter, yearFilter]);

  // Tải danh sách NXB + thể loại cho filter/dropdown (1 lần).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pubs, cats] = await Promise.all([listPublishers(), listCategories()]);
        if (alive) {
          setPublishers(pubs);
          setCategories(cats);
        }
      } catch {
        // không chặn trang nếu tải phụ thất bại
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onSearchChange = (v: string) => {
    setKeyword(v);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setPage(1);
      setDebounced(v.trim());
    }, 400);
  };

  const onSortChange = (v: string) => {
    setPage(1);
    setSort(v);
  };

  const applyFilter = (setter: (v: string) => void) => (v: string) => {
    setPage(1);
    setter(v);
  };

  const resetFilters = () => {
    setPage(1);
    setStatusFilter('');
    setPublisherFilter('');
    setYearFilter('');
  };

  /** Hủy object URL cũ (nếu có) trước khi mở form. */
  const revokeCoverObjectUrl = () => {
    if (coverObjectUrl.current) {
      URL.revokeObjectURL(coverObjectUrl.current);
      coverObjectUrl.current = null;
    }
  };

  /** Reset trạng thái tra cứu iTunes mỗi lần mở form (để không lẫn kết quả lần trước). */
  const resetLookup = () => {
    setLookupTerm('');
    setLookupResults([]);
    setLookupDone(false);
  };

  const openAdd = () => {
    setEditing(null);
    // Thêm sách: tự điền sẵn thể loại + NXB của cuốn vừa thêm gần nhất
    // (thể loại chỉ điền khi vẫn còn trong danh mục). Tiêu đề để trống,
    // tác giả + năm XB chỉ gợi ý để bấm chọn (không tự điền).
    const recentCat = loadRecent(RECENT_KEYS.categories)[0] ?? '';
    const recentPub = loadRecent(RECENT_KEYS.publishers)[0] ?? '';
    setForm({
      ...emptyForm,
      category: categories.some((c) => c.name === recentCat) ? recentCat : '',
      publisher: recentPub,
    });
    setPublisherCustom(false);
    setCustomPublisher('');
    setQuantity(1);
    setFormError('');
    setCoverFile(null);
    revokeCoverObjectUrl();
    setCoverPreview(null);
    resetLookup();
    setFormOpen(true);
  };

  const openEdit = (b: Book) => {
    setEditing(b);
    setForm({
      title: b.title,
      author: b.author ?? '',
      category: b.category ?? '',
      publisher: b.publisher ?? '',
      publishYear: b.publishYear ?? null,
    });
    setFormError('');
    setCoverFile(null);
    // Sửa giữ nguyên giá trị sách đang sửa, không bị recent ghi đè.
    // NXB không có trong danh sách thì mở sẵn ô gõ tay để khỏi mất giá trị.
    if (b.publisher && !publishers.includes(b.publisher)) {
      setPublisherCustom(true);
      setCustomPublisher(b.publisher);
    } else {
      setPublisherCustom(false);
      setCustomPublisher('');
    }
    revokeCoverObjectUrl();
    // Sửa mà không chọn file mới -> giữ ảnh cũ.
    setCoverPreview(fileUrl(b.coverUrl) ?? null);
    resetLookup();
    setFormOpen(true);
  };

  /** Tra cứu sách (Big Book -> iTunes fallback): chỉ lấy danh sách ứng viên, không tự điền. */
  const doLookup = async () => {
    const term = lookupTerm.trim();
    if (!term) {
      setFormError('Nhập từ khóa để tra cứu.');
      return;
    }
    setLookingUp(true);
    setFormError('');
    try {
      const items = await searchBooksLookup(term, 10);
      setLookupResults(items);
      setLookupDone(true);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setLookingUp(false);
    }
  };

  /** Bấm 1 ứng viên -> điền vào form (chỉ tiêu đề, tác giả, năm XB; thể loại/NXB để người dùng chọn tay vì 2 nguồn đều không có NXB khớp danh mục Việt). */
  const applyLookup = (item: LookupBookInfo) => {
    setForm((prev) => ({
      ...prev,
      title: item.title,
      author: item.author || prev.author,
      publishYear: item.publishYear ?? prev.publishYear,
    }));
    setLookupResults([]);
    setLookupDone(false);
  };

  /** Chọn file ảnh bìa: validate loại + dung lượng trước khi preview. */
  const onCoverChange = (f: File | null) => {
    revokeCoverObjectUrl();
    setCoverFile(null);
    if (!f) {
      setCoverPreview(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setFormError('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
      setCoverPreview(null);
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setFormError('Ảnh bìa không được vượt quá 2MB.');
      setCoverPreview(null);
      return;
    }
    setFormError('');
    setCoverFile(f);
    const url = URL.createObjectURL(f);
    coverObjectUrl.current = url;
    setCoverPreview(url);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Tiêu đề không được để trống.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload: BookInput = {
        title: form.title.trim(),
        author: form.author?.trim() || undefined,
        category: form.category?.trim() || undefined,
        publisher: form.publisher?.trim() || undefined,
        publishYear: form.publishYear || null,
      };
      if (editing) {
        await updateBook(editing.id, payload);
        // Có file ảnh mới -> upload sau khi đã có id sách.
        if (coverFile) {
          await uploadBookCover(editing.id, coverFile);
        }
      } else {
        const created = await createBook(payload, quantity);
        // Upload ảnh bìa cho bản đầu tiên; backend tự điền bìa cho các bản
        // cùng tựa chưa có bìa (mỗi bản 1 file riêng).
        if (coverFile && created.length > 0) {
          await uploadBookCover(created[0].id, coverFile);
        }
        // Nhớ gần đây: chỉ cập nhật khi Thêm thành công (Sửa không tính).
        // NXB mới lưu xong tự vào danh sách cho lần sau.
        setRecentPublishers(pushRecent(RECENT_KEYS.publishers, payload.publisher));
        pushRecent(RECENT_KEYS.categories, payload.category);
        setRecentAuthors(pushRecent(RECENT_KEYS.authors, payload.author));
        setRecentYears(pushRecentNumber(RECENT_KEYS.years, payload.publishYear));
        try {
          setPublishers(await listPublishers());
        } catch {
          // danh sách NXB tải lại thất bại thì lần sau vẫn có recent
        }
        if (created.length > 1) {
          setNotice(`Đã thêm ${created.length} bản sách (mỗi bản 1 mã riêng).`);
        }
      }
      setFormOpen(false);
      load(page, debounced, sort, statusFilter, publisherFilter, yearFilter);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /** Thêm nhanh thể loại ngay trong form sách. */
  const quickAddCategory = async () => {
    const n = quickCatName.trim();
    if (!n) {
      setQuickCatError('Nhập tên thể loại.');
      return;
    }
    try {
      const cat = await createCategory(n);
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
      setForm({ ...form, category: cat.name });
      setQuickCatName('');
      setQuickCatError('');
      setQuickCatOpen(false);
    } catch (err) {
      setQuickCatError(getErrorMessage(err));
    }
  };

  /** Nhập Excel. */
  const doImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importBooks(importFile);
      setImportResult(result);
      setImportFile(null);
      load(1, debounced, sort, statusFilter, publisherFilter, yearFilter);
      setPage(1);
    } catch (err) {
      setImportResult({ created: 0, errors: [{ row: 0, reason: getErrorMessage(err) }] });
    } finally {
      setImporting(false);
    }
  };

  /** Lấy bìa tự động cho 1 cuốn (chỉ hiện nút này với sách chưa có bìa). */
  const doFetchCover = async (b: Book) => {
    setFetchingCoverId(b.id);
    setCoverReport(null);
    try {
      const r = await fetchBookCover(b.id);
      setNotice(r.coverFound ? `Đã lấy bìa cho "${b.title}" (${r.source === 'google' ? 'Google Books' : 'Open Library'}).` : `Không tìm thấy ảnh bìa cho "${b.title}" trên Google Books / Open Library.`);
      load(page, debounced, sort, statusFilter, publisherFilter, yearFilter);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setFetchingCoverId(null);
    }
  };

  /** Lấy bìa tự động cho sách chưa có ảnh, 10 tựa/đợt, mỗi tựa điền cho tất cả cuốn cùng tựa (bấm tiếp cho đến khi hết). */
  const doFetchMissing = async () => {
    setFetchingMissing(true);
    setCoverReport(null);
    try {
      const r = await fetchMissingCovers(10);
      setCoverReport(r);
      const okCount = r.results.filter((x) => x.status === 'ok').length;
      setNotice(`Đã xử lý ${r.results.length} cuốn: ${okCount} cuốn lấy được bìa, còn ${r.remaining} cuốn chưa có bìa.`);
      load(page, debounced, sort, statusFilter, publisherFilter, yearFilter);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setFetchingMissing(false);
    }
  };

  /** Đồng bộ mã sách cho sách cũ. */
  const doSyncCodes = async () => {
    setSyncing(true);
    try {
      const count = await syncBookCodes();
      setNotice(`Đã đồng bộ mã cho ${count} cuốn sách.`);
      load(page, debounced, sort, statusFilter, publisherFilter, yearFilter);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBook(deleteTarget.id);
      setDeleteTarget(null);
      load(page, debounced, sort, statusFilter, publisherFilter, yearFilter);
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Quản lý sách</h2>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImportOpen(true)}>
            Nhập Excel
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={doSyncCodes} disabled={syncing}>
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ mã'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={doFetchMissing} disabled={fetchingMissing}>
            {fetchingMissing ? 'Đang lấy bìa...' : 'Lấy bìa tự động'}
          </button>
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <Icon name="plus" size={18} />
            Thêm sách
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {coverReport && (
        <div className="alert alert-warning">
          <p>Kết quả lấy bìa ({coverReport.results.length} cuốn, còn {coverReport.remaining} cuốn chưa có bìa):</p>
          <ul className="import-errors">
            {coverReport.results.map((r) => (
              <li key={r.bookId}>
                {r.title} — {r.status === 'ok' ? `Đã lấy (${r.source === 'google' ? 'Google Books' : 'Open Library'})` : r.status === 'not_found' ? 'Không tìm thấy' : `Lỗi: ${r.message}`}
              </li>
            ))}
          </ul>
          {coverReport.remaining > 0 && <p>Bấm "Lấy bìa tự động" lần nữa để xử lý đợt tiếp theo.</p>}
        </div>
      )}

      <div className="toolbar">
        <input
          className="input input-search"
          placeholder="Tìm theo tiêu đề, tác giả, thể loại..."
          value={keyword}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select
          className="input input-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Sắp xếp sách"
        >
          <option value="">Mới thêm nhất</option>
          <option value="code_asc">Mã sách A–Z</option>
          <option value="title_asc">Tên A–Z</option>
          <option value="author_asc">Tác giả A–Z</option>
          <option value="year_desc">Năm XB mới–cũ</option>
          <option value="status">Trạng thái</option>
        </select>
        <select
          className="input input-sort"
          value={statusFilter}
          onChange={(e) => applyFilter(setStatusFilter)(e.target.value)}
          aria-label="Lọc theo trạng thái"
        >
          <option value="">Mọi trạng thái</option>
          <option value="available">Còn</option>
          <option value="borrowed">Đang mượn</option>
          <option value="reserved">Đang giữ chỗ</option>
        </select>
        <select
          className="input input-sort"
          value={publisherFilter}
          onChange={(e) => applyFilter(setPublisherFilter)(e.target.value)}
          aria-label="Lọc theo NXB"
        >
          <option value="">Mọi NXB</option>
          {publishers.map((nxb) => (
            <option key={nxb} value={nxb}>{nxb}</option>
          ))}
        </select>
        <input
          className="input input-sort input-year"
          type="number"
          placeholder="Năm XB"
          value={yearFilter}
          onChange={(e) => applyFilter(setYearFilter)(e.target.value)}
          aria-label="Lọc theo năm xuất bản"
        />
        {(statusFilter || publisherFilter || yearFilter) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
            Xóa lọc
          </button>
        )}
      </div>

      {loading ? (
        <Skeleton variant="table" count={6} />
      ) : books.length === 0 ? (
        <EmptyState
          icon="books"
          title="Không tìm thấy sách nào."
          hint="Thử từ khóa khác hoặc thêm sách mới vào kho."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã sách</th>
                <th>Tiêu đề</th>
                <th>Tác giả</th>
                <th>Thể loại</th>
                <th>NXB</th>
                <th>Năm XB</th>
                <th>Trạng thái</th>
                <th className="th-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id}>
                  <td><span className="badge badge-gray">{b.bookCode ?? `#${b.id}`}</span></td>
                  <td className="td-title">{b.title}</td>
                  <td>{b.author || '-'}</td>
                  <td>{b.category || '-'}</td>
                  <td>{b.publisher || '-'}</td>
                  <td>{b.publishYear ?? '-'}</td>
                  <td>
                    {b.status === 'available' ? (
                      <span className="badge badge-green">Còn</span>
                    ) : (
                      <span className="badge badge-gray">Đang mượn</span>
                    )}
                    {b.hasActiveReservation && (
                      <span className="badge badge-orange">Đã đặt</span>
                    )}
                  </td>
                  <td className="td-actions">
                    {!b.coverUrl && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => doFetchCover(b)} disabled={fetchingCoverId === b.id}>
                        {fetchingCoverId === b.id ? 'Đang lấy...' : 'Lấy bìa'}
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQrBook(b)}>
                      <Icon name="qr" size={16} />
                      Mã QR
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-danger-text"
                      onClick={() => setDeleteTarget(b)}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />

      {/* Form thêm/sửa sách */}
      <Modal
        open={formOpen}
        title={editing ? 'Sửa thông tin sách' : 'Thêm sách mới'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              Hủy bỏ
            </button>
            <button type="submit" form="book-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        <form id="book-form" className="form" onSubmit={submitForm}>
          <div className="field">
            <span>Tra cứu thông tin sách (Big Book, fallback iTunes; chỉ điền thông tin, không lấy bìa)</span>
            <div className="field-inline">
              <input
                className="input"
                placeholder="Nhập tên sách hoặc tác giả..."
                value={lookupTerm}
                onChange={(e) => setLookupTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doLookup(); } }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={doLookup} disabled={lookingUp}>
                {lookingUp ? 'Đang tìm...' : 'Tìm'}
              </button>
            </div>
            {lookupDone && lookupResults.length === 0 && (
              <p className="muted">Không tìm thấy sách nào trên Big Book / iTunes với từ khóa này.</p>
            )}
            {lookupResults.length > 0 && (
              <ul className="import-errors">
                {lookupResults.map((item) => (
                  <li key={`${item.source}-${item.trackId}`}>
                    <strong>{item.title}</strong>
                    {item.author ? ` — ${item.author}` : ''}
                    {item.publishYear ? ` (${item.publishYear})` : ''}
                    {item.pages ? ` — ${item.pages} trang` : ''}
                    {item.isbn ? ` — ISBN ${item.isbn}` : ''}
                    {item.genres.length > 0 ? ` — ${item.genres.slice(0, 3).join(', ')}` : ''}
                    <span className="muted"> [{item.source === 'bigbook' ? 'Big Book' : 'iTunes'}]</span>
                    {item.description ? <p className="muted">{item.description.slice(0, 150)}{item.description.length > 150 ? '...' : ''}</p> : null}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyLookup(item)}>
                      Dùng thông tin này
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="field">
            <span>Tiêu đề *</span>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Tác giả</span>
              <input className="input" value={form.author ?? ''} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              {!editing && recentAuthors.length > 0 && (
                <p className="muted">
                  Gần đây:{' '}
                  {recentAuthors.map((a) => (
                    <button key={a} type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, author: a })}>
                      {a}
                    </button>
                  ))}
                </p>
              )}
            </label>
            <label className="field">
              <span>Thể loại</span>
              <div className="field-inline">
                <select
                  className="input"
                  value={form.category ?? ''}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">-- Chọn thể loại --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="Thêm thể loại mới"
                  onClick={() => setQuickCatOpen((v) => !v)}
                >
                  +
                </button>
              </div>
              {quickCatOpen && (
                <div className="quick-add">
                  <input
                    className="input"
                    placeholder="Tên thể loại mới..."
                    value={quickCatName}
                    onChange={(e) => setQuickCatName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddCategory(); } }}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={quickAddCategory}>
                    Thêm
                  </button>
                </div>
              )}
              {quickCatError && <p className="field-error">{quickCatError}</p>}
            </label>
          </div>
          {!editing && (
            <label className="field">
              <span>Số lượng bản (mỗi bản 1 mã riêng, tối đa 50)</span>
              <input
                className="input"
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>
          )}
          <div className="form-row">
            <label className="field">
              <span>Nhà xuất bản</span>
              <select
                className="input"
                value={publisherCustom ? '__custom' : (form.publisher ?? '')}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__custom') {
                    setPublisherCustom(true);
                    setCustomPublisher(form.publisher ?? '');
                  } else {
                    setPublisherCustom(false);
                    setCustomPublisher('');
                    setForm({ ...form, publisher: v });
                  }
                }}
              >
                <option value="">-- Chọn NXB --</option>
                {recentPublishers.length > 0 && (
                  <optgroup label="Gần đây">
                    {recentPublishers.map((nxb) => (
                      <option key={`recent-${nxb}`} value={nxb}>{nxb}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Tất cả NXB">
                  {publishers
                    .filter((nxb) => !recentPublishers.includes(nxb))
                    .map((nxb) => (
                      <option key={nxb} value={nxb}>{nxb}</option>
                    ))}
                </optgroup>
                <option value="__custom">Nhập nhà xuất bản mới...</option>
              </select>
              {publisherCustom && (
                <input
                  className="input"
                  placeholder="Tên nhà xuất bản mới..."
                  value={customPublisher}
                  onChange={(e) => {
                    setCustomPublisher(e.target.value);
                    setForm({ ...form, publisher: e.target.value });
                  }}
                />
              )}
            </label>
            <label className="field">
              <span>Năm xuất bản</span>
              <input
                className="input"
                type="number"
                value={form.publishYear ?? ''}
                onChange={(e) =>
                  setForm({ ...form, publishYear: e.target.value ? Number(e.target.value) : null })
                }
              />
              {!editing && recentYears.length > 0 && (
                <p className="muted">
                  Gần đây:{' '}
                  {recentYears.map((y) => (
                    <button key={y} type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, publishYear: y })}>
                      {y}
                    </button>
                  ))}
                </p>
              )}
            </label>
          </div>
          <label className="field">
            <span>Ảnh bìa (JPEG/PNG/WebP, tối đa 2MB)</span>
            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onCoverChange(e.target.files?.[0] ?? null)}
            />
          </label>
          {coverPreview && (
            <div className="cover-preview">
              <img src={coverPreview} alt="Xem trước ảnh bìa" />
            </div>
          )}
        </form>
      </Modal>

      {/* Nhập sách từ Excel */}
      <Modal
        open={importOpen}
        title="Nhập sách từ Excel"
        onClose={() => { setImportOpen(false); setImportResult(null); setImportFile(null); }}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setImportOpen(false); setImportResult(null); setImportFile(null); }}
            >
              Đóng
            </button>
            <button type="button" className="btn btn-link btn-sm" onClick={() => downloadImportTemplate()}>
              Tải file mẫu
            </button>
            <button type="button" className="btn btn-primary" disabled={!importFile || importing} onClick={doImport}>
              {importing ? 'Đang nhập...' : 'Nhập file'}
            </button>
          </>
        }
      >
        <div className="form">
          <label className="field">
            <span>Chọn file Excel (.xlsx, tối đa 5MB)</span>
            <input
              className="input"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }}
            />
          </label>
          <p className="muted">Cột: Tiêu đề* | Tác giả | Thể loại | NXB | Năm XB | Số lượng. Dòng trống được bỏ qua.</p>
          {importResult && (
            <div className={importResult.errors.length > 0 ? 'alert alert-warning' : 'alert alert-success'}>
              <p>Đã tạo {importResult.created} cuốn sách.</p>
              {importResult.errors.length > 0 && (
                <ul className="import-errors">
                  {importResult.errors.map((er, i) => (
                    <li key={i}>Dòng {er.row}: {er.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Xem + tải mã QR */}
      <Modal open={!!qrBook} title="Mã QR của sách" onClose={() => setQrBook(null)}>
        {qrBook && (
          <div className="qr-view">
            <QRCode id="book-qr-svg" value={qrBook.qrCode} size={220} />
            <div className="qr-code-row">
              <p className="qr-code-text">{qrBook.bookCode ?? qrBook.qrCode}</p>
              <CopyButton text={qrBook.bookCode ?? qrBook.qrCode} />
            </div>
            <p className="muted">{qrBook.title}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadQrPng('book-qr-svg', `qr-sach-${qrBook.id}.png`)}
            >
              Tải mã QR (PNG)
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa sách"
        message={`Bạn có chắc muốn xóa sách "${deleteTarget?.title}"? Chỉ xóa được khi sách đang ở trạng thái Còn.`}
        confirmLabel="Xóa"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
