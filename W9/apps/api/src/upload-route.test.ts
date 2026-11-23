import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPhoto = vi.hoisted(() => vi.fn());
vi.mock('./photo-service.js', () => ({
  createPhoto,
  deletePhoto: vi.fn(),
  loadOriginal: vi.fn(),
  publishVersion: vi.fn(),
  retryCleanupJobs: vi.fn(),
}));

import { buildApp } from './app.js';

function multipart(files: Array<{ name: string; type: string; body: Buffer }>) {
  const boundary = `----gallery-${Date.now()}`;
  const chunks: Buffer[] = [];
  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photos"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
    chunks.push(file.body, Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('multipart policy', () => {
  beforeEach(() => {
    createPhoto.mockReset();
    createPhoto.mockImplementation(async () => ({ id: crypto.randomUUID() }));
  });

  it('keeps the valid result when another file is fake', async () => {
    const valid = await sharp({ create: { width: 80, height: 60, channels: 3, background: 'blue' } }).jpeg().toBuffer();
    const payload = multipart([
      { name: 'valid.jpg', type: 'image/jpeg', body: valid },
      { name: 'fake.jpeg', type: 'image/jpeg', body: Buffer.from('MZ harmless fake executable') },
    ]);
    const app = await buildApp();
    const response = await app.inject({ method: 'POST', url: '/api/photos/upload', headers: { 'content-type': payload.contentType }, payload: payload.body });
    await app.close();
    expect(response.statusCode).toBe(200);
    const results = response.json().results as Array<{ status: string; code?: string }>;
    expect(results.map((item) => item.status)).toEqual(['accepted', 'rejected']);
    expect(results[1]!.code).toBe('FILE_SIGNATURE_INVALID');
    expect(createPhoto).toHaveBeenCalledTimes(1);
  });

  it('returns a per-file rejection for the sixth file', async () => {
    const valid = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } }).jpeg().toBuffer();
    const payload = multipart(Array.from({ length: 6 }, (_, index) => ({ name: `${index}.jpg`, type: 'image/jpeg', body: valid })));
    const app = await buildApp();
    const response = await app.inject({ method: 'POST', url: '/api/photos/upload', headers: { 'content-type': payload.contentType }, payload: payload.body });
    await app.close();
    expect(response.statusCode).toBe(200);
    const results = response.json().results as Array<{ status: string; code?: string }>;
    expect(results).toHaveLength(6);
    expect(results[5]).toMatchObject({ status: 'rejected', code: 'TOO_MANY_FILES' });
    expect(createPhoto).toHaveBeenCalledTimes(5);
  });
});
