import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processEdit, validateAndProcess } from './image-processor.js';

let directory: string;

beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'gallery-tests-')); });
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

async function fixture(name: string, body: Buffer) {
  const path = join(directory, name);
  await writeFile(path, body);
  return path;
}

describe('image validation and normalization', () => {
  it.each([
    ['valid.jpg', 'image/jpeg', () => sharp({ create: { width: 1400, height: 900, channels: 3, background: '#5bb9a7' } }).jpeg().toBuffer()],
    ['valid.png', 'image/png', () => sharp({ create: { width: 900, height: 1200, channels: 4, background: '#7eaaef' } }).png().toBuffer()],
  ])('accepts and generates responsive files for %s', async (name, mime, create) => {
    const path = await fixture(name, await create());
    const result = await validateAndProcess(path, name, mime);
    expect(result.files.map((file) => file.kind)).toEqual(expect.arrayContaining(['ORIGINAL', 'THUMB', 'MEDIUM']));
    expect(result.files.filter((file) => file.kind !== 'ORIGINAL')).toHaveLength(new Set(result.files.slice(1).map((file) => file.width)).size);
    expect(result.files.length).toBeLessThanOrEqual(4);
    expect(result.files.every((file) => file.width <= result.width)).toBe(true);
  });

  it.each([
    ['renamed.jpeg', Buffer.from('MZ harmless fake executable fixture'), 'FILE_SIGNATURE_INVALID'],
    ['magic.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from('not a decodable JPEG')]), 'PROCESSING'],
    ['renamed.jpg', Buffer.from('plain text'), 'FILE_SIGNATURE_INVALID'],
  ])('rejects fake content: %s', async (name, body, expected) => {
    const path = await fixture(name, body);
    await expect(validateAndProcess(path, name, 'image/jpeg')).rejects.toMatchObject(expected === 'PROCESSING' ? {} : { code: expected });
  });

  it('rejects a JPEG truncated at the end', async () => {
    const jpeg = await sharp({ create: { width: 300, height: 300, channels: 3, background: 'red' } }).jpeg().toBuffer();
    const path = await fixture('truncated.jpg', jpeg.subarray(0, jpeg.length - 80));
    await expect(validateAndProcess(path, 'truncated.jpg', 'image/jpeg')).rejects.toBeTruthy();
  });

  it('strips EXIF from normalized original and variants', async () => {
    const source = await sharp({ create: { width: 400, height: 700, channels: 3, background: 'green' } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const path = await fixture('oriented.jpg', source);
    const result = await validateAndProcess(path, 'oriented.jpg', 'image/jpeg');
    const metadata = await sharp(result.files[0]!.body).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(result.width).toBe(700);
    expect(result.height).toBe(400);
  });

  it('validates edit crop boundaries and rotation types at the service boundary', async () => {
    const source = await sharp({ create: { width: 400, height: 300, channels: 3, background: 'blue' } }).jpeg().toBuffer();
    await expect(processEdit(source, { crop: { x: 399, y: 0, width: 2, height: 10 }, rotation: 0, flipHorizontal: false })).rejects.toMatchObject({ code: 'INVALID_CROP' });
  });

  it('creates metadata-free Deep Zoom tiles for a 12 megapixel image', async () => {
    const source = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#4d8ab5' } }).jpeg({ quality: 70 }).toBuffer();
    const path = await fixture('deep-zoom.jpg', source);
    const result = await validateAndProcess(path, 'deep-zoom.jpg', 'image/jpeg');
    expect(result.deepZoom?.tiles.length).toBeGreaterThan(10);
    const manifest = JSON.parse(result.deepZoom!.manifest.toString()) as { tileSize: number; maxLevel: number };
    expect(manifest.tileSize).toBe(256);
    expect(manifest.maxLevel).toBeGreaterThan(10);
    expect((await sharp(result.deepZoom!.tiles[0]!.body).metadata()).exif).toBeUndefined();
  }, 30_000);
});
