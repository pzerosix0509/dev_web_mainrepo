const { PrismaClient } = require('@prisma/client');

// Khởi tạo Prisma Client duy nhất
const prisma = new PrismaClient();

module.exports = prisma;
