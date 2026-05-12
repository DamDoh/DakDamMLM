'use server';

import * as financialService from './financial-service';
import * as complianceService from './compliance-service';
import * as commissionService from './commission-service';
import * as systemService from './system-service';
import { logger } from '@/lib/logger';

/**
 * Server actions for client components
 * These functions use Prisma and must be server-only
 * 
 * This file has 'use server' at the top to prevent Prisma from being bundled for the browser
 */

export async function getPendingFinancialControls(companyId?: string): Promise<any[]> {
  try {
    return await financialService.getPendingFinancialControls(companyId);
  } catch (error) {
    // Check if this is a Prisma browser error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes('PrismaClient is unable to run in this browser environment');
    
    if (isPrismaBrowserError) {
      logger.error('Failed to get pending financial controls', {
        error: 'Not found'
      });
    } else {
      logger.error('Dashboard action: Failed to get pending financial controls', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        companyId
      });
    }
    // Return empty array instead of throwing to prevent page crash
    return [];
  }
}

export async function getActiveComplianceDocuments(type?: any, companyId?: string): Promise<any[]> {
  try {
    return await complianceService.getActiveComplianceDocuments(type, companyId);
  } catch (error) {
    // Check if this is a Prisma browser error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes('PrismaClient is unable to run in this browser environment');
    
    if (isPrismaBrowserError) {
      logger.error('Failed to get active compliance documents', {
        error: 'Not found'
      });
    } else {
      logger.error('Dashboard action: Failed to get active compliance documents', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        type,
        companyId
      });
    }
    // Return empty array instead of throwing to prevent page crash
    return [];
  }
}

export async function getAllMemberAgreements(companyId?: string, memberId?: string): Promise<any[]> {
  try {
    return await complianceService.getAllMemberAgreements(companyId, memberId);
  } catch (error) {
    // Check if this is a Prisma browser error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes('PrismaClient is unable to run in this browser environment');
    
    if (isPrismaBrowserError) {
      logger.error('Failed to get all member agreements', {
        error: 'Not found'
      });
    } else {
      logger.error('Dashboard action: Failed to get all member agreements', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        companyId,
        memberId
      });
    }
    // Return empty array instead of throwing to prevent page crash
    return [];
  }
}

export async function runCommissionCycle(): Promise<{ count: number; total: number }> {
  try {
    return await commissionService.runCommissionCycle();
  } catch (error) {
    logger.error('Server action: Failed to run commission cycle', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    // Return empty result instead of throwing to prevent page crash
    return { count: 0, total: 0 };
  }
}

export async function generateCompensationPlanDoc(companyName: string): Promise<string> {
  try {
    return await systemService.generateCompensationPlanDoc(companyName);
  } catch (error) {
    // Check if this is a Prisma browser error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes('PrismaClient is unable to run in this browser environment');
    
    if (isPrismaBrowserError) {
      logger.error('Failed to generate compensation plan document', {
        error: 'Not found'
      });
      // Return a basic document structure instead of throwing
      return `# ${companyName} Compensation Plan\n\n_Generated on: ${new Date().toUTCString()}_\n\n## Error\n\nUnable to generate document at this time. Please try again later.`;
    } else {
      logger.error('Dashboard action: Failed to generate compensation plan document', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        companyName
      });
      throw error;
    }
  }
}

