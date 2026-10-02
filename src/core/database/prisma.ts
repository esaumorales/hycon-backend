import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { env } from '../config/env';

// Prevent multiple instances of Prisma Client in development
declare global {
  var prisma: PrismaClient | undefined;
}

const connectionString = env.DATABASE_URL;

// Conexiones del pool. Postgres admite 100 por defecto y aqui solo corre esta API:
// 10 sobran y evitan que una rafaga de peticiones deje sin conexion a la siguiente.
const pool = new Pool({
  connectionString,
  max: 10,
  // Una conexion parada se devuelve al sistema en lugar de quedarse ocupada
  idleTimeoutMillis: 30_000,
  // Si la base no responde en este tiempo, mejor fallar claro que esperar indefinidamente
  connectionTimeoutMillis: 10_000,
});

const adapter = new PrismaPg(pool);

export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter,
    transactionOptions: {
      // Espera por una conexion libre antes de rendirse (el error P2028 salia a los 2 s)
      maxWait: 10_000,
      // Techo de duracion de la transaccion en si
      timeout: 15_000,
    },
  });

if (env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
