import { prisma } from '../../config/prisma.js';
import { withDbRetry } from '../../shared/retry.js';

export const listIngredients = () =>
  withDbRetry(() => prisma.ingredient.findMany({ include: { _count: { select: { dishes: true } } }, orderBy: { id: 'asc' } }));

export const findIngredient = (id: number) =>
  withDbRetry(() => prisma.ingredient.findUnique({ where: { id }, include: { dishes: { select: { dishId: true } } } }));

export const createIngredient = (data: { name?: string; unit?: string }) =>
  withDbRetry(() => prisma.ingredient.create({ data: { name: data.name as string, unit: data.unit as string } }));

export const updateIngredient = (id: number, data: { name?: string; unit?: string }) =>
  withDbRetry(() => prisma.ingredient.update({ where: { id }, data }));

export const deleteIngredient = async (id: number) => {
  return withDbRetry(async () => {
    const count = await prisma.dishIngredient.count({ where: { ingredientId: id } });
    if (count > 0) return null;
    return prisma.ingredient.delete({ where: { id } });
  });
};
