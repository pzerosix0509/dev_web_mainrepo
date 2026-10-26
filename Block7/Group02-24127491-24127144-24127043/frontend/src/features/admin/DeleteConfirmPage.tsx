import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { ErrorState, LoadingState } from '../../components/States';
import { useLoading } from '../../app/loading';

export function DeleteConfirmPage({ kind }: { kind: 'dishes' | 'chefs' | 'ingredients' }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [targetName, setTargetName] = useState<string>('');
  const [error, setError] = useState<ApiServiceError>();
  const [loading, setLocalLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { setLoading } = useLoading();

  const kindLabel = kind === 'dishes' ? 'món ăn' : kind === 'chefs' ? 'đầu bếp' : 'nguyên liệu';

  useEffect(() => {
    const controller = new AbortController();
    setLocalLoading(true);
    setLoading(true);

    const fetchPromise =
      kind === 'dishes'
        ? api.dish(id, { signal: controller.signal }).then((dish) => dish.name)
        : kind === 'chefs'
        ? api.chef(id, { signal: controller.signal }).then((chef) => chef.name)
        : api.ingredient(id, { signal: controller.signal }).then((ing) => ing.name);

    fetchPromise
      .then((name) => {
        setTargetName(name);
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

  const confirmDelete = async () => {
    setDeleting(true);
    setLoading(true);
    setError(undefined);
    try {
      if (kind === 'dishes') {
        await api.deleteDish(id);
      } else if (kind === 'chefs') {
        await api.deleteChef(id);
      } else {
        await api.deleteIngredient(id);
      }
      navigate(`/admin/${kind}`);
    } catch (caught) {
      setError(caught as ApiServiceError);
    } finally {
      setDeleting(false);
      setLoading(false);
    }
  };

  return (
    <section className="page form-page">
      <h1>Xác nhận xóa {kindLabel}</h1>
      {error && <ErrorState code={error.apiError.code} fields={error.apiError.fields} />}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="card" style={{ maxWidth: 500 }}>
          <p>
            Bạn có chắc chắn muốn xóa vĩnh viễn {kindLabel}: <strong>{targetName || `#${id}`}</strong>?
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button
              className="button"
              style={{ background: '#d9534f', color: '#fff' }}
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Đang xóa...' : 'Xác nhận xóa vĩnh viễn'}
            </button>
            <Link className="button" style={{ background: '#332e26', color: '#fff' }} to={`/admin/${kind}`}>
              Hủy bỏ
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
