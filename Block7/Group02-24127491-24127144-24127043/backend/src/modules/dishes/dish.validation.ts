import { booleanField, idArrayField, integerField, stringField } from '../../shared/validation.js';

export type DishInput = { name?: string; description?: string; price?: number; category?: string; available?: boolean; chefId?: number; ingredientIds?: number[] };

export type DishSearchMode = 'basic' | 'advanced' | 'fulltext' | 'fuzzy';

export interface DishQueryParams {
  mode: DishSearchMode;
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
  page: number;
  pageSize: number;
}

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

export function validateDishQuery(rawQuery: Record<string, unknown>): { value: DishQueryParams; fields: Record<string, string> } {
  const fields: Record<string, string> = {};

  // mode
  let mode: DishSearchMode = 'basic';
  if (rawQuery.mode !== undefined && rawQuery.mode !== '') {
    if (typeof rawQuery.mode === 'string' && ['basic', 'advanced', 'fulltext', 'fuzzy'].includes(rawQuery.mode)) {
      mode = rawQuery.mode as DishSearchMode;
    } else {
      fields.mode = 'Chế độ tìm kiếm không hợp lệ (hỗ trợ basic, advanced, fulltext, fuzzy)';
    }
  }

  // page (default 1)
  let page = 1;
  if (rawQuery.page !== undefined && rawQuery.page !== '') {
    const rawPage = String(rawQuery.page);
    if (/^\d+$/.test(rawPage) && Number(rawPage) >= 1) {
      page = Number(rawPage);
    } else {
      fields.page = 'Số trang page phải là số nguyên dương >= 1';
    }
  }

  // pageSize (default 10, max 100)
  let pageSize = 10;
  if (rawQuery.pageSize !== undefined && rawQuery.pageSize !== '') {
    const rawSize = String(rawQuery.pageSize);
    if (/^\d+$/.test(rawSize) && Number(rawSize) >= 1 && Number(rawSize) <= 100) {
      pageSize = Number(rawSize);
    } else {
      fields.pageSize = 'Kích thước trang pageSize phải là số nguyên từ 1 đến 100';
    }
  }

  // q: chuỗi tìm kiếm, chuỗi trắng chuẩn hóa thành undefined
  let q: string | undefined = undefined;
  if (typeof rawQuery.q === 'string' && rawQuery.q.trim() !== '') {
    q = rawQuery.q.trim();
  }

  // category
  let category: string | undefined = undefined;
  if (typeof rawQuery.category === 'string' && rawQuery.category.trim() !== '') {
    category = rawQuery.category.trim();
  }

  // minPrice: 0 là cận hợp lệ
  let minPrice: number | undefined = undefined;
  if (rawQuery.minPrice !== undefined && rawQuery.minPrice !== '') {
    const rawMin = String(rawQuery.minPrice);
    if (/^\d+$/.test(rawMin)) {
      minPrice = Number(rawMin);
    } else {
      fields.minPrice = 'minPrice phải là số nguyên >= 0';
    }
  }

  // maxPrice
  let maxPrice: number | undefined = undefined;
  if (rawQuery.maxPrice !== undefined && rawQuery.maxPrice !== '') {
    const rawMax = String(rawQuery.maxPrice);
    if (/^\d+$/.test(rawMax)) {
      maxPrice = Number(rawMax);
    } else {
      fields.maxPrice = 'maxPrice phải là số nguyên >= 0';
    }
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    fields.maxPrice = 'maxPrice không được nhỏ hơn minPrice';
  }

  // available: boolean
  let available: boolean | undefined = undefined;
  if (rawQuery.available !== undefined && rawQuery.available !== '') {
    if (rawQuery.available === 'true') {
      available = true;
    } else if (rawQuery.available === 'false') {
      available = false;
    } else {
      fields.available = 'available phải là true hoặc false';
    }
  }

  return {
    value: {
      mode,
      q,
      category,
      minPrice,
      maxPrice,
      available,
      page,
      pageSize
    },
    fields
  };
}
