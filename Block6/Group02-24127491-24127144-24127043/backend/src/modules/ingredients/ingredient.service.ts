import { prisma } from '../../config/prisma.js';
export const listIngredients = () => prisma.ingredient.findMany({ include: { _count: { select: { dishes: true } } }, orderBy: { id: 'asc' } });
export const findIngredient = (id: number) => prisma.ingredient.findUnique({ where: { id }, include: { dishes: { select: { dishId: true } } } });
export const createIngredient = (data: { name?: string; unit?: string }) => prisma.ingredient.create({ data: { name: data.name as string, unit: data.unit as string } });
export const updateIngredient = (id: number, data: { name?: string; unit?: string }) => prisma.ingredient.update({ where: { id }, data });
export const deleteIngredient = async (id: number) => { const count = await prisma.dishIngredient.count({ where: { ingredientId: id } }); if (count > 0) return null; return prisma.ingredient.delete({ where: { id } }); };
