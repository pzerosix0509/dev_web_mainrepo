import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { Chef, Dish, Ingredient } from '../../types/api';
import { ErrorState, LoadingState } from '../../components/States';
import { useLoading } from '../../app/loading';

export function AdminDetailPage({ kind }: { kind: 'dishes' | 'chefs' | 'ingredients' }) {
  const { id = '' } = useParams();
  const [data, setData] = useState<Dish | Chef | Ingredient | null>(null);
  const [error, setError] = useState<ApiServiceError>();
  const [loading, setLocalLoading] = useState(true);
  const { setLoading } = useLoading();

  const kindLabel = kind === 'dishes' ? 'Món ăn' : kind === 'chefs' ? 'Đầu bếp' : 'Nguyên liệu';

  useEffect(() => {
    const controller = new AbortController();
    setLocalLoading(true);
    setLoading(true);

    const promise =
      kind === 'dishes'
        ? api.dish(id, { signal: controller.signal })
        : kind === 'chefs'
        ? api.chef(id, { signal: controller.signal })
        : api.ingredient(id, { signal: controller.signal });

    promise
      .then((res) => {
        setData(res);
        setError(undefined);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err as ApiServiceError);
        }
      })
      .finally(() => {
        setLocalLoading(false);
        setLoading(false);
      });

    return () => controller.abort();
  }, [id, kind, setLoading]);

  if (error) {
    return (
      <section className="page">
        <ErrorState code={error.apiError.code} />
        <Link to={`/admin/${kind}`}>← Trở lại danh sách</Link>
      </section>
    );
  }

  if (loading || !data) {
    return (
      <section className="page">
        <LoadingState />
      </section>
    );
  }

  return (
    <section className="page detail">
      <div className="page-title">
        <h1>Chi tiết {kindLabel} #{id}</h1>
        <div>
          <Link className="button" to={`/admin/${kind}/${id}/edit`}>Chỉnh sửa</Link>
          <Link className="button" style={{ marginLeft: 8, background: '#d9534f', color: '#fff' }} to={`/admin/${kind}/${id}/delete`}>Xóa</Link>
        </div>
      </div>

      {kind === 'dishes' && (
        <>
          <span className="tag">{(data as Dish).category}</span>
          <h2>{(data as Dish).name}</h2>
          <p className="price">{(data as Dish).price.toLocaleString('vi-VN')} ₫</p>
          <p>{(data as Dish).description || 'Không có mô tả'}</p>
          <p>Trạng thái: {(data as Dish).available ? 'Đang phục vụ' : 'Tạm ngưng'}</p>
          <h3>Đầu bếp phụ trách</h3>
          <p>{(data as Dish).chef ? `${(data as Dish).chef!.name} — ${(data as Dish).chef!.specialty}` : 'Chưa cập nhật'}</p>
          <h3>Nguyên liệu</h3>
          <ul>
            {(data as Dish).ingredients.map(({ ingredient }) => (
              <li key={ingredient.id}>{ingredient.name} ({ingredient.unit})</li>
            ))}
          </ul>
        </>
      )}

      {kind === 'chefs' && (
        <>
          <h2>{(data as Chef).name}</h2>
          <p><strong>Chuyên môn:</strong> {(data as Chef).specialty}</p>
          {(data as Chef).dishes && (data as Chef).dishes!.length > 0 && (
            <>
              <h3>Danh sách món ăn</h3>
              <ul>
                {(data as Chef).dishes!.map((dish) => (
                  <li key={dish.id}>{dish.name}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {kind === 'ingredients' && (
        <>
          <h2>{(data as Ingredient).name}</h2>
          <p><strong>Đơn vị tính:</strong> {(data as Ingredient).unit}</p>
        </>
      )}

      <div style={{ marginTop: 25 }}>
        <Link to={`/admin/${kind}`}>← Trở lại danh sách</Link>
      </div>
    </section>
  );
}
