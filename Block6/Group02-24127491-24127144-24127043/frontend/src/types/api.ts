export type ApiError = { code: string; message: string; fields?: Record<string, string> };
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };
export type Chef = { id: number; name: string; specialty: string; _count?: { dishes: number }; dishes?: { id: number; name: string }[] };
export type Ingredient = { id: number; name: string; unit: string; _count?: { dishes: number }; dishes?: { dishId: number }[] };
export type DishIngredient = { ingredient: Ingredient };
export type Dish = { id: number; name: string; description: string; price: number; category: string; available: boolean; chef: Chef | null; ingredients: DishIngredient[] };
