import { Rank } from './rank';

/**
 * Get the required maintenance topup amount (in PV) for a given rank
 * Based on business rules:
 * - Bronze, Silver, Gold, Diamond: 20 PV per month
 * - Manager, Director, President, Double President: 40 PV per month
 */
export function getMaintenanceTopupAmount(rank: Rank | string | null | undefined): number {
  if (!rank) return 20; // Default to 20 PV for Member or unknown ranks
  
  const normalizedRank = rank.toString().trim();
  
  // Manager and above: 40 PV
  if (
    normalizedRank === 'Manager' ||
    normalizedRank === 'Director' ||
    normalizedRank === 'President' ||
    normalizedRank === 'Double President'
  ) {
    return 40;
  }
  
  // Bronze, Silver, Gold, Diamond: 20 PV
  // Also default to 20 PV for Member or any other rank
  return 20;
}

/**
 * Check if a user has paid maintenance for the current month
 * @param userId - User ID to check
 * @param month - Month in YYYY-MM format (optional, defaults to current month)
 * @returns true if user has approved/completed maintenance topup for the month
 */
export async function hasMaintenancePaid(
  userId: string,
  month?: string
): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma');
  
  const currentMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM format
  
  // First check for maintenance in the specified month
  const approvedMaintenance = await (prisma as any).maintenanceTopupRequest.findFirst({
    where: {
      memberId: userId,
      month: currentMonth,
      status: { in: ['approved', 'completed'] },
    },
  });
  
  if (approvedMaintenance) {
    return true;
  }
  
  // Also check if there's a completed maintenance with processedDate that covers the current date (31-day grace period)
  // This handles the case where maintenance was created for a different month but still valid
  const validMaintenance = await (prisma as any).maintenanceTopupRequest.findFirst({
    where: {
      memberId: userId,
      status: 'completed',
      processedDate: { not: null },
    },
    orderBy: {
      processedDate: 'desc',
    },
  });
  
  if (validMaintenance && validMaintenance.processedDate) {
    const processedDate = new Date(validMaintenance.processedDate);
    processedDate.setHours(0, 0, 0, 0);
    
    const expiryDate = new Date(processedDate);
    expiryDate.setDate(expiryDate.getDate() + 31);
    expiryDate.setHours(23, 59, 59, 999);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if today is within the 31-day period
    if (today >= processedDate && today <= expiryDate) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create automatic 31-day maintenance for new members
 * This gives new members "green maintenance" status for 31 days from registration
 * @param userId - User ID of the new member
 * @param memberName - Full name of the member
 * @param rank - Member's rank (for calculating required amount)
 * @param registrationDate - Date when member was registered (defaults to now)
 */
export async function createNewMemberMaintenance(
  userId: string,
  memberName: string,
  rank: string | null = 'Member',
  registrationDate: Date = new Date()
): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  
  try {
    // Get required maintenance amount based on rank
    const requiredAmount = getMaintenanceTopupAmount(rank);
    
    // Set processed date to start of registration day for accurate 31-day calculation
    const processedDate = new Date(registrationDate);
    processedDate.setHours(0, 0, 0, 0);
    
    // Get the month of registration (YYYY-MM format)
    const registrationMonth = registrationDate.toISOString().slice(0, 7);
    
    // Check if maintenance already exists for this member
    const existingMaintenance = await (prisma as any).maintenanceTopupRequest.findFirst({
      where: {
        memberId: userId,
        status: 'completed',
        processedDate: { not: null },
      },
    });
    
    // Only create if no existing completed maintenance
    if (!existingMaintenance) {
      await (prisma as any).maintenanceTopupRequest.create({
        data: {
          memberId: userId,
          memberName: memberName,
          amount: requiredAmount,
          remark: 'Automatic 31-day maintenance for new member registration',
          proofUrl: '',
          month: registrationMonth,
          status: 'completed',
          processedBy: userId, // Self-processed (automatic)
          processedDate: processedDate,
          createdDate: new Date(),
        },
      });
      
      console.log(`✅ Created automatic 31-day maintenance for new member ${userId} (${memberName})`);
    }
  } catch (error) {
    console.error(`Failed to create automatic maintenance for new member ${userId}:`, error);
    // Don't throw - maintenance creation failure shouldn't block registration
  }
}

