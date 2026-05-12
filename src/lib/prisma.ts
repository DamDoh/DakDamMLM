import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from './prisma-soft-delete';

// Use a global singleton in development to avoid exhausting DB connections
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

// Create Prisma client with soft delete extension
function createPrismaClient() {
  return new PrismaClient({
    // You can optionally tune pool size here if needed, e.g.:
    // log: ['warn', 'error'],
  }).$extends(softDeleteExtension);
}

// Reuse existing PrismaClient in dev, create a new one in production or first load
const basePrisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

// Export the configured Prisma client
export const prisma = basePrisma;
// Also export basePrisma for cases where direct access is needed (e.g., Language model)
export { basePrisma };