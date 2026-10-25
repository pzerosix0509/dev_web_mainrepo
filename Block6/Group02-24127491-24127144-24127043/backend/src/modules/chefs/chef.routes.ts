import { Router } from 'express';
import { getChef, getChefs, patchChef, postChef, removeChef } from './chef.controller.js';
export const chefRoutes = Router();
chefRoutes.get('/', getChefs); chefRoutes.get('/:id', getChef); chefRoutes.post('/', postChef); chefRoutes.patch('/:id', patchChef); chefRoutes.delete('/:id', removeChef);
