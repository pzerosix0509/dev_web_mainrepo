import type { Request, Response, NextFunction } from 'express';
import { sendBusinessError, sendSuccess } from '../../shared/response.js';
import { parseId } from '../../shared/validation.js';
import { createDish, deleteDish, findDish, listDishes, updateDish } from './dish.service.js';
import { validateDishBody, validateDishQuery } from './dish.validation.js';

export async function getDishes(req: Request, res: Response, next: NextFunction) {
  try {
    const { value, fields } = validateDishQuery(req.query);
    if (Object.keys(fields).length > 0) {
      return sendBusinessError(res, 'VALIDATION_FAILED', 'Query parameters validation failed', fields);
    }
    const result = await listDishes(value);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function getDish(req: Request, res: Response, next: NextFunction) {
  const id = parseId(req.params.id);
  if (!id) return sendBusinessError(res, 'NOT_FOUND', 'Dish was not found');
  try {
    const dish = await findDish(id);
    return dish ? sendSuccess(res, dish) : sendBusinessError(res, 'NOT_FOUND', 'Dish was not found');
  } catch (error) {
    return next(error);
  }
}

export async function postDish(req: Request, res: Response, next: NextFunction) {
  const { value, fields } = validateDishBody(req.body, false);
  if (Object.keys(fields).length) {
    return sendBusinessError(res, 'VALIDATION_FAILED', 'Dish body validation failed', fields);
  }
  try {
    const dish = await createDish(value, (value.ingredientIds ?? []) as number[]);
    return dish ? sendSuccess(res, dish) : sendBusinessError(res, 'NOT_FOUND', 'Chef or ingredient was not found');
  } catch (error) {
    return next(error);
  }
}

export async function patchDish(req: Request, res: Response, next: NextFunction) {
  const id = parseId(req.params.id);
  if (!id) return sendBusinessError(res, 'NOT_FOUND', 'Dish was not found');
  const { value, fields } = validateDishBody(req.body, true);
  if (Object.keys(fields).length) {
    return sendBusinessError(res, 'VALIDATION_FAILED', 'Dish body validation failed', fields);
  }
  try {
    const dish = await updateDish(
      id,
      Object.fromEntries(Object.entries(value).filter(([key, item]) => key !== 'ingredientIds' && item !== undefined)),
      value.ingredientIds
    );
    return dish ? sendSuccess(res, dish) : sendBusinessError(res, 'NOT_FOUND', 'Dish, chef or ingredient was not found');
  } catch (error) {
    return next(error);
  }
}

export async function removeDish(req: Request, res: Response, next: NextFunction) {
  const id = parseId(req.params.id);
  if (!id) return sendBusinessError(res, 'NOT_FOUND', 'Dish was not found');
  try {
    if (!(await findDish(id))) return sendBusinessError(res, 'NOT_FOUND', 'Dish was not found');
    await deleteDish(id);
    return sendSuccess(res, null);
  } catch (error) {
    return next(error);
  }
}
