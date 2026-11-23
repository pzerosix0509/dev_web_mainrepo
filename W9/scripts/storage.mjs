import 'dotenv/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET ?? 'photo-gallery';
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:8333',
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'development-only',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'development-only',
  },
});

async function bootstrap() {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Created bucket ${bucket}`);
  } catch (error) {
    const name = error?.name ?? '';
    if (!['BucketAlreadyExists', 'BucketAlreadyOwnedByYou'].includes(name)) throw error;
    console.log(`Bucket ${bucket} already exists`);
  }
}

async function verify() {
  await bootstrap();
  const key = `health/verify-${crypto.randomUUID()}.txt`;
  const body = Buffer.from('SeaweedFS S3 verification');
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain' }));
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (head.ContentLength !== body.length) throw new Error('HEAD returned an unexpected length');
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const read = Buffer.from(await result.Body.transformToByteArray());
    if (!read.equals(body)) throw new Error('GET content mismatch');
    const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'health/' }));
    if (!list.Contents?.some((item) => item.Key === key)) throw new Error('Object was not listed');
    console.log(`PUT/HEAD/GET/LIST passed for s3://${bucket}/${key}`);
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
  console.log('DELETE passed; SeaweedFS S3 Gateway is ready');
}

const command = process.argv[2];
try {
  if (command === 'bootstrap') await bootstrap();
  else if (command === 'verify') await verify();
  else throw new Error('Usage: node scripts/storage.mjs <bootstrap|verify>');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
