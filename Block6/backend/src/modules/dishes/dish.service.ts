import { prisma } from '../../config/prisma.js';

const dishInclude = { chef: { select: { id: true, name: true, specialty: true } }, ingredients: { include: { ingredient: true } } } as const;

export async function listDishes(query: { q?: string; category?: string; available?: boolean }) {
  return prisma.dish.findMany({ where: { ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}), ...(query.category ? { category: query.category } : {}), ...(query.available === undefined ? {} : { available: query.available }) }, include: dishInclude, orderBy: { id: 'desc' } });
}
export async function findDish(id: number) { return prisma.dish.findUnique({ where: { id }, include: dishInclude }); }
export async function createDish(value: Record<string, unknown>, ingredientIds: number[]) {
  return prisma.$transaction(async (tx) => {
    const chef = await tx.chef.findUnique({ where: { id: value.chefId as number } });
    const ingredients = await tx.ingredient.findMany({ where: { id: { in: ingredientIds } } });
    if (!chef || ingredients.length !== ingredientIds.length) return null;
    return tx.dish.create({ data: { name: value.name as string, description: value.description as string, price: value.price as number, category: value.category as string, available: value.available as boolean, chefId: value.chefId as number, ingredients: { create: ingredientIds.map((ingredientId) => ({ ingredientId })) } }, include: dishInclude });
  });
}
export async function updateDish(id: number, value: Record<string, unknown>, ingredientIds?: number[]) {
  return prisma.$transaction(async (tx) => {
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
  });
}
export async function deleteDish(id: number) { return prisma.dish.delete({ where: { id } }); }
