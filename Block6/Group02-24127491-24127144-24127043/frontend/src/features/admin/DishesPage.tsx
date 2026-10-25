import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { Dish } from '../../types/api';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useLoading } from '../../app/loading';

export function DishesPage() {
  const [items, setItems] = useState<Dish[]>([]);
  const [error, setError] = useState<ApiServiceError>();
  const [loading, setLocalLoading] = useState(true);
  const { setLoading } = useLoading();

  useEffect(() => {
    const controller = new AbortController();
    setLocalLoading(true);
    setLoading(true);

    api.dishes('', { signal: controller.signal })
      .then((data) => {
        setItems(data);
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
  }, [setLoading]);

  return (
    <section className="page">
      <div className="page-title">
        <h1>Quản lý món ăn</h1>
        <Link className="button" to="/admin/dishes/new">Thêm món</Link>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState code={error.apiError.code} />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Món ăn</th>
                <th>Chef</th>
                <th>Nguyên liệu</th>
                <th>Giá</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((dish) => (
                <tr key={dish.id}>
                  <td>
                    <Link to={`/admin/dishes/${dish.id}`}>{dish.name}</Link>
                  </td>
                  <td>{dish.chef?.name ?? 'Chưa cập nhật'}</td>
                  <td>{dish.ingredients?.map(({ ingredient }) => ingredient.name).join(', ')}</td>
                  <td>{dish.price.toLocaleString('vi-VN')} ₫</td>
                  <td>
                    <Link to={`/admin/dishes/${dish.id}`}>Xem</Link>
                    {' · '}
                    <Link to={`/admin/dishes/${dish.id}/edit`}>Sửa</Link>
                    {' · '}
                    <Link to={`/admin/dishes/${dish.id}/delete`} style={{ color: '#e09a8b' }}>Xóa</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
