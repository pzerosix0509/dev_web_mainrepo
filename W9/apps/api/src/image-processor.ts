import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, relative, sep } from 'node:path';
import { fileTypeFromFile } from 'file-type';
import sharp, { type Sharp } from 'sharp';
import { config, limits } from './config.js';
import { UploadError } from './errors.js';

sharp.cache({ memory: 64, files: 0, items: 32 });
sharp.concurrency(config.IMAGE_CONCURRENCY);

const allowed = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

export type GeneratedFile = {
  kind: 'ORIGINAL' | 'THUMB' | 'MEDIUM' | 'LARGE' | 'PREVIEW';
  suffix: string;
  body: Buffer;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
};

export type ProcessedImage = {
  detectedMimeType: string;
  width: number;
  height: number;
  files: GeneratedFile[];
  deepZoom?: {
    manifest: Buffer;
    tiles: Array<{ path: string; body: Buffer; width: number; height: number; level: number; x: number; y: number; checksum: string }>;
  };
};

function cleanName(name: string): string {
  const printable = Array.from(name.normalize('NFKC')).filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join('');
  return printable.replace(/[\\/]/g, '_').slice(0, 180) || 'image';
}

export function normalizeDisplayName(name: string): string {
  return cleanName(name);
}

function checksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function generateDeepZoom(source: Buffer, width: number, height: number): Promise<ProcessedImage['deepZoom']> {
  if (!config.ENABLE_DEEP_ZOOM || width * height < config.DEEP_ZOOM_MIN_PIXELS) return undefined;
  const directory = await mkdtemp(join(tmpdir(), 'gallery-tiles-'));
  const descriptor = join(directory, 'pyramid');
  const tilesRoot = join(directory, 'pyramid_files');
  try {
    await sharp(source, { failOn: 'error', limitInputPixels: limits.maxPixels })
      .webp({ quality: 82, effort: 4 })
      .tile({ size: 256, overlap: 0, layout: 'dz', container: 'fs' })
      .toFile(descriptor);
    const tiles: NonNullable<ProcessedImage['deepZoom']>['tiles'] = [];
    const walk = async (folder: string): Promise<void> => {
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        const fullPath = join(folder, entry.name);
        if (entry.isDirectory()) { await walk(fullPath); continue; }
        const path = relative(tilesRoot, fullPath).split(sep).join('/');
        const match = /^(\d+)\/(\d+)_(\d+)\.webp$/.exec(path);
        if (!match) continue;
        const body = await readFile(fullPath);
        const info = await sharp(body).metadata();
        tiles.push({ path, body, width: info.width!, height: info.height!, level: Number(match[1]), x: Number(match[2]), y: Number(match[3]), checksum: checksum(body) });
      }
    };
    await walk(tilesRoot);
    const maxLevel = Math.ceil(Math.log2(Math.max(width, height)));
    return {
      manifest: Buffer.from(JSON.stringify({ type: 'deep-zoom', width, height, tileSize: 256, overlap: 0, format: 'webp', minLevel: 0, maxLevel })),
      tiles,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function outputInfo(body: Buffer, kind: GeneratedFile['kind'], suffix: string, mimeType: string): Promise<GeneratedFile> {
  const metadata = await sharp(body, { failOn: 'error', limitInputPixels: limits.maxPixels }).metadata();
  if (!metadata.width || !metadata.height) throw new UploadError('IMAGE_DECODE_FAILED', 'Không đọc được kích thước ảnh sau xử lý');
  return { kind, suffix, body, mimeType, width: metadata.width, height: metadata.height, byteSize: body.length, checksum: checksum(body) };
}

async function reencode(pipeline: Sharp, mimeType: string): Promise<{ body: Buffer; suffix: string }> {
  if (mimeType === 'image/png') return { body: await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(), suffix: 'png' };
  if (mimeType === 'image/webp') return { body: await pipeline.webp({ quality: 90, effort: 5 }).toBuffer(), suffix: 'webp' };
  return { body: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), suffix: 'jpg' };
}

export async function validateAndProcess(path: string, fileName: string, declaredMime: string): Promise<ProcessedImage> {
  const extension = extname(fileName).toLowerCase();
  const expectedMime = allowed.get(extension);
  if (!expectedMime || (!config.ENABLE_WEBP_UPLOAD && expectedMime === 'image/webp')) {
    throw new UploadError('FILE_EXTENSION_NOT_ALLOWED', 'Chỉ chấp nhận JPEG, PNG và WebP');
  }
  const detected = await fileTypeFromFile(path);
  if (!detected || !['image/jpeg', 'image/png', 'image/webp'].includes(detected.mime)) {
    throw new UploadError('FILE_SIGNATURE_INVALID', 'Nội dung file không phải ảnh được hỗ trợ');
  }
  if (detected.mime !== expectedMime || declaredMime.toLowerCase() !== detected.mime) {
    throw new UploadError('FILE_CONTENT_TYPE_MISMATCH', 'Phần mở rộng, Content-Type và nội dung file không khớp');
  }

  let metadata;
  try {
    metadata = await sharp(path, { failOn: 'error', limitInputPixels: limits.maxPixels }).metadata();
  } catch {
    throw new UploadError('IMAGE_DECODE_FAILED', 'Ảnh bị hỏng, thiếu dữ liệu hoặc vượt giới hạn pixel');
  }
  const swapsAxes = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
  const width = swapsAxes ? metadata.height : metadata.width;
  const height = swapsAxes ? metadata.width : metadata.height;
  if (!width || !height) throw new UploadError('IMAGE_DECODE_FAILED', 'Không đọc được kích thước ảnh');
  if ((metadata.pages ?? 1) > 1) throw new UploadError('ANIMATED_IMAGE_NOT_ALLOWED', 'Không chấp nhận ảnh động hoặc nhiều frame');
  if (width > limits.maxDimension || height > limits.maxDimension || width * height > limits.maxPixels) {
    throw new UploadError('IMAGE_DIMENSIONS_EXCEEDED', `Ảnh vượt ${limits.maxDimension}px hoặc ${limits.maxPixels} pixel`);
  }

  const normalized = await reencode(sharp(path, { failOn: 'error', limitInputPixels: limits.maxPixels }).rotate(), detected.mime);
  const original = await outputInfo(normalized.body, 'ORIGINAL', `original.${normalized.suffix}`, detected.mime);
  const files: GeneratedFile[] = [original];
  const widths = [
    { kind: 'THUMB' as const, width: 320, name: 'thumb.webp' },
    { kind: 'MEDIUM' as const, width: 1024, name: 'medium.webp' },
    { kind: 'LARGE' as const, width: 1920, name: 'large.webp' },
  ];
  const used = new Set<number>();
  for (const target of widths) {
    const actual = Math.min(target.width, original.width);
    if (used.has(actual)) continue;
    used.add(actual);
    const body = await sharp(normalized.body, { failOn: 'error', limitInputPixels: limits.maxPixels })
      .resize({ width: actual, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: target.kind === 'THUMB' ? 78 : 84, effort: 5 })
      .toBuffer();
    files.push(await outputInfo(body, target.kind, target.name, 'image/webp'));
  }
  const deepZoom = await generateDeepZoom(normalized.body, original.width, original.height);
  return { detectedMimeType: detected.mime, width: original.width, height: original.height, files, deepZoom };
}

export type EditInput = { crop?: { x: number; y: number; width: number; height: number }; rotation: 0 | 90 | 180 | 270; flipHorizontal: boolean };

export async function processEdit(source: Buffer, input: EditInput): Promise<ProcessedImage> {
  const metadata = await sharp(source, { failOn: 'error', limitInputPixels: limits.maxPixels }).metadata();
  if (!metadata.width || !metadata.height) throw new UploadError('IMAGE_DECODE_FAILED', 'Không đọc được ảnh gốc chuẩn hóa');
  let pipeline = sharp(source, { failOn: 'error', limitInputPixels: limits.maxPixels });
  if (input.crop) {
    const { x, y, width, height } = input.crop;
    if (x < 0 || y < 0 || width < 1 || height < 1 || x + width > metadata.width || y + height > metadata.height) {
      throw new UploadError('INVALID_CROP', 'Vùng crop phải nằm hoàn toàn trong ảnh gốc');
    }
    pipeline = pipeline.extract({ left: x, top: y, width, height });
  }
  pipeline = pipeline.rotate(input.rotation);
  if (input.flipHorizontal) pipeline = pipeline.flop();
  const normalized = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  const original = await outputInfo(normalized, 'ORIGINAL', 'original.jpg', 'image/jpeg');
  const files: GeneratedFile[] = [original];
  const targets = [
    { kind: 'THUMB' as const, width: 320, name: 'thumb.webp' },
    { kind: 'MEDIUM' as const, width: 1024, name: 'medium.webp' },
    { kind: 'LARGE' as const, width: 1920, name: 'large.webp' },
  ];
  const used = new Set<number>();
  for (const target of targets) {
    const actual = Math.min(target.width, original.width);
    if (used.has(actual)) continue;
    used.add(actual);
    const body = await sharp(normalized).resize({ width: actual, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    files.push(await outputInfo(body, target.kind, target.name, 'image/webp'));
  }
  const deepZoom = await generateDeepZoom(normalized, original.width, original.height);
  return { detectedMimeType: 'image/jpeg', width: original.width, height: original.height, files, deepZoom };
}
