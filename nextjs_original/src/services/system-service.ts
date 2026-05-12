import { prisma } from '@/lib/database';
import { businessRules } from '@/lib/business-rules';
import { getActiveComplianceDocuments } from './compliance-service';

export async function generateCompensationPlanDoc(companyName: string): Promise<string> {
  try {
    const [allMembers, allCommissions, allOrders] = await Promise.all([
      prisma.user.findMany(),
      prisma.commission.findMany(),
      prisma.order.findMany()
    ]);

    const totalMembers = allMembers.length;
    const activeMembers = allMembers.filter(m => m.active).length;
    const totalCommissionPaid = allCommissions.reduce((sum, commission) => sum + commission.amount, 0);
    const totalOrders = allOrders.length;
    const totalRevenue = allOrders
      .filter(order => order.status === 'Fulfilled')
      .reduce((sum, order) => sum + order.amount, 0);

  let doc = `# ${companyName} Compensation Plan\n\n`;
  doc += `_Generated on: ${new Date().toUTCString()}_\n\n`;

  doc += `## Executive Summary\n`;
  doc += `This document outlines the official compensation plan for ${companyName} distributors. It includes details on earning commissions, rank advancement, and business rules.\n\n`;

  doc += `### Current Network Statistics\n`;
  doc += `- **Total Members:** ${totalMembers}\n`;
  doc += `- **Active Distributors:** ${activeMembers}\n`;
  doc += `- **Total Revenue (Fulfilled):** $${totalRevenue.toFixed(2)}\n`;
  doc += `- **Total Commissions Paid:** $${totalCommissionPaid.toFixed(2)}\n`;
  doc += `- **Total Orders:** ${totalOrders}\n\n`;

  doc += `## 1. Commission Structure\n\n`;

  doc += `### 1.1 Binary Commission\n`;
  doc += `- **Rate:** ${businessRules.binaryCommissionRate * 100}%\n`;
  doc += `- **Calculation:** Based on the Personal Volume (PV) of the weaker leg.\n`;
  doc += `- **Eligibility:** Must have a minimum of ${businessRules.minPVForCommission} Personal PV.\n\n`;

  doc += `### 1.2 Commission Caps (per cycle)\n`;
  doc += `| Rank | Max Binary Commission |\n`;
  doc += `| :--- | :--- |\n`;
  // Use ranks array to maintain order from lib/types
  const { ranks } = await import('@/lib/types');
  for (const rank of ranks) {
    if (businessRules.commissionCaps[rank] !== undefined) {
      doc += `| ${rank} | $${businessRules.commissionCaps[rank].toLocaleString()} |\n`;
    }
  }
  doc += `\n`;

  doc += `### 1.3 Stockist Bonus\n`;
  doc += `| Level | Bonus Rate |\n`;
  doc += `| :--- | :--- |\n`;
  for (const level in businessRules.stockistBonusRates) {
    doc += `| ${level} | ${businessRules.stockistBonusRates[level as keyof typeof businessRules.stockistBonusRates] * 100}% of Personal PV |\n`;
  }
  doc += `\n`;

  doc += `### 1.4 Matching Bonus\n`;
  doc += `- **Levels:** Up to ${businessRules.matchingBonusLevels} levels deep.\n`;
  doc += `- **Base Rate:** ${businessRules.matchingBonusBaseRate * 100}% of sponsored member's binary commission, divided by the level.\n`;
  doc += `  - Level 1: ${(businessRules.matchingBonusBaseRate / 1 * 100).toFixed(2)}%\n`;
  doc += `  - Level 2: ${(businessRules.matchingBonusBaseRate / 2 * 100).toFixed(2)}%\n`;
  doc += `  - Level 3: ${(businessRules.matchingBonusBaseRate / 3 * 100).toFixed(2)}%\n`;
  doc += `  ...and so on.\n\n`;

  doc += `## 2. Rank Advancement\n\n`;
  doc += `| Rank | Personal PV | Group PV | Direct Recruits | One-Time Bonus |\n`;
  doc += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const req of businessRules.rankRequirements) {
    doc += `| **${req.rank}** | ${req.personalPV.toLocaleString()} | ${req.groupPV.toLocaleString()} | ${req.directRecruits} | $${req.bonus.toLocaleString()} |\n`;
  }
  doc += `\n`;

  doc += `## 3. Important Business Rules\n\n`;
  doc += `- **Tree Compression:** Members who are inactive for **${businessRules.inactivityPeriodForCompression} days** (zero PV and no new recruits) may be bypassed in the tree structure.\n\n`;

  doc += `## 4. Compliance\n\n`;
  const complianceDocuments = await getActiveComplianceDocuments();
  complianceDocuments.forEach((document, index) => {
      doc += `### 4.${index + 1} ${document.title} (v${document.version})\n`;
      const contentPreview = document.content?.split('\n')[2]?.trim() || 'Compliance document';
      doc += `> ${contentPreview}\n\n`; // Add a summary line
  });

  return doc;
  } catch (error) {
    // Check if this is a Prisma browser error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes('PrismaClient is unable to run in this browser environment');
    
    if (isPrismaBrowserError) {
      console.error('Failed to generate compensation plan document:', 'Not found');
    } else {
      console.error('Failed to generate compensation plan document:', error);
    }
    throw error;
  }
}

// Health check function for load balancer
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }