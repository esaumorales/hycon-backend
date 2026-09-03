import { PrismaClient } from '../../generated/prisma/client';

// Prevent multiple instances of Prisma Client in development
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new (PrismaClient as any)();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
