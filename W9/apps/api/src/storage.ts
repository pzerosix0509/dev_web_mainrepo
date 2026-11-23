import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { config } from './config.js';

export const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY },
});

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET }));
  }
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<string | undefined> {
  const result = await s3.send(new PutObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return result.ETag?.replaceAll('"', '');
}

export async function getObject(key: string) {
  return s3.send(new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
}

export async function headObject(key: string) {
  return s3.send(new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const results = await Promise.allSettled(keys.map((key) => s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }))));
  const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
  if (failures.length) throw new AggregateError(failures, `Failed to delete ${failures.length} object(s)`);
}

export async function listPrefix(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: config.S3_BUCKET, Prefix: prefix, ContinuationToken: continuationToken }));
    keys.push(...(page.Contents?.flatMap((item) => item.Key ? [item.Key] : []) ?? []));
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);
  return keys;
}
