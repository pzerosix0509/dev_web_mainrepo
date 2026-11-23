import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cacheGet, cacheSet } from './cache.js';
import { limits } from './config.js';
import { prisma } from './db.js';
import { UploadError } from './errors.js';
import { addEventClient } from './events.js';
import { normalizeDisplayName, processEdit, validateAndProcess } from './image-processor.js';
import { createPhoto, deletePhoto, loadOriginal, publishVersion } from './photo-service.js';
import { serializePhoto } from './serializers.js';
import { getObject, headObject } from './storage.js';

const editSchema = z.object({
  crop: z.object({ x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  flipHorizontal: z.boolean().default(false),
}).strict();

export async function registerRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ ok: true }));

  app.post('/api/photos/upload', async (request, reply) => {
    const results: Array<Record<string, unknown>> = [];
    const directory = await mkdtemp(join(tmpdir(), 'photo-gallery-'));
    let index = 0;
    try {
      const parts = request.parts({ limits: { files: limits.maxFiles + 1, fileSize: limits.maxFileBytes, parts: limits.maxFiles + 20 } });
      for await (const part of parts) {
        if (part.type !== 'file') continue;
        const fileName = normalizeDisplayName(part.filename);
        if (index >= limits.maxFiles) {
          part.file.resume();
          results.push({ index, fileName, status: 'rejected', code: 'TOO_MANY_FILES', message: `Mỗi request chỉ nhận tối đa ${limits.maxFiles} ảnh` });
          index += 1;
          continue;
        }
        const path = join(directory, `${index}.upload`);
        try {
          await pipeline(part.file, createWriteStream(path, { flags: 'wx' }));
          const info = await stat(path);
          if (part.file.truncated || info.size > limits.maxFileBytes) throw new UploadError('FILE_TOO_LARGE', 'File vượt giới hạn 10 MiB');
          const processed = await validateAndProcess(path, fileName, part.mimetype);
          const photo = await createPhoto(fileName, processed);
          results.push({ index, fileName, status: 'accepted', photoId: photo.id });
        } catch (error) {
          const uploadError = error instanceof UploadError ? error : null;
          request.log.warn({ error, fileName }, 'upload rejected');
          results.push({ index, fileName, status: 'rejected', code: uploadError?.code ?? 'PROCESSING_FAILED', message: uploadError?.message ?? 'Không thể xử lý ảnh' });
        }
        index += 1;
      }
      if (index === 0) return reply.code(400).send({ code: 'NO_FILES', message: 'Hãy chọn từ 1 đến 5 ảnh', results: [] });
      return reply.code(results.some((item) => item.status === 'accepted') ? 200 : 422).send({ results });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  app.get('/api/photos', async (request) => {
    const query = z.object({ cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(24) }).parse(request.query);
    const key = `gallery:public:${query.cursor ?? 'first'}:${query.limit}`;
    const cached = await cacheGet<unknown>(key);
    if (cached) return cached;
    const photos = await prisma.photo.findMany({
      where: { status: 'READY' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { versions: { include: { variants: true } } },
    });
    const hasMore = photos.length > query.limit;
    const page = photos.slice(0, query.limit);
    const response = { items: page.map(serializePhoto), nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
    await cacheSet(key, response, 20);
    return response;
  });

  app.get('/api/photos/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const key = `photo:${id}`;
    const cached = await cacheGet<unknown>(key);
    if (cached) return cached;
    const photo = await prisma.photo.findFirst({ where: { id, status: 'READY' }, include: { versions: { include: { variants: true } } } });
    if (!photo) return reply.code(404).send({ code: 'PHOTO_NOT_FOUND' });
    const response = serializePhoto(photo);
    await cacheSet(key, response, 180);
    return response;
  });

  app.delete('/api/photos/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const deleted = await deletePhoto(id);
    if (!deleted) return reply.code(404).send({ code: 'PHOTO_NOT_FOUND' });
    return reply.code(204).send();
  });

  app.post('/api/photos/:id/edits', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const input = editSchema.parse(request.body);
    const source = await loadOriginal(id);
    if (!source) return reply.code(404).send({ code: 'PHOTO_NOT_FOUND' });
    try {
      const processed = await processEdit(source.body, input);
      await publishVersion(id, source.photo.currentVersion, processed);
      return reply.code(202).send({ photoId: id, version: source.photo.currentVersion + 1 });
    } catch (error) {
      if (error instanceof UploadError) return reply.code(400).send({ code: error.code, message: error.message });
      if (error instanceof Error && error.message === 'VERSION_CONFLICT') return reply.code(409).send({ code: 'VERSION_CONFLICT' });
      throw error;
    }
  });

  app.post('/api/photos/:id/restore', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const source = await loadOriginal(id);
    if (!source) return reply.code(404).send({ code: 'PHOTO_NOT_FOUND' });
    const processed = await processEdit(source.body, { rotation: 0, flipHorizontal: false });
    await publishVersion(id, source.photo.currentVersion, processed);
    return reply.code(202).send({ photoId: id, version: source.photo.currentVersion + 1 });
  });

  app.get('/api/events', async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(': connected\n\n');
    const remove = addEventClient(reply);
    const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 20_000);
    request.raw.on('close', () => { clearInterval(heartbeat); remove(); });
  });

  app.route({
    method: ['GET', 'HEAD'],
    url: '/media/*',
    handler: async (request, reply) => {
      const key = (request.params as { '*': string })['*'];
      if (!/^photos\/[0-9a-f-]+\/v\d+\//.test(key) || key.includes('..')) return reply.code(404).send();
      const allowed = await prisma.photoVersion.findFirst({
        where: { OR: [{ normalizedOriginalKey: key }, { manifestKey: key }, { variants: { some: { storageKey: key } } }] },
        select: { id: true },
      });
      if (!allowed) return reply.code(404).send();
      const head = await headObject(key);
      reply.headers({
        'Content-Type': head.ContentType ?? 'application/octet-stream',
        'Content-Length': head.ContentLength,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: head.ETag,
        'X-Content-Type-Options': 'nosniff',
      });
      if (request.headers['if-none-match'] && request.headers['if-none-match'] === head.ETag) return reply.code(304).send();
      if (request.method === 'HEAD') return reply.send();
      const object = await getObject(key);
      return reply.send(object.Body);
    },
  });
}
