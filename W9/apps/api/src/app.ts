import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { config, limits } from './config.js';
import { registerRoutes } from './routes.js';

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: limits.maxRequestBytes, requestTimeout: 65_000 });
  await app.register(cors, { origin: config.WEB_ORIGIN, methods: ['GET', 'HEAD', 'POST', 'DELETE'] });
  await app.register(multipart, {
    limits: { files: limits.maxFiles + 1, fileSize: limits.maxFileBytes, parts: limits.maxFiles + 20 },
    throwFileSizeLimit: false,
  });
  await registerRoutes(app);
  app.setErrorHandler((error, _request, reply) => {
    const caught = error as { validation?: unknown; name?: string; code?: string };
    if (caught.validation || caught.name === 'ZodError') return reply.code(400).send({ code: 'INVALID_REQUEST', message: 'Dữ liệu gửi lên không hợp lệ' });
    if ((error as { code?: string }).code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send({ code: 'REQUEST_TOO_LARGE', message: 'Multipart request vượt khoảng 55 MiB' });
    app.log.error(error);
    return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Có lỗi máy chủ, vui lòng thử lại' });
  });
  return app;
}
