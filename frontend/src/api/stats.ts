import { api } from './client';
import { unwrapData, type DashboardStats } from './types';

/** UC07: số liệu tổng quan + top 5 sách mượn nhiều nhất. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get('/stats/dashboard');
  const r = unwrapData<Record<string, unknown>>(data);
  const topRaw = (r.topBooks ?? r.top_books ?? []) as unknown[];
  return {
    totalBooks: Number(r.totalBooks ?? r.total_books ?? 0),
    borrowing: Number(r.borrowing ?? 0),
    overdue: Number(r.overdue ?? 0),
    totalReaders: Number(r.totalReaders ?? r.total_readers ?? 0),
    topBooks: (Array.isArray(topRaw) ? topRaw : []).map((t) => {
      const tr = (t ?? {}) as Record<string, unknown>;
      return {
        title: String(tr.title ?? ''),
        count: Number(tr.count ?? tr.borrowCount ?? 0),
      };
    }),
  };
}

/** Tải báo cáo Excel (2 sheet: Mượn trả + Tổng quan) theo bộ lọc hiện tại. */
export async function exportStatsExcel(params: {
  status?: string;
  readerId?: number;
  from?: string;
  to?: string;
}): Promise<void> {
  const res = await api.get('/stats/export/excel', { params, responseType: 'blob' });
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] as string }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `bao-cao-thu-vien-${stamp}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
