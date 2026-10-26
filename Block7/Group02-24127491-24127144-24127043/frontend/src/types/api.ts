export type ApiError = { code: string; message: string; fields?: Record<string, string> };
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type Chef = { id: number; name: string; specialty: string; _count?: { dishes: number }; dishes?: { id: number; name: string }[] };
export type Ingredient = { id: number; name: string; unit: string; _count?: { dishes: number }; dishes?: { dishId: number }[] };
export type DishIngredient = { ingredient: Ingredient };
export type Dish = { id: number; name: string; description: string; price: number; category: string; available: boolean; chef: Chef | null; ingredients: DishIngredient[] };

export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type DishSearchMode = 'basic' | 'advanced' | 'fulltext' | 'fuzzy';
export type PaginationUiMode = 'numbered' | 'load-more' | 'infinite';

export interface DishQueryParams {
  mode?: DishSearchMode;
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
  page?: number;
  pageSize?: number;
}
