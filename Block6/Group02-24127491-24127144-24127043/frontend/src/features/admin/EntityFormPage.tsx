import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { ErrorState, FieldError } from '../../components/States';
import { useLoading } from '../../app/loading';

export function EntityFormPage({ kind }: { kind: 'chefs' | 'ingredients' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', specialty: '', unit: '' });
  const [error, setError] = useState<ApiServiceError>();
  const [submitting, setSubmitting] = useState(false);
  const { setLoading } = useLoading();

  const kindLabel = kind === 'chefs' ? 'đầu bếp' : 'nguyên liệu';

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);

    const promise =
      kind === 'chefs'
        ? api.chef(id, { signal: controller.signal })
        : api.ingredient(id, { signal: controller.signal });

    promise
      .then((item) => {
        if (item) {
          setForm({
            name: item.name,
            specialty: 'specialty' in item ? item.specialty : '',
            unit: 'unit' in item ? item.unit : ''
          });
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err as ApiServiceError);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id, kind, setLoading]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setLoading(true);
    setError(undefined);

    try {
      const body =
        kind === 'chefs'
          ? { name: form.name, specialty: form.specialty }
          : { name: form.name, unit: form.unit };

      if (id) {
        if (kind === 'chefs') await api.updateChef(id, body);
        else await api.updateIngredient(id, body);
      } else {
        if (kind === 'chefs') await api.createChef(body);
        else await api.createIngredient(body);
      }
      navigate(`/admin/${kind}`);
    } catch (caught) {
      setError(caught as ApiServiceError);
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <section className="page form-page">
      <div className="page-title">
        <h1>{id ? 'Chỉnh sửa' : 'Thêm'} {kindLabel}</h1>
        <Link to={`/admin/${kind}`}>← Trở lại danh sách</Link>
      </div>

      {error && <ErrorState code={error.apiError.code} fields={error.apiError.fields} />}

      <form onSubmit={submit}>
        <fieldset disabled={submitting} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 20 }}>
          <label>
            Tên {kindLabel}
            <input
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={kind === 'chefs' ? 'VD: Gordon Ramsay' : 'VD: Thịt bò Wagyu'}
            />
            <FieldError message={error?.apiError.fields?.name} />
          </label>

          <label>
            {kind === 'chefs' ? 'Chuyên môn' : 'Đơn vị tính'}
            <input
              name={kind === 'chefs' ? 'specialty' : 'unit'}
              value={kind === 'chefs' ? form.specialty : form.unit}
              onChange={(e) =>
                setForm({
                  ...form,
                  [kind === 'chefs' ? 'specialty' : 'unit']: e.target.value
                })
              }
              placeholder={kind === 'chefs' ? 'VD: Món Á - Âu' : 'VD: gram, kg, quả'}
            />
            <FieldError message={error?.apiError.fields?.[kind === 'chefs' ? 'specialty' : 'unit']} />
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? 'Đang lưu...' : 'Lưu'}
            </button>
            <Link className="button" style={{ background: '#332e26', color: '#fff' }} to={`/admin/${kind}`}>
              Hủy
            </Link>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
