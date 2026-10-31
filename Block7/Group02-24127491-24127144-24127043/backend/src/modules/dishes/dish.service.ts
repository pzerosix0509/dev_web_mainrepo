import { Prisma, prisma } from '../../config/prisma.js';
import { withDbRetry } from '../../shared/retry.js';
import { escapeLikePattern } from '../../shared/validation.js';
import type { DishQueryParams } from './dish.validation.js';

export const dishInclude = {
  chef: { select: { id: true, name: true, specialty: true } },
  ingredients: { include: { ingredient: true } }
} as const;

export interface PaginatedDishesResult {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listDishes(query: DishQueryParams): Promise<PaginatedDishesResult> {
  const { mode, q, category, minPrice, maxPrice, available, page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  // Xây dựng điều kiện WHERE động bằng Prisma.sql
  const conditions: Prisma.Sql[] = [];

  if (category !== undefined) {
    conditions.push(Prisma.sql`"category" = ${category}`);
  }
  if (minPrice !== undefined) {
    conditions.push(Prisma.sql`"price" >= ${minPrice}`);
  }
  if (maxPrice !== undefined) {
    conditions.push(Prisma.sql`"price" <= ${maxPrice}`);
  }
  if (available !== undefined) {
    conditions.push(Prisma.sql`"available" = ${available}`);
  }

  let orderClause = Prisma.sql`ORDER BY "id" ASC`;

  if (mode === 'basic') {
    if (q) {
      const pattern = escapeLikePattern(q);
      conditions.push(Prisma.sql`"name" ILIKE ${pattern} ESCAPE '!'`);
    }
    orderClause = Prisma.sql`ORDER BY "id" ASC`;
  } else if (mode === 'advanced') {
    if (q) {
      const pattern = escapeLikePattern(q);
      conditions.push(Prisma.sql`"name" ILIKE ${pattern} ESCAPE '!'`);
    }
    orderClause = Prisma.sql`ORDER BY "id" ASC`;
  } else if (mode === 'fulltext') {
    if (q) {
      conditions.push(
        Prisma.sql`to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("description", '')) @@ plainto_tsquery('simple', ${q})`
      );
      orderClause = Prisma.sql`ORDER BY ts_rank(to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("description", '')), plainto_tsquery('simple', ${q})) DESC, "id" ASC`;
    } else {
      orderClause = Prisma.sql`ORDER BY "id" ASC`;
    }
  } else if (mode === 'fuzzy') {
    if (q) {
      conditions.push(Prisma.sql`similarity("name", ${q}) >= 0.3`);
      orderClause = Prisma.sql`ORDER BY similarity("name", ${q}) DESC, "id" ASC`;
    } else {
      orderClause = Prisma.sql`ORDER BY "id" ASC`;
    }
  }

  const whereClause = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;

  // Đếm tổng số bản ghi thỏa điều kiện
  const countQuery = Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM "Dish"
    ${whereClause}
  `;

  // Lấy danh sách ID thỏa điều kiện kèm phân trang
  const selectQuery = Prisma.sql`
    SELECT "id"
    FROM "Dish"
    ${whereClause}
    ${orderClause}
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countResult = await withDbRetry(() => prisma.$queryRaw<{ count: number }[]>(countQuery));
  const idRows = await withDbRetry(() => prisma.$queryRaw<{ id: number }[]>(selectQuery));

  const total = countResult[0]?.count ?? 0;
  const ids = idRows.map((r) => r.id);

  if (ids.length === 0) {
    return {
      items: [],
      total,
      page,
      pageSize
    };
  }

  // Lấy chi tiết thông tin món ăn kèm quan hệ chef và ingredients
  const dishes = await withDbRetry(() =>
    prisma.dish.findMany({
      where: { id: { in: ids } },
      include: dishInclude
    })
  );

  // Bảo toàn thứ tự sắp xếp theo kết quả SQL (quan trọng cho FTS rank DESC và Fuzzy similarity DESC)
  const dishMap = new Map(dishes.map((d) => [d.id, d]));
  const items = ids.map((id) => dishMap.get(id)).filter((item): item is NonNullable<typeof item> => item !== undefined);

  return {
    items,
    total,
    page,
    pageSize
  };
}

export async function findDish(id: number) {
  return withDbRetry(() => prisma.dish.findUnique({ where: { id }, include: dishInclude }));
}

export async function createDish(value: Record<string, unknown>, ingredientIds: number[]) {
  return withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const chef = await tx.chef.findUnique({ where: { id: value.chefId as number } });
      const ingredients = await tx.ingredient.findMany({ where: { id: { in: ingredientIds } } });
      if (!chef || ingredients.length !== ingredientIds.length) return null;
      return tx.dish.create({
        data: {
          name: value.name as string,
          description: (value.description ?? '') as string,
          price: value.price as number,
          category: value.category as string,
          available: (value.available ?? true) as boolean,
          chefId: value.chefId as number,
          ingredients: { create: ingredientIds.map((ingredientId) => ({ ingredientId })) }
        },
        include: dishInclude
      });
    })
  );
}

export async function updateDish(id: number, value: Record<string, unknown>, ingredientIds?: number[]) {
  return withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const current = await tx.dish.findUnique({ where: { id } });
      if (!current) return null;
      if (value.chefId !== undefined && !(await tx.chef.findUnique({ where: { id: value.chefId as number } }))) return null;
      if (ingredientIds && (await tx.ingredient.count({ where: { id: { in: ingredientIds } } })) !== ingredientIds.length) return null;
      if (ingredientIds) await tx.dishIngredient.deleteMany({ where: { dishId: id } });
      const data = {
        ...(value.name !== undefined ? { name: value.name as string } : {}),
        ...(value.description !== undefined ? { description: value.description as string } : {}),
        ...(value.price !== undefined ? { price: value.price as number } : {}),
        ...(value.category !== undefined ? { category: value.category as string } : {}),
        ...(value.available !== undefined ? { available: value.available as boolean } : {}),
        ...(value.chefId !== undefined ? { chefId: value.chefId as number } : {}),
        ...(ingredientIds ? { ingredients: { create: ingredientIds.map((ingredientId) => ({ ingredientId })) } } : {})
      };
      return tx.dish.update({ where: { id }, data, include: dishInclude });
    })
  );
}

export async function deleteDish(id: number) {
  return withDbRetry(() => prisma.dish.delete({ where: { id } }));
}
