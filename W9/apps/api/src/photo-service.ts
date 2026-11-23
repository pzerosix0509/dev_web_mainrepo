import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { broadcast } from './events.js';
import type { ProcessedImage } from './image-processor.js';
import { deleteObjects, getObject, listPrefix, putObject } from './storage.js';
import { invalidatePhoto } from './cache.js';
import { config } from './config.js';

const variantKind = { THUMB: 'THUMB', MEDIUM: 'MEDIUM', LARGE: 'LARGE', PREVIEW: 'PREVIEW' } as const;

async function compensate(keys: string[], cause: unknown): Promise<void> {
  try {
    await deleteObjects(keys);
  } catch (cleanupError) {
    await prisma.cleanupJob.create({ data: { storageKeys: keys, lastError: `${String(cleanupError)}; original=${String(cause)}` } }).catch(() => undefined);
  }
}

async function uploadProcessed(photoId: string, version: number, processed: ProcessedImage) {
  const uploaded: string[] = [];
  const records: Array<{ kind: 'THUMB' | 'MEDIUM' | 'LARGE' | 'PREVIEW' | 'TILE'; storageKey: string; mimeType: string; width: number; height: number; byteSize: number; checksum: string; tileLevel?: number; tileX?: number; tileY?: number }> = [];
  let originalKey = '';
  let manifestKey: string | null = null;
  try {
    for (const file of processed.files) {
      const key = `photos/${photoId}/v${version}/${file.suffix}`;
      await putObject(key, file.body, file.mimeType);
      uploaded.push(key);
      if (file.kind === 'ORIGINAL') originalKey = key;
      else records.push({
        kind: variantKind[file.kind],
        storageKey: key,
        mimeType: file.mimeType,
        width: file.width,
        height: file.height,
        byteSize: file.byteSize,
        checksum: file.checksum,
      });
    }
    if (processed.deepZoom) {
      manifestKey = `photos/${photoId}/v${version}/manifest.json`;
      await putObject(manifestKey, processed.deepZoom.manifest, 'application/json');
      uploaded.push(manifestKey);
      for (const tile of processed.deepZoom.tiles) {
        const storageKey = `photos/${photoId}/v${version}/tiles/${tile.path}`;
        await putObject(storageKey, tile.body, 'image/webp');
        uploaded.push(storageKey);
        records.push({ kind: 'TILE', storageKey, mimeType: 'image/webp', width: tile.width, height: tile.height, byteSize: tile.body.length, checksum: tile.checksum, tileLevel: tile.level, tileX: tile.x, tileY: tile.y });
      }
    }
    return { uploaded, originalKey, manifestKey, records };
  } catch (error) {
    await deleteObjects(uploaded);
    throw error;
  }
}

export async function createPhoto(originalName: string, processed: ProcessedImage) {
  const photoId = randomUUID();
  const objects = await uploadProcessed(photoId, 1, processed);
  try {
    const photo = await prisma.$transaction(async (tx) => tx.photo.create({
      data: {
        id: photoId,
        originalName,
        status: 'READY',
        detectedMimeType: processed.detectedMimeType,
        width: processed.width,
        height: processed.height,
        altText: 'Ảnh trong thư viện',
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            normalizedOriginalKey: objects.originalKey,
            manifestKey: objects.manifestKey,
            publishedAt: new Date(),
            variants: { create: objects.records },
          },
        },
      },
      include: { versions: { include: { variants: true } } },
    }));
    await invalidatePhoto(photo.id);
    broadcast({ type: 'PHOTO_CREATED', photoId: photo.id });
    return photo;
  } catch (error) {
    await compensate(objects.uploaded, error);
    throw error;
  }
}

export async function publishVersion(photoId: string, expectedVersion: number, processed: ProcessedImage) {
  const nextVersion = expectedVersion + 1;
  const objects = await uploadProcessed(photoId, nextVersion, processed);
  try {
    const version = await prisma.$transaction(async (tx) => {
      const created = await tx.photoVersion.create({
        data: {
          photoId,
          version: nextVersion,
          normalizedOriginalKey: objects.originalKey,
          manifestKey: objects.manifestKey,
          variants: { create: objects.records },
        },
      });
      const updated = await tx.photo.updateMany({
        where: { id: photoId, status: 'READY', currentVersion: expectedVersion },
        data: { currentVersion: nextVersion, width: processed.width, height: processed.height },
      });
      if (updated.count !== 1) throw new Error('VERSION_CONFLICT');
      return tx.photoVersion.update({ where: { id: created.id }, data: { publishedAt: new Date() } });
    });
    await invalidatePhoto(photoId);
    broadcast({ type: 'PHOTO_UPDATED', photoId });
    return version;
  } catch (error) {
    await compensate(objects.uploaded, error);
    throw error;
  }
}

export async function loadOriginal(photoId: string) {
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, status: 'READY' },
    include: { versions: { orderBy: { version: 'asc' }, take: 1 } },
  });
  const original = photo?.versions[0];
  if (!photo || !original) return null;
  const object = await getObject(original.normalizedOriginalKey);
  return { photo, body: Buffer.from(await object.Body!.transformToByteArray()) };
}

export async function deletePhoto(photoId: string): Promise<boolean> {
  const claimed = await prisma.photo.updateMany({ where: { id: photoId, status: 'READY' }, data: { status: 'DELETING', deletedAt: new Date() } });
  if (claimed.count === 0) return false;
  const keys = await listPrefix(`photos/${photoId}/`);
  try {
    await deleteObjects(keys);
    await prisma.photo.update({ where: { id: photoId }, data: { status: 'DELETED' } });
    await invalidatePhoto(photoId);
    broadcast({ type: 'PHOTO_DELETED', photoId });
    return true;
  } catch (error) {
    await prisma.cleanupJob.create({ data: { photoId, storageKeys: keys, lastError: String(error) } });
    throw error;
  }
}

export async function retryCleanupJobs(): Promise<void> {
  const jobs = await prisma.cleanupJob.findMany({ where: { completedAt: null }, take: 20 });
  for (const job of jobs) {
    try {
      await deleteObjects(job.storageKeys);
      await prisma.$transaction([
        prisma.cleanupJob.update({ where: { id: job.id }, data: { completedAt: new Date(), attempts: { increment: 1 } } }),
        ...(job.photoId ? [prisma.photo.update({ where: { id: job.photoId }, data: { status: 'DELETED' } })] : []),
      ] as Prisma.PrismaPromise<unknown>[]);
    } catch (error) {
      await prisma.cleanupJob.update({ where: { id: job.id }, data: { attempts: { increment: 1 }, lastError: String(error) } });
    }
  }
}

export async function cleanupExpiredVersions(): Promise<void> {
  if (config.VERSION_RETENTION_HOURS === 0) return;
  const cutoff = new Date(Date.now() - config.VERSION_RETENTION_HOURS * 60 * 60 * 1000);
  const candidates = await prisma.photoVersion.findMany({
    where: { version: { not: 1 }, publishedAt: { lt: cutoff } },
    include: { variants: true, photo: { select: { currentVersion: true } } },
    take: 50,
  });
  for (const version of candidates.filter((item) => item.version !== item.photo.currentVersion)) {
    const keys = [version.normalizedOriginalKey, ...(version.manifestKey ? [version.manifestKey] : []), ...version.variants.map((item) => item.storageKey)];
    try {
      await deleteObjects(keys);
      await prisma.photoVersion.delete({ where: { id: version.id } });
    } catch {
      // The version row retains every key, so the next scheduled pass can retry safely.
    }
  }
}
