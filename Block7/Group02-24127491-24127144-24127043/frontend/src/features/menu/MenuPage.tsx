import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import type { Dish, DishSearchMode, PaginationUiMode } from '../../types/api';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useLoading } from '../../app/loading';
import {
  InfiniteScrollSentinel,
  LoadMoreControls,
  NumberedPagination,
  PaginationModeSwitcher
} from '../../components/PaginationControls';

const CATEGORY_OPTIONS = [
  { value: '', label: 'Tất cả danh mục' },
  { value: 'Món chính', label: 'Món chính' },
  { value: 'Món khai vị', label: 'Món khai vị' },
  { value: 'Món nước', label: 'Món nước' },
  { value: 'Món tráng miệng', label: 'Món tráng miệng' },
  { value: 'Đồ uống', label: 'Đồ uống' }
];

export function MenuPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setLoading } = useLoading();

  // Đọc params từ URL
  const searchMode = (searchParams.get('mode') as DishSearchMode) || 'basic';
  const queryText = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const availableParam = searchParams.get('available') || '';
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const uiMode = (searchParams.get('uiMode') as PaginationUiMode) || 'numbered';

  // State cục bộ
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(pageParam);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState<ApiServiceError>();

  // State lọc & sắp xếp Client-side (áp dụng trên tập dữ liệu đã tải)
  const [clientSort, setClientSort] = useState<'none' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'>('none');
  const [clientCategory, setClientCategory] = useState<string>('');

  // Form input states cho thanh tìm kiếm
  const [inputQ, setInputQ] = useState(queryText);
  const [inputCategory, setInputCategory] = useState(categoryParam);
  const [inputMinPrice, setInputMinPrice] = useState(minPriceParam);
  const [inputMaxPrice, setInputMaxPrice] = useState(maxPriceParam);
  const [inputAvailable, setInputAvailable] = useState(availableParam);

  // Đồng bộ lại input form khi URL thay đổi
  useEffect(() => {
    setInputQ(queryText);
    setInputCategory(categoryParam);
    setInputMinPrice(minPriceParam);
    setInputMaxPrice(maxPriceParam);
    setInputAvailable(availableParam);
    setCurrentPage(pageParam);
  }, [queryText, categoryParam, minPriceParam, maxPriceParam, availableParam, pageParam]);

  // Ref giữ abort controller để hủy request khi có request mới
  const abortControllerRef = useRef<AbortController | null>(null);

  // Gọi API lấy dữ liệu món ăn
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLocalLoading(true);
    setLoading(true);

    const params = new URLSearchParams();
    if (searchMode) params.set('mode', searchMode);
    if (queryText) params.set('q', queryText);
    if (categoryParam) params.set('category', categoryParam);
    if (minPriceParam) params.set('minPrice', minPriceParam);
    if (maxPriceParam) params.set('maxPrice', maxPriceParam);
    if (availableParam) params.set('available', availableParam);
    params.set('page', String(currentPage));
    params.set('pageSize', '10');

    api
      .dishes(params, { signal: controller.signal })
      .then((data) => {
        setTotal(data.total);
        setError(undefined);

        if (uiMode === 'numbered') {
          // Chế độ số trang: thay thế toàn bộ danh sách
          setDishes(data.items);
        } else {
          // Chế độ Load More hoặc Infinite Scroll: nối tiếp vào danh sách tích lũy
          setDishes((prev) => {
            if (currentPage === 1) return data.items;
            // Tránh lặp ID
            const existingIds = new Set(prev.map((d) => d.id));
            const newItems = data.items.filter((d) => !existingIds.has(d.id));
            return [...prev, ...newItems];
          });
        }
      })
      .catch((caught) => {
        if (caught.name !== 'AbortError') {
          setError(caught as ApiServiceError);
        }
      })
      .finally(() => {
        setLocalLoading(false);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [searchMode, queryText, categoryParam, minPriceParam, maxPriceParam, availableParam, currentPage, uiMode, setLoading]);

  // Handler khi submit form tìm kiếm tại Server
  const handleServerSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set('mode', searchMode);
    if (inputQ.trim()) nextParams.set('q', inputQ.trim());
    else nextParams.delete('q');

    if (searchMode === 'advanced') {
      if (inputCategory) nextParams.set('category', inputCategory);
      else nextParams.delete('category');

      if (inputMinPrice) nextParams.set('minPrice', inputMinPrice);
      else nextParams.delete('minPrice');

      if (inputMaxPrice) nextParams.set('maxPrice', inputMaxPrice);
      else nextParams.delete('maxPrice');

      if (inputAvailable) nextParams.set('available', inputAvailable);
      else nextParams.delete('available');
    } else {
      nextParams.delete('category');
      nextParams.delete('minPrice');
      nextParams.delete('maxPrice');
      nextParams.delete('available');
    }

    // Khi tìm kiếm lại: luôn reset về trang 1
    nextParams.set('page', '1');
    setCurrentPage(1);
    setDishes([]);
    setSearchParams(nextParams);
  };

  // Handler đổi search mode
  const handleModeChange = (newMode: DishSearchMode) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('mode', newMode);
    nextParams.set('page', '1');
    setCurrentPage(1);
    setDishes([]);
    setSearchParams(nextParams);
  };

  // Handler đổi UI pagination mode
  const handleUiModeChange = (newUiMode: PaginationUiMode) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('uiMode', newUiMode);
    if (newUiMode !== 'numbered') {
      // Khi chuyển sang load more hoặc infinite: bắt đầu tải từ trang 1
      nextParams.set('page', '1');
      setCurrentPage(1);
      setDishes([]);
    }
    setSearchParams(nextParams);
  };

  // Handler chuyển trang ở chế độ Numbered Pagination
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(newPage));
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler tải tiếp ở chế độ Load More / Infinite Scroll
  const handleLoadNext = () => {
    if (localLoading) return;
    const hasMore = dishes.length < total;
    if (!hasMore) return;

    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(nextPage));
    setSearchParams(nextParams);
  };

  // Client-side Sort & Filter trên tập dữ liệu đã tải về trình duyệt
  const processedDishes = useMemo(() => {
    let list = [...dishes];

    // Client filter theo category
    if (clientCategory) {
      list = list.filter((d) => d.category === clientCategory);
    }

    // Client sort
    if (clientSort === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    } else if (clientSort === 'name-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name, 'vi'));
    } else if (clientSort === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (clientSort === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    }

    return list;
  }, [dishes, clientSort, clientCategory]);

  const hasMoreToLoad = dishes.length < total;

  return (
    <section className="page menu-page">
      <div className="menu-header">
        <h1>Thực đơn nhà hàng</h1>
        <p className="subtitle">Khám phá các món ăn phong phú với các chế độ tìm kiếm và phân trang đa dạng</p>
      </div>

      {/* 1. Bộ chuyển đổi chế độ tìm kiếm (Search Mode Tabs) */}
      <div className="search-mode-tabs">
        <span className="mode-label">Chế độ tìm kiếm (Server):</span>
        <div className="button-group">
          <button
            type="button"
            className={`button-mode ${searchMode === 'basic' ? 'active' : ''}`}
            onClick={() => handleModeChange('basic')}
          >
            🔍 Cơ bản (Basic ILIKE)
          </button>
          <button
            type="button"
            className={`button-mode ${searchMode === 'advanced' ? 'active' : ''}`}
            onClick={() => handleModeChange('advanced')}
          >
            ⚙️ Nâng cao (Advanced)
          </button>
          <button
            type="button"
            className={`button-mode ${searchMode === 'fulltext' ? 'active' : ''}`}
            onClick={() => handleModeChange('fulltext')}
          >
            📖 Toàn văn (Full-Text)
          </button>
          <button
            type="button"
            className={`button-mode ${searchMode === 'fuzzy' ? 'active' : ''}`}
            onClick={() => handleModeChange('fuzzy')}
          >
            🎯 Gần đúng (Fuzzy Trigram)
          </button>
        </div>
      </div>

      {/* 2. Form tìm kiếm Server */}
      <form className="search-form-card" onSubmit={handleServerSearch}>
        <div className="search-row">
          <input
            className="input-search"
            name="q"
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            placeholder={
              searchMode === 'fulltext'
                ? 'Tìm trong tên và mô tả (PostgreSQL Full-Text Search)...'
                : searchMode === 'fuzzy'
                ? 'Gõ tên món gần đúng (Fuzzy Search pg_trgm >= 0.3)...'
                : 'Tìm theo tên món ăn...'
            }
          />
          <button className="button button-primary" type="submit">
            Tìm kiếm
          </button>
          {(queryText || categoryParam || minPriceParam || maxPriceParam || availableParam) && (
            <button
              className="button button-outline"
              type="button"
              onClick={() => {
                setInputQ('');
                setInputCategory('');
                setInputMinPrice('');
                setInputMaxPrice('');
                setInputAvailable('');
                const nextParams = new URLSearchParams();
                nextParams.set('mode', searchMode);
                nextParams.set('uiMode', uiMode);
                nextParams.set('page', '1');
                setSearchParams(nextParams);
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Tiêu chí nâng cao chỉ hiện ở mode advanced */}
        {searchMode === 'advanced' && (
          <div className="advanced-filters-grid">
            <div className="filter-group">
              <label>Danh mục</label>
              <select value={inputCategory} onChange={(e) => setInputCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Giá từ (VNĐ)</label>
              <input
                type="number"
                min="0"
                step="5000"
                placeholder="0"
                value={inputMinPrice}
                onChange={(e) => setInputMinPrice(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Đến giá (VNĐ)</label>
              <input
                type="number"
                min="0"
                step="5000"
                placeholder="Ví dụ: 300000"
                value={inputMaxPrice}
                onChange={(e) => setInputMaxPrice(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Trạng thái</label>
              <select value={inputAvailable} onChange={(e) => setInputAvailable(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="true">Chỉ món còn bán</option>
                <option value="false">Chỉ món đã hết / ngưng bán</option>
              </select>
            </div>
          </div>
        )}
      </form>

      {/* 3. Phân biệt Client-side vs Server-side: Thanh Sort & Filter trên dữ liệu đã tải */}
      <div className="client-data-scope-banner">
        <div className="scope-info">
          <span className="scope-badge">Client-Side Processing</span>
          <p className="scope-text">
            Đang hiển thị <strong>{processedDishes.length}</strong> món (đã tải <strong>{dishes.length}</strong> món về
            trình duyệt | Tổng kết quả trên Server: <strong>{total}</strong> món)
          </p>
        </div>

        <div className="client-controls">
          <div className="control-item">
            <label>Lọc nhanh thể loại:</label>
            <select value={clientCategory} onChange={(e) => setClientCategory(e.target.value)}>
              <option value="">Tất cả (trong {dishes.length} món)</option>
              {CATEGORY_OPTIONS.filter((c) => c.value).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="control-item">
            <label>Sắp xếp (Client-side):</label>
            <select value={clientSort} onChange={(e) => setClientSort(e.target.value as any)}>
              <option value="none">Mặc định từ Server</option>
              <option value="name-asc">Tên món: A → Z</option>
              <option value="name-desc">Tên món: Z → A</option>
              <option value="price-asc">Giá: Thấp → Cao</option>
              <option value="price-desc">Giá: Cao → Thấp</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Bộ chuyển đổi kiểu hiển thị phân trang (Numbered / Load More / Infinite Scroll) */}
      <PaginationModeSwitcher currentMode={uiMode} onModeChange={handleUiModeChange} />

      {/* 5. Hiển thị danh sách món ăn */}
      {localLoading && dishes.length === 0 ? (
        <LoadingState />
      ) : error ? (
        <ErrorState code={error.apiError.code} />
      ) : processedDishes.length === 0 ? (
        <EmptyState text="Không tìm thấy món ăn nào phù hợp với điều kiện đã chọn." />
      ) : (
        <>
          <div className="cards-grid">
            {processedDishes.map((dish) => (
              <article className="dish-card" key={dish.id}>
                <div className="dish-card-header">
                  <span className="dish-tag">{dish.category}</span>
                  <span className={`dish-status ${dish.available ? 'status-active' : 'status-disabled'}`}>
                    {dish.available ? 'Còn bán' : 'Tạm hết'}
                  </span>
                </div>
                <h2>{dish.name}</h2>
                <p className="dish-desc">{dish.description || 'Không có mô tả chi tiết'}</p>
                <p className="dish-price">{dish.price.toLocaleString('vi-VN')} ₫</p>
                <div className="dish-meta">
                  <p>👨‍🍳 Chef: <strong>{dish.chef?.name ?? 'Chưa cập nhật'}</strong></p>
                  <p>
                    🥗 Nguyên liệu:{' '}
                    {dish.ingredients?.map(({ ingredient }) => ingredient.name).join(', ') || 'Chưa cập nhật'}
                  </p>
                </div>
                <Link className="dish-link" to={`/dishes/${dish.id}`}>
                  Xem chi tiết món ăn →
                </Link>
              </article>
            ))}
          </div>

          {/* 6. Điều khiển phân trang tương ứng với uiMode */}
          <div className="pagination-wrapper">
            {uiMode === 'numbered' && (
              <NumberedPagination
                page={currentPage}
                pageSize={10}
                total={total}
                onPageChange={handlePageChange}
                disabled={localLoading}
              />
            )}

            {uiMode === 'load-more' && (
              <LoadMoreControls
                onLoadMore={handleLoadNext}
                loading={localLoading}
                hasMore={hasMoreToLoad}
              />
            )}

            {uiMode === 'infinite' && (
              <InfiniteScrollSentinel
                onLoadMore={handleLoadNext}
                loading={localLoading}
                hasMore={hasMoreToLoad}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
