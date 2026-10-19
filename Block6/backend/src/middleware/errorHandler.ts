import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('Internal server error:', error instanceof Error ? error.message : error);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Database constraint failure' } });
  }
  return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};
