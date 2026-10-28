import type { RequestHandler } from 'express';

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
};
