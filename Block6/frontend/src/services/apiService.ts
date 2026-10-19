import type { ApiError, ApiResponse, Chef, Dish, Ingredient } from '../types/api';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
export class ApiServiceError extends Error { constructor(public readonly apiError: ApiError) { super(apiError.message); } }

class ApiService {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`${baseUrl}${path}`, { ...options, headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers ?? {}) } : options.headers });
      const payload = await response.json() as ApiResponse<T>;
      if (!payload.ok) throw new ApiServiceError(payload.error);
      if (!response.ok) throw new ApiServiceError({ code: 'HTTP_ERROR', message: 'API request failed' });
      return payload.data;
    } catch (error) {
      if (error instanceof ApiServiceError) throw error;
      throw new ApiServiceError({ code: 'NETWORK_ERROR', message: 'Không thể kết nối đến máy chủ API hoặc do lỗi cấu hình CORS' });
    }
  }
  dishes(params = '') { return this.request<Dish[]>(`/dishes${params}`); }
  dish(id: string) { return this.request<Dish>(`/dishes/${id}`); }
  createDish(body: unknown) { return this.request<Dish>('/dishes', { method: 'POST', body: JSON.stringify(body) }); }
  updateDish(id: string, body: unknown) { return this.request<Dish>(`/dishes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); }
  deleteDish(id: number) { return this.request<null>(`/dishes/${id}`, { method: 'DELETE' }); }
  chefs() { return this.request<Chef[]>('/chefs'); }
  createChef(body: unknown) { return this.request<Chef>('/chefs', { method: 'POST', body: JSON.stringify(body) }); }
  updateChef(id: string, body: unknown) { return this.request<Chef>(`/chefs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); }
  deleteChef(id: number) { return this.request<null>(`/chefs/${id}`, { method: 'DELETE' }); }
  ingredients() { return this.request<Ingredient[]>('/ingredients'); }
  createIngredient(body: unknown) { return this.request<Ingredient>('/ingredients', { method: 'POST', body: JSON.stringify(body) }); }
  updateIngredient(id: string, body: unknown) { return this.request<Ingredient>(`/ingredients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); }
  deleteIngredient(id: number) { return this.request<null>(`/ingredients/${id}`, { method: 'DELETE' }); }
}
export const api = new ApiService();
