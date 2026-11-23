import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const output = resolve('evidence/fixtures');
await mkdir(output, { recursive: true });
const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#4eb29f' } }).jpeg().toBuffer();
const png = await sharp({ create: { width: 800, height: 1200, channels: 4, background: '#6b9fe8' } }).png().toBuffer();
const oriented = await sharp({ create: { width: 400, height: 700, channels: 3, background: '#dc8a78' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
await Promise.all([
  writeFile(resolve(output, 'valid.jpg'), jpeg),
  writeFile(resolve(output, 'valid.png'), png),
  writeFile(resolve(output, 'orientation-6.jpg'), oriented),
  writeFile(resolve(output, 'text-renamed.jpg'), 'safe plain text fixture'),
  writeFile(resolve(output, 'fake-exe.jpeg'), Buffer.from('MZ harmless test fixture; this is not executable')),
  writeFile(resolve(output, 'fake-magic.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from('invalid payload')])),
  writeFile(resolve(output, 'truncated.jpg'), jpeg.subarray(0, jpeg.length - 80)),
  writeFile(resolve(output, 'over-10mib.jpg'), Buffer.alloc(10 * 1024 * 1024 + 1, 0x41)),
]);
console.log(`Safe fixtures written to ${output}`);
