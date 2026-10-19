import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiNotFound } from './middleware/notFound.js';
import { dishRoutes } from './modules/dishes/dish.routes.js';
import { chefRoutes } from './modules/chefs/chef.routes.js';
import { ingredientRoutes } from './modules/ingredients/ingredient.routes.js';

export const app = express();
app.use(cors({ origin: env.frontendOrigin, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, data: { service: 'restaurant-api' } }));
app.use('/api/dishes', dishRoutes);
app.use('/api/chefs', chefRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api', apiNotFound);
app.use(errorHandler);
