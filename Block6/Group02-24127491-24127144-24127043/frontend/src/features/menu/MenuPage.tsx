import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { Dish } from '../../types/api';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useLoading } from '../../app/loading';

export function MenuPage() {
  const [params, setParams] = useSearchParams();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [error, setError] = useState<ApiServiceError>();
  const [loading, setLocalLoading] = useState(true);
  const { setLoading } = useLoading();
  const q = params.get('q') ?? '';

  useEffect(() => {
    const controller = new AbortController();
    setLocalLoading(true);
    setLoading(true);

    api.dishes(q ? `?q=${encodeURIComponent(q)}` : '', { signal: controller.signal })
      .then((data) => {
        setDishes(data);
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
  }, [q, setLoading]);

  return (
    <section className="page">
      <h1>Thực đơn</h1>
      <form
        className="search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q') as string;
          setParams(value ? { q: value } : {});
        }}
      >
        <input name="q" defaultValue={q} placeholder="Tìm món ăn..." />
        <button className="button" type="submit">Tìm kiếm</button>
      </form>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState code={error.apiError.code} />
      ) : dishes.length === 0 ? (
        <EmptyState text="Không tìm thấy món ăn nào phù hợp." />
      ) : (
        <div className="cards">
          {dishes.map((dish) => (
            <article className="card" key={dish.id}>
              <span className="tag">{dish.category}</span>
              <h2>{dish.name}</h2>
              <p>{dish.description || 'Không có mô tả'}</p>
              <p className="price">{dish.price.toLocaleString('vi-VN')} ₫</p>
              <p>Chef: {dish.chef?.name ?? 'Chưa cập nhật'}</p>
              <p>
                Nguyên liệu:{' '}
                {dish.ingredients?.map(({ ingredient }) => ingredient.name).join(', ') || 'Chưa cập nhật'}
              </p>
              <Link to={`/dishes/${dish.id}`}>Xem chi tiết →</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
