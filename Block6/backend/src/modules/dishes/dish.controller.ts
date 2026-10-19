import type { Request, Response, NextFunction } from 'express';
import { sendBusinessError, sendSuccess } from '../../shared/response.js';
import { parseId } from '../../shared/validation.js';
import { createDish, deleteDish, findDish, listDishes, updateDish } from './dish.service.js';
import { validateDishBody } from './dish.validation.js';

export async function getDishes(req: Request, res: Response, next: NextFunction) {
  try {
    const available = req.query.available === undefined ? undefined : req.query.available === 'true' ? true : req.query.available === 'false' ? false : null;
    if (available === null) return sendBusinessError(res, 'VALIDATION_FAILED', 'Invalid query', { available: 'Phải là true hoặc false' });
    return sendSuccess(res, await listDishes({ q: typeof req.query.q === 'string' ? req.query.q.trim() : undefined, category: typeof req.query.category === 'string' ? req.query.category.trim() : undefined, available }));
  } catch (error) { return next(error); }
}
export async function getDish(req: Request, res: Response, next: NextFunction) {
  const id = parseId(req.params.id); if (!id) return sendBusinessError(res, 'INVALID_ID', 'Invalid dish id');
  try { const dish = await findDish(id); return dish ? sendSuccess(res, dish) : sendBusinessError(res, 'NOT_FOUND', 'Dish was not found'); } catch (error) { return next(error); }
}
export async function postDish(req: Request, res: Response, next: NextFunction) {
  const { value, fields } = validateDishBody(req.body, false); if (Object.keys(fields).length) return sendBusinessError(res, 'VALIDATION_FAILED', 'Dish body validation failed', fields);
  try { const dish = await createDish(value, value.ingredientIds as number[]); return dish ? sendSuccess(res, dish, 201) : sendBusinessError(res, 'NOT_FOUND', 'Chef or ingredient was not found'); } catch (error) { return next(error); }
}
export async function patchDish(req: Request, res: Response, next: NextFunction) {
  const id = parseId(req.params.id); if (!id) return sendBusinessError(res, 'INVALID_ID', 'Invalid dish id');
  const { value, fields } = validateDishBody(req.body, true); if (Object.keys(fields).length) return sendBusinessError(res, 'VALIDATION_FAILED', 'Dish body validation failed', fields);
  try { const dish = await updateDish(id, Object.fromEntries(Object.entries(value).filter(([key, item]) => key !== 'ingredientIds' && item !== undefined)), value.ingredientIds); return dish ? sendSuccess(res, dish) : sendBusinessError(res, 'NOT_FOUND', 'Dish, chef or ingredient was not found'); } catch (error) { return next(error); }
}
export async function removeDish(req: Request, res: Response, next: NextFunction) {
  const id = parseId(req.params.id); if (!id) return sendBusinessError(res, 'INVALID_ID', 'Invalid dish id');
  try { if (!(await findDish(id))) return sendBusinessError(res, 'NOT_FOUND', 'Dish was not found'); await deleteDish(id); return sendSuccess(res, null); } catch (error) { return next(error); }
}
