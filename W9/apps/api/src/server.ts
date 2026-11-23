import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { cleanupExpiredVersions, retryCleanupJobs } from './photo-service.js';
import { ensureBucket } from './storage.js';

const app = await buildApp();

async function start() {
  await prisma.$connect();
  await ensureBucket();
  await retryCleanupJobs();
  await cleanupExpiredVersions();
  setInterval(() => void cleanupExpiredVersions(), 60 * 60 * 1000).unref();
  await app.listen({ host: '0.0.0.0', port: config.API_PORT });
}

async function shutdown() {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
