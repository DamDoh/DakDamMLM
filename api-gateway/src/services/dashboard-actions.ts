'use server';

// NOTE: financial-service and some compliance helpers are not fully implemented in this codebase.
// We provide safe fallbacks here so the admin dashboard can render without crashing.
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

/**
 * Server actions for client components
 * These functions use Prisma and must be server-only
 *
 * This file has 'use server' at the top to prevent Prisma from being bundled for the browser
 */

export async function getPendingFinancialControls(companyId?: string): Promise<any[]> {
  try {
    // TODO: Implement real financial controls once financial-service is available.
    logger.info('getPendingFinancialControls called (stub implementation)', { companyId });
    return [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Dashboard action: Failed to get pending financial controls', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      companyId,
    });
    return [];
  }
}

export async function getActiveComplianceDocuments(type?: any, companyId?: string): Promise<any[]> {
  try {
    // TODO: Implement real compliance documents query once compliance-service is fully available.
    logger.info('getActiveComplianceDocuments called (stub implementation)', { type, companyId });
    return [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Dashboard action: Failed to get active compliance documents', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      type,
      companyId,
    });
    return [];
  }
}

export async function getAllMemberAgreements(companyId?: string, memberId?: string): Promise<any[]> {
  try {
    // Simple Prisma-based implementation for member agreements
    const where: any = {};
    if (memberId) where.memberId = memberId;
    if (companyId) where.companyId = companyId;

    const agreements = await prisma.memberAgreement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return agreements;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes(
      'PrismaClient is unable to run in this browser environment'
    );

    if (isPrismaBrowserError) {
      logger.error('Failed to get all member agreements', {
        error: 'Not found',
      });
    } else {
      logger.error('Dashboard action: Failed to get all member agreements', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        companyId,
        memberId,
      });
    }
    return [];
  }
}

export async function runCommissionCycle(): Promise<{ count: number; total: number }> {
  try {
    // Full commission cycle engine not wired yet; return safe placeholder
    return { count: 0, total: 0 };
  } catch (error) {
    logger.error('Server action: Failed to run commission cycle', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { count: 0, total: 0 };
  }
}

export async function generateCompensationPlanDoc(companyName: string): Promise<string> {
  try {
    // TODO: Replace with real system-service implementation when available.
    const generatedAt = new Date().toUTCString();
    return `# ${companyName} Compensation Plan\n\n_Generated on: ${generatedAt}_\n\n> Detailed compensation plan generation is not yet implemented. This is a placeholder document.`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes(
      'PrismaClient is unable to run in this browser environment'
    );

    if (isPrismaBrowserError) {
      logger.error('Failed to generate compensation plan document', {
        error: 'Not found',
      });
      return `# ${companyName} Compensation Plan\n\n_Generated on: ${new Date().toUTCString()}_\n\n## Error\n\nUnable to generate document at this time. Please try again later.`;
    } else {
      logger.error('Dashboard action: Failed to generate compensation plan document', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        companyName,
      });
      throw error;
    }
  }
}


