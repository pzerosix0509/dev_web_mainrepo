import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { Chef, Ingredient } from '../../types/api';
import { ErrorState, FieldError } from '../../components/States';
import { useLoading } from '../../app/loading';

export function DishFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    available: true,
    chefId: '',
    ingredientIds: [] as number[]
  });
  const [error, setError] = useState<ApiServiceError>();
  const [submitting, setSubmitting] = useState(false);
  const { setLoading } = useLoading();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    Promise.all([
      api.chefs({ signal: controller.signal }),
      api.ingredients({ signal: controller.signal }),
      id ? api.dish(id, { signal: controller.signal }) : Promise.resolve(undefined)
    ])
      .then(([chefData, ingredientData, dish]) => {
        setChefs(chefData);
        setIngredients(ingredientData);
        if (dish) {
          setForm({
            name: dish.name,
            description: dish.description,
            price: String(dish.price),
            category: dish.category,
            available: dish.available,
            chefId: dish.chef ? String(dish.chef.id) : '',
            ingredientIds: dish.ingredients.map(({ ingredient }) => ingredient.id)
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
  }, [id, setLoading]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setLoading(true);
    setError(undefined);

    try {
      const parsedPrice = form.price.trim() === '' ? undefined : Number(form.price);
      const parsedChefId = form.chefId.trim() === '' ? undefined : Number(form.chefId);

      const body = {
        name: form.name,
        description: form.description,
        price: parsedPrice,
        category: form.category,
        available: form.available,
        chefId: parsedChefId,
        ingredientIds: form.ingredientIds
      };

      if (id) {
        await api.updateDish(id, body);
      } else {
        await api.createDish(body);
      }
      navigate('/admin/dishes');
    } catch (caught) {
      setError(caught as ApiServiceError);
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  const toggleIngredient = (ingredientId: number) =>
    setForm((current) => ({
      ...current,
      ingredientIds: current.ingredientIds.includes(ingredientId)
        ? current.ingredientIds.filter((value) => value !== ingredientId)
        : [...current.ingredientIds, ingredientId]
    }));

  return (
    <section className="page form-page">
      <div className="page-title">
        <h1>{id ? 'Chỉnh sửa' : 'Thêm'} món ăn</h1>
        <Link to="/admin/dishes">← Trở lại danh sách</Link>
      </div>

      {error && <ErrorState code={error.apiError.code} fields={error.apiError.fields} />}

      <form onSubmit={submit}>
        <fieldset disabled={submitting} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 20 }}>
          <label>
            Tên món
            <input
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VD: Phở Bò Tái Lăn"
            />
            <FieldError message={error?.apiError.fields?.name} />
          </label>

          <label>
            Mô tả
            <textarea
              name="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Mô tả hương vị, nguồn gốc món ăn..."
            />
            <FieldError message={error?.apiError.fields?.description} />
          </label>

          <label>
            Giá (VNĐ)
            <input
              name="price"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="VD: 55000"
            />
            <FieldError message={error?.apiError.fields?.price} />
          </label>

          <label>
            Danh mục
            <input
              name="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="VD: Món nước, Món chính..."
            />
            <FieldError message={error?.apiError.fields?.category} />
          </label>

          <label>
            Đầu bếp
            <select
              name="chefId"
              value={form.chefId}
              onChange={(e) => setForm({ ...form, chefId: e.target.value })}
            >
              <option value="">-- Chọn đầu bếp --</option>
              {chefs.map((chef) => (
                <option key={chef.id} value={chef.id}>
                  {chef.name} ({chef.specialty})
                </option>
              ))}
            </select>
            <FieldError message={error?.apiError.fields?.chefId} />
          </label>

          <fieldset>
            <legend>Nguyên liệu</legend>
            {ingredients.map((ingredient) => (
              <label className="check" key={ingredient.id}>
                <input
                  type="checkbox"
                  checked={form.ingredientIds.includes(ingredient.id)}
                  onChange={() => toggleIngredient(ingredient.id)}
                />
                {ingredient.name} ({ingredient.unit})
              </label>
            ))}
            <FieldError message={error?.apiError.fields?.ingredientIds} />
          </fieldset>

          <label className="check">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) => setForm({ ...form, available: e.target.checked })}
            />
            Đang phục vụ
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? 'Đang lưu...' : 'Lưu món ăn'}
            </button>
            <Link className="button" style={{ background: '#332e26', color: '#fff' }} to="/admin/dishes">
              Hủy
            </Link>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
