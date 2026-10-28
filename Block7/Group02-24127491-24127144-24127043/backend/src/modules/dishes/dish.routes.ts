import { Router } from 'express';
import { getDish, getDishes, patchDish, postDish, removeDish } from './dish.controller.js';
export const dishRoutes = Router();
dishRoutes.get('/', getDishes); dishRoutes.get('/:id', getDish); dishRoutes.post('/', postDish); dishRoutes.patch('/:id', patchDish); dishRoutes.delete('/:id', removeDish);
