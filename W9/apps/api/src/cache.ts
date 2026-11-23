import { Redis } from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on('error', () => undefined);

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (redis.status === 'wait') await redis.connect();
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Redis is an acceleration layer; PostgreSQL remains authoritative.
  }
}

export async function invalidatePhoto(photoId: string): Promise<void> {
  try {
    const stream = redis.scanStream({ match: 'gallery:public:*', count: 100 });
    const keys: string[] = [`photo:${photoId}`];
    for await (const chunk of stream) keys.push(...(chunk as string[]));
    if (keys.length) await redis.del(...keys);
  } catch {
    // A short TTL and SSE invalidation make cache loss safe.
  }
}
