import type { RequestHandler } from 'express';

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ ok: false, error: { code: 'ROUTE_NOT_FOUND', message: 'API route was not found' } });
};
