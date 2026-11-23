import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  putObject: vi.fn(async () => 'etag'),
  deleteObjects: vi.fn(async () => undefined),
}));

vi.mock('./db.js', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('./storage.js', () => ({
  putObject: mocks.putObject,
  deleteObjects: mocks.deleteObjects,
  getObject: vi.fn(),
  listPrefix: vi.fn(),
}));
vi.mock('./cache.js', () => ({ invalidatePhoto: vi.fn() }));
vi.mock('./events.js', () => ({ broadcast: vi.fn() }));

import { createPhoto } from './photo-service.js';

describe('object/DB compensation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes every uploaded object when the DB transaction fails', async () => {
    mocks.transaction.mockRejectedValueOnce(new Error('injected database failure'));
    const processed = {
      detectedMimeType: 'image/jpeg', width: 40, height: 30,
      files: [
        { kind: 'ORIGINAL' as const, suffix: 'original.jpg', body: Buffer.from('original'), mimeType: 'image/jpeg', width: 40, height: 30, byteSize: 8, checksum: 'a' },
        { kind: 'THUMB' as const, suffix: 'thumb.webp', body: Buffer.from('thumb'), mimeType: 'image/webp', width: 40, height: 30, byteSize: 5, checksum: 'b' },
      ],
    };
    await expect(createPhoto('safe.jpg', processed)).rejects.toThrow('injected database failure');
    expect(mocks.putObject).toHaveBeenCalledTimes(2);
    expect(mocks.deleteObjects).toHaveBeenCalledTimes(1);
    const keys = mocks.deleteObjects.mock.calls[0]![0];
    expect(keys).toHaveLength(2);
    expect(keys.every((key: string) => /^photos\/[0-9a-f-]+\/v1\//.test(key))).toBe(true);
  });

  it('passes only persisted variant fields to Prisma', async () => {
    const create = vi.fn(async ({ data }: { data: { id: string } }) => ({ id: data.id }));
    mocks.transaction.mockImplementationOnce(async (callback: (tx: unknown) => unknown) => callback({ photo: { create } }));
    await createPhoto('safe.jpg', {
      detectedMimeType: 'image/jpeg', width: 40, height: 30,
      files: [
        { kind: 'ORIGINAL', suffix: 'original.jpg', body: Buffer.from('original'), mimeType: 'image/jpeg', width: 40, height: 30, byteSize: 8, checksum: 'a' },
        { kind: 'THUMB', suffix: 'thumb.webp', body: Buffer.from('thumb'), mimeType: 'image/webp', width: 40, height: 30, byteSize: 5, checksum: 'b' },
      ],
    });
    const variant = create.mock.calls[0]![0].data.versions.create.variants.create[0];
    expect(variant).toMatchObject({ kind: 'THUMB', mimeType: 'image/webp', width: 40, height: 30, byteSize: 5, checksum: 'b' });
    expect(variant).not.toHaveProperty('body');
    expect(variant).not.toHaveProperty('suffix');
  });
});
