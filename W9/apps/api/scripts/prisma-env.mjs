import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '../../../.env');
const loaded = loadEnv({ path: envPath });

if (loaded.error) {
  console.error(`Cannot load ${envPath}. Copy .env.example to .env first.`);
  process.exit(1);
}

const prismaEntry = fileURLToPath(import.meta.resolve('prisma/build/index.js'));
const child = spawn(process.execPath, [prismaEntry, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
