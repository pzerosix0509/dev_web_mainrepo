import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { Dish } from '../../types/api';
import { ErrorState, LoadingState } from '../../components/States';
import { useLoading } from '../../app/loading';

export function DishDetailPage() {
  const { id = '' } = useParams();
  const [dish, setDish] = useState<Dish>();
  const [error, setError] = useState<ApiServiceError>();
  const [loading, setLocalLoading] = useState(true);
  const { setLoading } = useLoading();

  useEffect(() => {
    const controller = new AbortController();
    setLocalLoading(true);
    setLoading(true);

    api.dish(id, { signal: controller.signal })
      .then((data) => {
        setDish(data);
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
  }, [id, setLoading]);

  if (error) {
    return (
      <section className="page">
        <ErrorState code={error.apiError.code} />
        <Link to="/dishes">← Trở lại thực đơn</Link>
      </section>
    );
  }

  if (loading || !dish) {
    return (
      <section className="page">
        <LoadingState />
      </section>
    );
  }

  return (
    <section className="page detail">
      <span className="tag">{dish.category}</span>
      <h1>{dish.name}</h1>
      <p className="price">{dish.price.toLocaleString('vi-VN')} ₫</p>
      <p>{dish.description || 'Không có mô tả chi tiết'}</p>

      <h2>Đầu bếp phụ trách</h2>
      <p>{dish.chef ? `${dish.chef.name} — ${dish.chef.specialty}` : 'Chưa cập nhật đầu bếp'}</p>

      <h2>Nguyên liệu</h2>
      {dish.ingredients && dish.ingredients.length > 0 ? (
        <ul>
          {dish.ingredients.map(({ ingredient }) => (
            <li key={ingredient.id}>
              {ingredient.name} ({ingredient.unit})
            </li>
          ))}
        </ul>
      ) : (
        <p>Chưa cập nhật nguyên liệu</p>
      )}

      <div style={{ marginTop: 30 }}>
        <Link to="/dishes">← Trở lại thực đơn</Link>
      </div>
    </section>
  );
}
