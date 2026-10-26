import 'dotenv/config';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port <= 0) throw new Error('PORT must be a positive integer');
export const env = {
  port,
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
};
