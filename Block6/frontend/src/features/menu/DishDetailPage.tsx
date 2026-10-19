import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiServiceError } from '../../services/apiService';
import { Dish } from '../../types/api';
import { ErrorState, LoadingState } from '../../components/States';
import { useLoading } from '../../app/loading';
export function DishDetailPage() { const { id = '' } = useParams(); const [dish, setDish] = useState<Dish>(); const [error, setError] = useState<ApiServiceError>(); const { setLoading } = useLoading(); useEffect(() => { setLoading(true); api.dish(id).then(setDish).catch(setError).finally(() => setLoading(false)); }, [id, setLoading]); if (error) return <section className="page"><ErrorState code={error.apiError.code} /><Link to="/menu">← Trở lại thực đơn</Link></section>; if (!dish) return <LoadingState />; return <section className="page detail"><span className="tag">{dish.category}</span><h1>{dish.name}</h1><p className="price">{dish.price.toLocaleString('vi-VN')} ₫</p><p>{dish.description}</p><h2>Đầu bếp phụ trách</h2><p>{dish.chef ? `${dish.chef.name} — ${dish.chef.specialty}` : 'Chưa cập nhật đầu bếp'}</p><h2>Nguyên liệu</h2><ul>{dish.ingredients.map(({ ingredient }) => <li key={ingredient.id}>{ingredient.name} ({ingredient.unit})</li>)}</ul><Link to="/menu">← Trở lại thực đơn</Link></section>; }
