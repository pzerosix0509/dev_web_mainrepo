import { useEffect, useRef } from 'react';
import type { PaginationUiMode } from '../types/api';

interface NumberedPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
  disabled?: boolean;
}

export function NumberedPagination({ page, pageSize, total, onPageChange, disabled }: NumberedPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  // Tính toán danh sách số trang cần hiển thị (ví dụ 1 .. 4 5 6 .. 10)
  const pages: (number | string)[] = [];
  const delta = 2;
  const left = page - delta;
  const right = page + delta;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i <= right)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <nav className="pagination-numbered" aria-label="Phân trang món ăn">
      <button
        type="button"
        className="button button-outline"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        ← Trang trước
      </button>

      <div className="page-numbers">
        {pages.map((p, idx) =>
          typeof p === 'number' ? (
            <button
              key={idx}
              type="button"
              className={`page-btn ${p === page ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
              disabled={disabled || p === page}
            >
              {p}
            </button>
          ) : (
            <span key={idx} className="page-ellipsis">
              ...
            </span>
          )
        )}
      </div>

      <button
        type="button"
        className="button button-outline"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        Trang sau →
      </button>
    </nav>
  );
}

interface LoadMoreProps {
  onLoadMore: () => void;
  loading: boolean;
  hasMore: boolean;
}

export function LoadMoreControls({ onLoadMore, loading, hasMore }: LoadMoreProps) {
  if (!hasMore) {
    return <p className="pagination-end-msg">✨ Đã hiển thị toàn bộ món ăn phù hợp.</p>;
  }

  return (
    <div className="pagination-load-more">
      <button
        type="button"
        className="button button-large"
        onClick={onLoadMore}
        disabled={loading}
      >
        {loading ? 'Đang tải thêm món...' : 'Tải thêm món ăn ↓'}
      </button>
    </div>
  );
}

interface InfiniteScrollProps {
  onLoadMore: () => void;
  loading: boolean;
  hasMore: boolean;
}

export function InfiniteScrollSentinel({ onLoadMore, loading, hasMore }: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || loading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!hasMore) {
    return <p className="pagination-end-msg">✨ Đã cuộn đến cuối danh sách món ăn.</p>;
  }

  return (
    <div ref={sentinelRef} className="infinite-sentinel">
      {loading && <p className="loading-text">Đang tự động nạp thêm món ăn...</p>}
    </div>
  );
}

interface ModeSwitcherProps {
  currentMode: PaginationUiMode;
  onModeChange: (mode: PaginationUiMode) => void;
}

export function PaginationModeSwitcher({ currentMode, onModeChange }: ModeSwitcherProps) {
  return (
    <div className="ui-mode-switcher">
      <span className="switcher-label">Kiểu hiển thị phân trang:</span>
      <div className="switcher-tabs">
        <button
          type="button"
          className={`tab-btn ${currentMode === 'numbered' ? 'active' : ''}`}
          onClick={() => onModeChange('numbered')}
        >
          📄 Số trang
        </button>
        <button
          type="button"
          className={`tab-btn ${currentMode === 'load-more' ? 'active' : ''}`}
          onClick={() => onModeChange('load-more')}
        >
          📥 Tải thêm (Load More)
        </button>
        <button
          type="button"
          className={`tab-btn ${currentMode === 'infinite' ? 'active' : ''}`}
          onClick={() => onModeChange('infinite')}
        >
          ♾️ Cuộn vô tận (Infinite Scroll)
        </button>
      </div>
    </div>
  );
}
