import { Router } from 'express';
import { getIngredient, getIngredients, patchIngredient, postIngredient, removeIngredient } from './ingredient.controller.js';
export const ingredientRoutes = Router();
ingredientRoutes.get('/', getIngredients); ingredientRoutes.get('/:id', getIngredient); ingredientRoutes.post('/', postIngredient); ingredientRoutes.patch('/:id', patchIngredient); ingredientRoutes.delete('/:id', removeIngredient);
