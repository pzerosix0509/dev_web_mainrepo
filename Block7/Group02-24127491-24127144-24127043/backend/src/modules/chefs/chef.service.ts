import { prisma } from '../../config/prisma.js';
import { withDbRetry } from '../../shared/retry.js';

export const listChefs = () =>
  withDbRetry(() => prisma.chef.findMany({ include: { _count: { select: { dishes: true } } }, orderBy: { id: 'asc' } }));

export const findChef = (id: number) =>
  withDbRetry(() => prisma.chef.findUnique({ where: { id }, include: { dishes: { select: { id: true, name: true } } } }));

export const createChef = (data: { name?: string; specialty?: string }) =>
  withDbRetry(() => prisma.chef.create({ data: { name: data.name as string, specialty: data.specialty as string } }));

export const updateChef = (id: number, data: { name?: string; specialty?: string }) =>
  withDbRetry(() => prisma.chef.update({ where: { id }, data }));

export const deleteChef = async (id: number) => {
  return withDbRetry(async () => {
    const count = await prisma.dish.count({ where: { chefId: id } });
    if (count > 0) return null;
    return prisma.chef.delete({ where: { id } });
  });
};
