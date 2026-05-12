/**
 * Database Connection Health Check
 * Helps diagnose and fix "too many connections" issues
 */

import { prisma } from './prisma';
import { logger } from './logger';

export async function checkDatabaseConnections(): Promise<{
  healthy: boolean;
  connectionCount?: number;
  error?: string;
}> {
  try {
    // Check current connection count
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    
    const connectionCount = Number(result[0]?.count || 0);
    
    return {
      healthy: true,
      connectionCount
    };
  } catch (error) {
    logger.error('Database connection check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function killIdleConnections(maxIdleMinutes: number = 30): Promise<number> {
  try {
    // Kill connections that have been idle for more than maxIdleMinutes
    const result = await prisma.$executeRaw`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND state = 'idle'
        AND state_change < NOW() - INTERVAL '${maxIdleMinutes} minutes'
        AND pid <> pg_backend_pid()
    `;
    
    return Number(result) || 0;
  } catch (error) {
    logger.error('Failed to kill idle connections', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
}

