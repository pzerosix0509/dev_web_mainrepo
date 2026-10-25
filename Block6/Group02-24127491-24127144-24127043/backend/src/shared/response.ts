import type { Response } from 'express';

export type ErrorCode = 'VALIDATION_FAILED' | 'NOT_FOUND' | 'ALREADY_EXISTS' | 'CONFLICT' | 'INVALID_ID';

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function sendBusinessError(res: Response, code: ErrorCode, message: string, fields?: Record<string, string>) {
  return res.status(200).json({ ok: false, error: { code, message, ...(fields ? { fields } : {}) } });
}
