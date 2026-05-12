// Shared utility functions used across services
import type { Member } from '@/lib/types';

// Helper function to transform Prisma User to Member type
export function transformUserToMember(user: any): Member {
  return {
    ...user,
    accountType: user.accountType || 'Distributor', // Default to Distributor for MLM system
    joinDate: user.joinDate || user.createdAt?.toISOString() || new Date().toISOString(), // Use createdAt or current date
  };
}

// Decimal precision helper (consistent across services)
export function roundToDecimal(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Audit logging helper
export async function logCalculationAudit(audit: {
  memberId: string;
  calculationType: string;
  cycleId: string;
  inputs: Record<string, any>;
  result: number;
  duration: number;
}): Promise<void> {
  // In production, this would be stored in a proper logging/audit system
  // For now, we'll keep it silent to avoid console clutter
  // console.log(`Audit [${audit.calculationType}]: Member ${audit.memberId}, Result: $${audit.result}, Duration: ${audit.duration}ms`);
}