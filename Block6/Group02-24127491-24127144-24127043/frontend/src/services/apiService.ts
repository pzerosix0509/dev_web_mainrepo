import type { ApiError, ApiResponse, Chef, Dish, Ingredient } from '../types/api';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
export class ApiServiceError extends Error {
  constructor(public readonly apiError: ApiError) {
    super(apiError.message);
  }
}

class ApiService {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: options.body
          ? { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
          : options.headers
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw new ApiServiceError({
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến máy chủ API hoặc do lỗi cấu hình CORS'
      });
    }

    if (!response.ok) {
      throw new ApiServiceError({
        code: 'HTTP_ERROR',
        message: 'Máy chủ API trả về lỗi.'
      });
    }

    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.ok) {
      throw new ApiServiceError(payload.error);
    }
    return payload.data;
  }

  dishes(params = '', options: RequestInit = {}) {
    return this.request<Dish[]>(`/dishes${params}`, options);
  }
  dish(id: string, options: RequestInit = {}) {
    return this.request<Dish>(`/dishes/${id}`, options);
  }
  createDish(body: unknown, options: RequestInit = {}) {
    return this.request<Dish>('/dishes', { ...options, method: 'POST', body: JSON.stringify(body) });
  }
  updateDish(id: string, body: unknown, options: RequestInit = {}) {
    return this.request<Dish>(`/dishes/${id}`, { ...options, method: 'PATCH', body: JSON.stringify(body) });
  }
  deleteDish(id: number | string, options: RequestInit = {}) {
    return this.request<null>(`/dishes/${id}`, { ...options, method: 'DELETE' });
  }

  chefs(options: RequestInit = {}) {
    return this.request<Chef[]>('/chefs', options);
  }
  chef(id: string, options: RequestInit = {}) {
    return this.request<Chef>(`/chefs/${id}`, options);
  }
  createChef(body: unknown, options: RequestInit = {}) {
    return this.request<Chef>('/chefs', { ...options, method: 'POST', body: JSON.stringify(body) });
  }
  updateChef(id: string, body: unknown, options: RequestInit = {}) {
    return this.request<Chef>(`/chefs/${id}`, { ...options, method: 'PATCH', body: JSON.stringify(body) });
  }
  deleteChef(id: number | string, options: RequestInit = {}) {
    return this.request<null>(`/chefs/${id}`, { ...options, method: 'DELETE' });
  }

  ingredients(options: RequestInit = {}) {
    return this.request<Ingredient[]>('/ingredients', options);
  }
  ingredient(id: string, options: RequestInit = {}) {
    return this.request<Ingredient>(`/ingredients/${id}`, options);
  }
  createIngredient(body: unknown, options: RequestInit = {}) {
    return this.request<Ingredient>('/ingredients', { ...options, method: 'POST', body: JSON.stringify(body) });
  }
  updateIngredient(id: string, body: unknown, options: RequestInit = {}) {
    return this.request<Ingredient>(`/ingredients/${id}`, { ...options, method: 'PATCH', body: JSON.stringify(body) });
  }
  deleteIngredient(id: number | string, options: RequestInit = {}) {
    return this.request<null>(`/ingredients/${id}`, { ...options, method: 'DELETE' });
  }
}
export const api = new ApiService();
