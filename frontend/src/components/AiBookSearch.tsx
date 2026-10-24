import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { getErrorMessage } from '../api/client';
import { aiSearchBooks, type AiSearchResponse, type AiSearchResult } from '../api/public';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export type SearchMode = 'keyword' | 'ai';

/** Nút chuyển chế độ tìm kiếm: theo tên / bằng mô tả AI (UC16). Dùng chung Landing + trang độc giả. */
export function SearchModeToggle({
  mode,
  onChange,
}: {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}) {
  return (
    <div className="search-mode-toggle" role="tablist" aria-label="Chế độ tìm kiếm">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'keyword'}
        className={`btn ${mode === 'keyword' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => onChange('keyword')}
      >
        Tìm theo tên / tác giả
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'ai'}
        className={`btn ${mode === 'ai' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => onChange('ai')}
      >
        Không nhớ tên? Tìm bằng mô tả (AI)
      </button>
    </div>
  );
}

/**
 * Panel tìm sách bằng mô tả (UC16): form + trạng thái + lưới kết quả.
 * Mỗi trang tự vẽ thẻ sách qua renderCard (Landing: thẻ link đơn giản;
 * trang độc giả: thẻ có nút Đặt trước). Caption "Khớp % + lý do" dùng chung.
 */
export function AiSearchPanel({
  renderCard,
  gridClassName = 'landing-book-grid',
}: {
  renderCard: (result: AiSearchResult) => ReactNode;
  gridClassName?: string;
}) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<AiSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    const description = query.trim();
    if (description.length < 3 || loading) return;
    setLoading(true);
    setError('');
    try {
      setResult(await aiSearchBooks(description));
    } catch (err) {
      setError(getErrorMessage(err, 'Không tìm được sách lúc này, thử lại sau nhé.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-search-panel">
      <form onSubmit={onSearch}>
        <textarea
          className="input ai-search-input"
          rows={3}
          maxLength={600}
          placeholder="Mô tả nội dung cuốn sách bạn nhớ... Ví dụ: cậu bé phù thủy có vết sẹo hình tia chớp, học trường phép thuật"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Mô tả nội dung sách"
        />
        <div className="ai-search-actions">
          <span className="muted">
            {query.length}/600 — càng mô tả rõ nhân vật, tình tiết, bối cảnh thì AI càng tìm đúng.
          </span>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || query.trim().length < 3}
          >
            {loading ? 'AI đang tìm...' : 'Tìm bằng AI'}
          </button>
        </div>
      </form>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <Skeleton variant="book" count={4} />
      ) : result !== null ? (
        <>
          {result.mode === 'fallback' && (
            <div className="alert alert-info">
              AI chưa khả dụng lúc này nên thư viện đang hiển thị kết quả khớp từ khóa trong tên
              sách, tác giả và thể loại.
            </div>
          )}
          {result.results.length === 0 ? (
            <EmptyState
              icon="search"
              title="Chưa tìm thấy sách khớp với mô tả."
              hint="Thử mô tả thêm nhân vật, tình tiết hoặc bối cảnh bạn nhớ được."
            />
          ) : (
            <div className={gridClassName}>
              {result.results.map((r) => (
                <div key={r.book.id} className="ai-result-item">
                  {renderCard(r)}
                  <div className="ai-result-caption">
                    <span className="badge badge-green ai-score-badge">Khớp {r.score}%</span>
                    {r.reason && <p>{r.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
