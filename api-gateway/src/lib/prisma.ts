import { PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from './prisma-soft-delete';

// Use a global singleton in development to avoid exhausting DB connections
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Reuse existing PrismaClient in dev, create a new one in production or first load
const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // You can optionally tune pool size here if needed, e.g.:
    // log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

// Apply soft delete middleware using $extends (Prisma v5+)
export const prisma = basePrisma.$extends({
  query: {
    $allModels: softDeleteMiddleware,
  },
});