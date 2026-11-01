import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { Dish } from '../../types/api';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useLoading } from '../../app/loading';
import { NumberedPagination } from '../../components/PaginationControls';

type SortField = 'id' | 'name' | 'price';
type SortDirection = 'asc' | 'desc';

export function DishesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const qParam = searchParams.get('q') || '';

  const [items, setItems] = useState<Dish[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(pageParam);
  const [error, setError] = useState<ApiServiceError>();
  const [loading, setLocalLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(qParam);
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { setLoading } = useLoading();

  useEffect(() => {
    setCurrentPage(pageParam);
    setSearchQuery(qParam);
  }, [pageParam, qParam]);

  useEffect(() => {
    const controller = new AbortController();
    setLocalLoading(true);
    setLoading(true);

    const params = new URLSearchParams();
    if (qParam) params.set('q', qParam);
    params.set('page', String(currentPage));
    params.set('pageSize', '10');

    api.dishes(params, { signal: controller.signal })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setError(undefined);
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

    return () => controller.abort();
  }, [currentPage, qParam, setLoading]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      next.set('q', searchQuery.trim());
    } else {
      next.delete('q');
    }
    next.set('page', '1');
    setCurrentPage(1);
    setSearchParams(next);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'id') {
        cmp = a.id - b.id;
      } else if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, 'vi');
      } else if (sortField === 'price') {
        cmp = a.price - b.price;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [items, sortField, sortDirection]);

  return (
    <section className="page admin-page">
      <div className="page-title">
        <div>
          <h1>Quản lý món ăn</h1>
          <p className="admin-subtitle">Tổng số: <strong>{total}</strong> món ăn trong hệ thống</p>
        </div>
        <Link className="button" to="/admin/dishes/new">
          + Thêm món mới
        </Link>
      </div>

      <form className="admin-search-bar" onSubmit={handleSearchSubmit}>
        <input
          placeholder="Tìm kiếm theo tên món ăn..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit" className="button button-outline">
          Tìm
        </button>
        {qParam && (
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              setSearchQuery('');
              const next = new URLSearchParams(searchParams);
              next.delete('q');
              next.set('page', '1');
              setSearchParams(next);
            }}
          >
            Hủy lọc
          </button>
        )}
      </form>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState code={error.apiError.code} />
      ) : sortedItems.length === 0 ? (
        <EmptyState text="Không có món ăn nào trong trang này." />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('id')}
                    title="Bấm để sắp xếp theo ID"
                  >
                    ID {sortField === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('name')}
                    title="Bấm để sắp xếp theo tên"
                  >
                    Món ăn {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th>Danh mục</th>
                  <th>Chef</th>
                  <th>Nguyên liệu</th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('price')}
                    title="Bấm để sắp xếp theo giá"
                  >
                    Giá bán {sortField === 'price' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((dish) => (
                  <tr key={dish.id}>
                    <td>#{dish.id}</td>
                    <td>
                      <Link to={`/admin/dishes/${dish.id}`}>
                        <strong>{dish.name}</strong>
                      </Link>
                    </td>
                    <td>
                      <span className="dish-tag">{dish.category}</span>
                    </td>
                    <td>{dish.chef?.name ?? 'Chưa cập nhật'}</td>
                    <td>{dish.ingredients?.map(({ ingredient }) => ingredient.name).join(', ') || '—'}</td>
                    <td>{dish.price.toLocaleString('vi-VN')} ₫</td>
                    <td>
                      <span className={`status-badge ${dish.available ? 'active' : 'inactive'}`}>
                        {dish.available ? 'Còn bán' : 'Hết hàng'}
                      </span>
                    </td>
                    <td>
                      <Link to={`/admin/dishes/${dish.id}`}>Xem</Link>
                      {' · '}
                      <Link to={`/admin/dishes/${dish.id}/edit`}>Sửa</Link>
                      {' · '}
                      <Link to={`/admin/dishes/${dish.id}/delete`} style={{ color: '#e09a8b' }}>
                        Xóa
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <NumberedPagination
              page={currentPage}
              pageSize={10}
              total={total}
              onPageChange={handlePageChange}
              disabled={loading}
            />
          </div>
        </>
      )}
    </section>
  );
}
