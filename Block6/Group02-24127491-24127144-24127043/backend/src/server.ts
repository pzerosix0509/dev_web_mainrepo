import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

const server = app.listen(env.port, () => console.log(`Restaurant API listening on http://localhost:${env.port}`));
const shutdown = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
