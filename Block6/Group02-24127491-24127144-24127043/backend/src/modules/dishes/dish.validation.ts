import { booleanField, idArrayField, integerField, stringField } from '../../shared/validation.js';

export type DishInput = { name?: string; description?: string; price?: number; category?: string; available?: boolean; chefId?: number; ingredientIds?: number[] };

export function validateDishBody(body: unknown, partial: boolean): { value: DishInput; fields: Record<string, string> } {
  const source = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const fields: Record<string, string> = {};
  const value: DishInput = {
    name: stringField(source.name, 'name', fields, !partial),
    description: source.description === undefined && !partial
      ? ''
      : stringField(source.description, 'description', fields, false) ?? (partial ? undefined : ''),
    price: integerField(source.price, 'price', fields, !partial, 0),
    category: stringField(source.category, 'category', fields, !partial),
    available: source.available === undefined && !partial
      ? true
      : booleanField(source.available, 'available', fields, false) ?? (partial ? undefined : true),
    chefId: integerField(source.chefId, 'chefId', fields, !partial, 1),
    ingredientIds: source.ingredientIds === undefined && !partial
      ? []
      : idArrayField(source.ingredientIds, 'ingredientIds', fields, false) ?? (partial ? undefined : [])
  };
  if (partial && Object.keys(source).length === 0) fields._form = 'PATCH phải chứa ít nhất một trường cần cập nhật';
  return { value, fields };
}
