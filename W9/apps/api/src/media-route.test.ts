import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./db.js', () => ({
  prisma: { photoVersion: { findFirst: vi.fn(async () => ({ id: 'version' })) } },
}));
vi.mock('./storage.js', () => ({
  headObject: vi.fn(async () => ({ ContentType: 'image/webp', ContentLength: 4, ETag: '"etag-1"' })),
  getObject: vi.fn(async () => ({ Body: Readable.from(Buffer.from('webp')) })),
  deleteObjects: vi.fn(),
  listPrefix: vi.fn(),
  putObject: vi.fn(),
}));

import { buildApp } from './app.js';

const url = '/media/photos/00000000-0000-4000-8000-000000000000/v1/thumb.webp';

describe('immutable media endpoint', () => {
  it('streams GET with safe cache headers and supports HEAD/conditional requests', async () => {
    const app = await buildApp();
    const get = await app.inject({ method: 'GET', url });
    expect(get.statusCode).toBe(200);
    expect(get.headers['content-type']).toContain('image/webp');
    expect(get.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(get.headers.etag).toBe('"etag-1"');
    expect(get.headers['x-content-type-options']).toBe('nosniff');
    expect(get.body).toBe('webp');
    const head = await app.inject({ method: 'HEAD', url });
    expect(head.statusCode).toBe(200);
    expect(head.body).toBe('');
    const conditional = await app.inject({ method: 'GET', url, headers: { 'if-none-match': '"etag-1"' } });
    expect(conditional.statusCode).toBe(304);
    await app.close();
  });
});
