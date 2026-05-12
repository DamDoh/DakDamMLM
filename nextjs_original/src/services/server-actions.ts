import type { Product, Rank, StockRequestItem, StockistLevel, Address } from '@/lib/types';
import { prisma } from '@/lib/database';
import { businessRules } from '@/lib/business-rules';
import { hashPassword } from '@/lib/auth-service';  
import * as inventoryService from './inventory-service';
import * as disputeService from './commission-dispute-service';
import * as financialService from './financial-service';
import * as complianceService from './compliance-service';

// Re-exports from service modules for backward compatibility
export {
  // Notification service functions
  createNotification,
  sendNotification,
  getNotificationPreferences,
  triggerWelcomeNotification,
  triggerCommissionNotification,
  triggerTeamMemberNotification,
  triggerRankAdvancementNotification,
  triggerStockistOrderNotification,
  triggerStockRequestNotification,
  triggerEcashTopupRequestNotification,
  type NotificationTemplate,
  type Notification,
  type NotificationPreferences
} from './notification-service';

export {
  // Genealogy service functions
  getGroupPV,
  calculateGroupPV,
  updateRank,
  getLegVolume,
  compressTree
} from './genealogy-service';

export {
  // Commission service functions
  calculateBinaryBonus,
  calculateStockistBonus,
  calculateMatchingBonus,
  addCommission,
  runCommissionCycle
} from './commission-service';

export {
  // Onboarding service functions
  initializeMemberOnboarding,
  getOnboardingTemplate,
  getMemberProgress,
  completeOnboardingStep
} from './onboarding-service';

export {
  // Order service functions
  addOrder,
  updateMemberOnServer,
  transferECash
} from './order-service';

export {
  // System service functions
  generateCompensationPlanDoc,
  healthCheck
} from './system-service';

export {
  // User service functions
  getAllMembers,
  addMemberToDb,
  findFirstAvailablePosition,
  setUserAsAdmin
} from './user-service';

export {
  // Analytics service functions
  predictMemberCommission
} from './analytics-service';

// Financial and compliance functions - now fully implemented
export async function getPendingFinancialControls(companyId?: string): Promise<any[]> {
  return financialService.getPendingFinancialControls(companyId);
}

export async function getActiveComplianceDocuments(type?: any, companyId?: string): Promise<any[]> {
  return complianceService.getActiveComplianceDocuments(type, companyId);
}

export async function getMemberAgreements(memberId: string, companyId?: string): Promise<any[]> {
  return complianceService.getMemberAgreements(memberId, companyId);
}

export async function getAllMemberAgreements(companyId?: string, memberId?: string): Promise<any[]> {
  return complianceService.getAllMemberAgreements(companyId, memberId);
}

export async function deleteMember(memberId: string): Promise<void> {
  try {
    // Soft delete by setting deleted flag and date
    await prisma.user.update({
      where: { id: memberId },
      data: {
        deleted: true,
        deletedDate: new Date(),
        deletedBy: memberId, // Could be improved to track who deleted
        active: false,
        updatedAt: new Date()
      }
    });
    // revalidatePath('/admin/user-management'); // Temporarily disabled due to Next.js App Router compatibility
  } catch (error) {
    console.error('Failed to delete member:', error);
    throw error;
  }
}

export async function changeUserPassword(userId: string, newPassword: string): Promise<void> {
  try {
    // Hash the new password before storing
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to change user password:', error);
    throw error;
  }
}

export async function checkProfileConflicts(memberId: string, updates: { phoneNumber?: string; email?: string }): Promise<{ phoneConflict?: boolean; emailConflict?: boolean }> {
  try {
    const conflicts: { phoneConflict?: boolean; emailConflict?: boolean } = {};

    // Check phone number conflicts
    if (updates.phoneNumber) {
      const phoneConflict = await prisma.user.findFirst({
        where: {
          phoneNumber: updates.phoneNumber,
          id: { not: memberId },
          deleted: false
        }
      });
      conflicts.phoneConflict = !!phoneConflict;
    }

    // Check email conflicts
    if (updates.email) {
      const emailConflict = await prisma.user.findFirst({
        where: {
          email: updates.email,
          id: { not: memberId },
          deleted: false
        }
      });
      conflicts.emailConflict = !!emailConflict;
    }

    return conflicts;
  } catch (error) {
    console.error('Failed to check profile conflicts:', error);
    throw error;
  }
}

export async function deleteMemberAddress(memberId: string, addressId: string): Promise<void> {
  try {
    // Find the user and update their addresses array
    const user = await prisma.user.findUnique({
      where: { id: memberId },
      select: { addresses: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentAddresses: Address[] = (user.addresses as any) || [];
    const updatedAddresses = currentAddresses.filter((addr: Address) => addr.id !== addressId);

    await prisma.user.update({
      where: { id: memberId },
      data: {
        addresses: updatedAddresses as any,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to delete member address:', error);
    throw error;
  }
}

export async function setDefaultMemberAddress(memberId: string, addressId: string): Promise<void> {
  try {
    // Find the user and update their addresses array
    const user = await prisma.user.findUnique({
      where: { id: memberId },
      select: { addresses: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentAddresses: Address[] = (user.addresses as any) || [];
    const updatedAddresses = currentAddresses.map((addr: Address) => ({
      ...addr,
      isDefault: addr.id === addressId
    }));

    await prisma.user.update({
      where: { id: memberId },
      data: {
        addresses: updatedAddresses as any,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to set default member address:', error);
    throw error;
  }
}

export async function updateMemberAddress(memberId: string, address: Address): Promise<Address> {
  try {
    // Find the user and update their addresses array
    const user = await prisma.user.findUnique({
      where: { id: memberId },
      select: { addresses: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentAddresses: Address[] = (user.addresses as any) || [];
    let updatedAddress: Address;

    if (address.id) {
      // Update existing address
      const updatedAddresses = currentAddresses.map((addr: Address) =>
        addr.id === address.id ? { ...addr, ...address } : addr
      );
      updatedAddress = updatedAddresses.find(addr => addr.id === address.id)!;

      await prisma.user.update({
        where: { id: memberId },
        data: {
          addresses: updatedAddresses as any,
          updatedAt: new Date()
        }
      });
    } else {
      // Add new address
      const newAddress = { ...address, id: `addr_${Date.now()}` };
      const updatedAddresses = [...currentAddresses, newAddress];
      updatedAddress = newAddress;

      await prisma.user.update({
        where: { id: memberId },
        data: {
          addresses: updatedAddresses as any,
          updatedAt: new Date()
        }
      });
    }

    return updatedAddress;
  } catch (error) {
    console.error('Failed to update member address:', error);
    throw error;
  }
}

export async function approveStockRequest(requestId: string, processedBy?: string): Promise<void> {
  try {
    // Get stock request with items
    const stockRequest = await prisma.stockRequest.findUnique({
      where: { id: requestId },
      include: { items: true }
    });

    if (!stockRequest) {
      throw new Error('Stock request not found');
    }

    // Update stock levels for each requested item
    for (const item of stockRequest.items) {
      await inventoryService.updateStockLevels(
        item.productId,
        item.approvedQuantity || item.requestedQuantity,
        'subtract', // Subtract from main inventory when approved for stockist
        requestId,
        stockRequest.stockistId,
        `Stock request approved for ${stockRequest.stockistName}`,
        undefined
      );
    }

    // Update stock request status to approved
    await prisma.stockRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        processedDate: new Date(),
        processedBy
      }
    });

    console.log(`Stock request ${requestId} approved and inventory updated`);
    
    // Trigger notification to stockist
    // await triggerStockRequestApprovalNotification(stockRequest);

  } catch (error) {
    console.error('Failed to approve stock request:', error);
    throw error;
  }
}

export async function rejectStockRequest(requestId: string): Promise<void> {
  try {
    // Update stock request status to rejected
    await prisma.stockRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected'
      }
    });

    // revalidatePath('/admin/stock-management'); // Temporarily disabled due to Next.js App Router compatibility
  } catch (error) {
    console.error('Failed to reject stock request:', error);
    throw error;
  }
}

export async function transferStock(fromUserId: string, toUserId: string, items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>): Promise<void> {
  try {
    // Use inventory service to handle stock transfer with audit trail
    const transferItems = items;

    const result = await inventoryService.transferStock(
      fromUserId,
      toUserId,
      transferItems
    );

    if (!result.success) {
      throw new Error('Stock transfer failed');
    }

    console.log(`Stock transfer completed: ${fromUserId} -> ${toUserId}, Transfer ID: ${result.transferId}`);
  } catch (error) {
    console.error('Failed to transfer stock:', error);
    throw error;
  }
}

export async function createCommissionDispute(dispute: { id?: string; commissionId: string; memberId: string; amount?: number; reason: string; description?: string; companyId?: string }): Promise<void> {
  try {
    // Use proper dispute service (replaces notification table workaround)
    await disputeService.createCommissionDispute({
      commissionId: dispute.commissionId,
      memberId: dispute.memberId,
      amount: dispute.amount,
      reason: dispute.reason,
      description: dispute.description,
      companyId: dispute.companyId
    });

    // Trigger admin notification
    // await triggerCommissionDisputeNotification(dispute);
  } catch (error) {
    console.error('Failed to create commission dispute:', error);
    throw error;
  }
}

export async function resolveCommissionDispute(disputeId: string, resolution: string, resolvedBy: string): Promise<void> {
  try {
    // Use proper dispute service
    await disputeService.resolveCommissionDispute({
      disputeId,
      resolution,
      resolvedBy
    });
  } catch (error) {
    console.error('Failed to resolve commission dispute:', error);
    throw error;
  }
}

export async function getCommissionDisputes(memberId?: string, companyId?: string, status?: any): Promise<any[]> {
  try {
    // Use proper dispute service
    return await disputeService.getCommissionDisputes(memberId, companyId, status);
  } catch (error) {
    console.error('Failed to get commission disputes:', error);
    return [];
  }
}

export async function verifyCommissionCalculation(commissionId: string): Promise<{
  valid: boolean;
  details?: {
    stored: number;
    calculated: number;
    difference: number;
    type: string;
  };
  error?: string;
}> {
  try {
    // Get the commission record
    const commission = await prisma.commission.findUnique({
      where: { id: commissionId },
      include: {
        // Would need to include related data for recalculation
      }
    });

    if (!commission) {
      return {
        valid: false,
        error: 'Commission not found'
      };
    }

    // Basic validation
    const basicValidation = commission.amount > 0 && !!commission.userId && !!commission.type;
    
    if (!basicValidation) {
      return {
        valid: false,
        error: 'Invalid commission data'
      };
    }

    // Enhanced verification: Check against business rules caps
    const user = await prisma.user.findUnique({
      where: { id: commission.userId },
      select: { rank: true, id: true }
    });

    if (!user) {
      return {
        valid: false,
        error: 'User not found'
      };
    }

    // Check if commission respects rank cap
    const rankCap = businessRules.commissionCaps[user.rank as Rank] || 0;
    
    // Get total commissions for the day
    const dayStart = new Date(commission.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(commission.date);
    dayEnd.setHours(23, 59, 59, 999);

    const totalForDay = await prisma.commission.aggregate({
      where: {
        userId: commission.userId,
        date: {
          gte: dayStart,
          lte: dayEnd
        }
      },
      _sum: { amount: true }
    });

    const total = totalForDay._sum.amount || 0;

    return {
      valid: total <= rankCap,
      details: {
        stored: commission.amount,
        calculated: total,
        difference: rankCap - total,
        type: commission.type
      }
    };
  } catch (error) {
    console.error('Failed to verify commission calculation:', error);
    return {
      valid: false,
      error: 'Verification failed'
    };
  }
}

export async function requestEcashTopUp(request: { memberId: string; amount: number; id?: string }): Promise<void> {
  try {
    // Get member name for the request
    const member = await prisma.user.findUnique({
      where: { id: request.memberId },
      select: { fullName: true }
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Create E-cash top-up request
    await prisma.ecommTopupRequest.create({
      data: {
        id: request.id || `TOPUP-${Date.now()}`,
        memberId: request.memberId,
        memberName: member.fullName,
        amount: request.amount,
        status: 'pending'
      }
    });

    // Trigger admin notification
    // await triggerEcashTopupRequestNotification(request);
  } catch (error) {
    console.error('Failed to request E-cash top-up:', error);
    throw error;
  }
}

export async function approveTopUp(requestId: string): Promise<void> {
  try {
    // Get the top-up request
    const topupRequest = await prisma.ecommTopupRequest.findUnique({
      where: { id: requestId }
    });

    if (!topupRequest) {
      throw new Error('Top-up request not found');
    }

    // Update request status
    await prisma.ecommTopupRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved'
      }
    });

    // Create commission record for the top-up
    await prisma.commission.create({
      data: {
        id: `TOPUP-${Date.now()}`,
        userId: topupRequest.memberId,
        date: new Date().toISOString(),
        type: 'E-Cash Top-up',
        status: 'Paid',
        amount: topupRequest.amount
      }
    });

    // Trigger user notification
    // await triggerEcashTopupApprovalNotification(topupRequest);
  } catch (error) {
    console.error('Failed to approve top-up:', error);
    throw error;
  }
}

export async function rejectTopUp(requestId: string): Promise<void> {
  try {
    // Update request status to rejected
    await prisma.ecommTopupRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected'
      }
    });

    // Trigger user notification
    // await triggerEcashTopupRejectionNotification(topupRequest);
  } catch (error) {
    console.error('Failed to reject top-up:', error);
    throw error;
  }
}

export async function requestStockTransfer(request: { stockistId: string; stockistName: string; stockistLevel: StockistLevel; requests: StockRequestItem[] }): Promise<{ success: boolean; message: string }> {
  try {
    // Create stock request record
    const stockRequestId = `STOCK_REQ-${Date.now()}`;

    await prisma.stockRequest.create({
      data: {
        id: stockRequestId,
        stockistId: request.stockistId,
        stockistName: request.stockistName,
        stockistLevel: request.stockistLevel,
        status: 'pending',
        createdDate: new Date().toISOString()
      }
    });

    // Create stock request items
    if (request.requests && request.requests.length > 0) {
      const itemPromises = request.requests.map((item, index) =>
        (prisma as any).stockRequestItem.create({
          data: {
            id: `${stockRequestId}-${index}`,
            stockRequestId,
            productId: item.productId,
            productName: item.productName,
            requestedQuantity: item.requestedQuantity,
            unitPrice: (item as any).unitPrice || 0
          }
        })
      );
      await Promise.all(itemPromises);
    }

    // Trigger admin notification
    // await triggerStockRequestNotification(request);

    return { success: true, message: 'Stock request submitted successfully' };
  } catch (error) {
    console.error('Failed to request stock transfer:', error);
    return { success: false, message: 'Failed to submit stock request' };
  }
}

export async function sellStockToDownline(sale: { buyerId: string; totalAmount: number; items: Array<{ productId: string; quantity: number; price: number; pv?: number }> }): Promise<void> {
  try {
    // Create order for the stock sale
    const orderId = `STOCK-${Date.now()}`;

    await prisma.order.create({
      data: {
        id: orderId,
        userId: sale.buyerId,
        orderId,
        totalAmount: sale.totalAmount,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Add order items
    if (sale.items && sale.items.length > 0) {
      const orderItemPromises = sale.items.map((item) =>
        prisma.orderItem.create({
          data: {
            id: `${orderId}-${item.productId}`,
            orderId,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            pv: item.pv || 0
          }
        })
      );
      await Promise.all(orderItemPromises);
    }

    // Update inventory levels
    for (const item of sale.items) {
      await inventoryService.updateStockLevels(
        item.productId,
        item.quantity,
        'subtract',
        orderId,
        sale.buyerId,
        'Stock sold to downline',
        undefined
      );
    }

    // Process commissions for the sale
    // This would trigger through the normal commission cycle
    console.log(`Stock sale completed and inventory updated for order ${orderId}`);
  } catch (error) {
    console.error('Failed to sell stock to downline:', error);
    throw error;
  }
}

