import { PrismaClient } from '@prisma/client';

class GenealogyDatabaseConnection {
  private static instance: GenealogyDatabaseConnection;
  private prisma: PrismaClient;

  private constructor() {
    const databaseUrl = process.env.GENEALOGY_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('Database URL not configured');
    }
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Graceful shutdown handling
    process.on('beforeExit', async () => {
      await this.prisma.$disconnect();
    });
  }

  public static getInstance(): GenealogyDatabaseConnection {
    if (!GenealogyDatabaseConnection.instance) {
      GenealogyDatabaseConnection.instance = new GenealogyDatabaseConnection();
    }
    return GenealogyDatabaseConnection.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Genealogy database health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const genealogyDb = GenealogyDatabaseConnection.getInstance().getClient();
export const genealogyDatabaseConnection = GenealogyDatabaseConnection.getInstance();