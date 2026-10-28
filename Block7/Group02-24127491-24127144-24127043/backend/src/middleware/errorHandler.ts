import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // Check for malformed JSON error from express.json()
  if (
    error instanceof SyntaxError &&
    ('status' in error && (error as unknown as { status: number }).status === 400 ||
     'body' in error ||
     'type' in error && (error as unknown as { type: string }).type === 'entity.parse.failed')
  ) {
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }

  console.error('Internal server error:', error instanceof Error ? error.message : error);
  return res.status(500).json({ error: 'Internal server error' });
};
