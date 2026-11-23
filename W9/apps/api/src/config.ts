import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(moduleDirectory, '../../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://gallery:gallery@localhost:5432/gallery?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  S3_ENDPOINT: z.string().url().default('http://localhost:8333'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('photo-gallery'),
  S3_ACCESS_KEY_ID: z.string().default('development-only'),
  S3_SECRET_ACCESS_KEY: z.string().default('development-only'),
  S3_FORCE_PATH_STYLE: z.string().default('true').transform((value) => value === 'true'),
  MAX_FILES: z.coerce.number().int().min(1).max(20).default(5),
  MAX_FILE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MAX_REQUEST_BYTES: z.coerce.number().int().positive().default(55 * 1024 * 1024),
  MAX_DIMENSION: z.coerce.number().int().positive().default(8000),
  MAX_PIXELS: z.coerce.number().int().positive().default(25_000_000),
  IMAGE_PROCESSING_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  IMAGE_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  ENABLE_WEBP_UPLOAD: z.string().default('true').transform((value) => value === 'true'),
  ENABLE_DEEP_ZOOM: z.string().default('true').transform((value) => value === 'true'),
  DEEP_ZOOM_MIN_PIXELS: z.coerce.number().int().positive().default(12_000_000),
  VERSION_RETENTION_HOURS: z.coerce.number().int().nonnegative().default(24),
});

export const config = schema.parse(process.env);
export const limits = {
  maxFiles: config.MAX_FILES,
  maxFileBytes: config.MAX_FILE_BYTES,
  maxRequestBytes: config.MAX_REQUEST_BYTES,
  maxDimension: config.MAX_DIMENSION,
  maxPixels: config.MAX_PIXELS,
} as const;
