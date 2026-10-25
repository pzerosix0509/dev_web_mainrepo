import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { Chef, Ingredient } from '../../types/api';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useLoading } from '../../app/loading';

type Entity = Chef | Ingredient;

export function EntityPage({ kind }: { kind: 'chefs' | 'ingredients' }) {
  const [items, setItems] = useState<Entity[]>([]);
  const [error, setError] = useState<ApiServiceError>();
  const [loading, setLocalLoading] = useState(true);
  const { setLoading } = useLoading();

  useEffect(() => {
    const controller = new AbortController();
    setLocalLoading(true);
    setLoading(true);

    const promise =
      kind === 'chefs'
        ? api.chefs({ signal: controller.signal })
        : api.ingredients({ signal: controller.signal });

    promise
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
  }, [kind, setLoading]);

  return (
    <section className="page">
      <div className="page-title">
        <h1>{kind === 'chefs' ? 'Đầu bếp' : 'Nguyên liệu'}</h1>
        <Link className="button" to={`/admin/${kind}/new`}>
          Thêm mới
        </Link>
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
                <th>Tên</th>
                <th>{kind === 'chefs' ? 'Chuyên môn' : 'Đơn vị'}</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/admin/${kind}/${item.id}`}>{item.name}</Link>
                  </td>
                  <td>{kind === 'chefs' ? (item as Chef).specialty : (item as Ingredient).unit}</td>
                  <td>
                    <Link to={`/admin/${kind}/${item.id}`}>Xem</Link>
                    {' · '}
                    <Link to={`/admin/${kind}/${item.id}/edit`}>Sửa</Link>
                    {' · '}
                    <Link to={`/admin/${kind}/${item.id}/delete`} style={{ color: '#e09a8b' }}>Xóa</Link>
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
