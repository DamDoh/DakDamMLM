import type { Member, Order, OrderItem, Commission } from '@/lib/types';
import { prisma } from '@/lib/database';
import { DEFAULT_TRANSLATIONS } from '@/lib/internationalization';
import { triggerStockistOrderNotification } from './notification-service';

// Financial control helper
async function createFinancialControl(control: {
  type: string;
  amount: number;
  memberId: string;
  reason: string;
  status: string;
}): Promise<void> {
  // In production, this would be stored in a proper financial control system
  // For now, we'll keep it silent to avoid console clutter
  // console.log(`Financial Control: ${control.type} for member ${control.memberId}, Amount: $${control.amount}, Reason: ${control.reason}`);
}

interface TransferFundsInput {
  senderId: string;
  recipientIdentifier: string;
  amount: number;
}

interface TransferFundsOutput {
    success: boolean;
    message: string;
}

export async function addOrder(userId: string, order: Order): Promise<void> {
    try {
        // Validate required order properties
        if (!order.orderId || !order.userId || !order.status || !order.amount) {
            throw new Error('Missing required order properties');
        }

        // Create order in database
        await prisma.order.create({
            data: {
                id: order.orderId,
                userId,
                orderId: order.orderId,
                totalAmount: order.amount,
                status: order.status,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        });

        // Add order items if they exist
        if (order.items && order.items.length > 0) {
            const orderItemPromises = order.items.map(async (item: OrderItem) => {
                // Validate required item properties
                if (!item.productId || !item.quantity || !item.price) {
                    throw new Error(`Invalid order item: missing required properties for product ${item.productId}`);
                }

                try {
                    await prisma.orderItem.create({
                        data: {
                            id: `${order.orderId}-${item.productId}`,
                            orderId: order.orderId,
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.price,
                            pv: item.pv || 0,
                        }
                    });
                } catch (itemError: any) {
                    // Handle duplicate key errors (same product ordered multiple times)
                    if (itemError.code === 'P2002' || itemError.message?.includes('Unique constraint')) {
                        console.warn(`Order item already exists for order ${order.orderId} and product ${item.productId}`);
                    } else {
                        throw itemError;
                    }
                }
            });

            await Promise.all(orderItemPromises);
        }

        // Check if member is a stockist and trigger notification
        const member = await prisma.user.findUnique({
            where: { id: userId },
            select: { storeOwnerLevel: true, fullName: true }
        });

        if (member?.storeOwnerLevel) {
            await triggerStockistOrderNotification(order.orderId, {
                ...member,
                id: userId,
                fullName: member.fullName,
                storeOwnerLevel: member.storeOwnerLevel
            } as Member);
        }
    } catch (error) {
      console.error('Failed to add order:', error);
      throw error;
    }
  }

export async function updateMemberOnServer(memberId: string, data: Partial<Member>): Promise<void> {
  try {
    // Prepare update data, filtering out undefined values
    const updateData: any = {};
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.surname !== undefined) updateData.surname = data.surname;
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.rank !== undefined) updateData.rank = data.rank;
    if (data.pv !== undefined) updateData.pv = data.pv;
    if (data.pvDate !== undefined) updateData.pvDate = data.pvDate;
    if (data.teamSize !== undefined) updateData.teamSize = data.teamSize;
    if (data.children !== undefined) updateData.children = data.children;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.deleted !== undefined) updateData.deleted = data.deleted;
    if (data.deletedDate !== undefined) updateData.deletedDate = data.deletedDate;
    if (data.deletedBy !== undefined) updateData.deletedBy = data.deletedBy;
    if (data.isAdmin !== undefined) updateData.isAdmin = data.isAdmin;
    if (data.storeOwnerLevel !== undefined) updateData.storeOwnerLevel = data.storeOwnerLevel;
    if (data.sponsorId !== undefined) updateData.sponsorId = data.sponsorId;
    if (data.placementParentId !== undefined) updateData.placementParentId = data.placementParentId;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.addresses !== undefined) updateData.addresses = data.addresses;
    if (data.lastActivityDate !== undefined) updateData.lastActivityDate = data.lastActivityDate;
    if (data.joinDate !== undefined) updateData.joinDate = data.joinDate;

    updateData.updatedAt = new Date();

    await prisma.user.update({
      where: { id: memberId },
      data: updateData
    });
  } catch (error) {
    console.error('Failed to update member:', error);
    throw error;
  }
}

export async function transferECash(input: TransferFundsInput): Promise<TransferFundsOutput> {
  const { senderId, recipientIdentifier, amount } = input;

  const t = (key: string, vars?: Record<string, string>) => {
    let translation = DEFAULT_TRANSLATIONS.en[key as keyof typeof DEFAULT_TRANSLATIONS.en] || key;
    if (vars) {
        Object.entries(vars).forEach(([variable, value]) => {
            translation = translation.replace(`{{${variable}}}`, value);
        });
    }
    return translation;
  };

  try {
    // Find recipient using Prisma
    const recipient = await prisma.user.findFirst({
      where: {
        OR: [
          { memberId: recipientIdentifier },
          { email: recipientIdentifier.toLowerCase() },
          { phoneNumber: recipientIdentifier }
        ]
      }
    });

    if (!recipient) {
      return { success: false, message: t('ecash.dialog.errorRecipientNotFound', { identifier: recipientIdentifier }) };
    }

    if (recipient.id === senderId) {
      return { success: false, message: t('ecash.dialog.errorSelfTransfer') };
    }

    if (amount <= 0) {
      return { success: false, message: t('ecash.dialog.errorPositiveAmount') };
    }

    // Calculate sender balance using Prisma
    const senderCommissions = await prisma.commission.findMany({
      where: { userId: senderId }
    });
    const senderBalance = senderCommissions.reduce((acc, commission) => acc + commission.amount, 0);

    if (senderBalance < amount) {
      return { success: false, message: t('ecash.dialog.errorInsufficientFunds') };
    }

    if (amount > 1000) {
      await createFinancialControl({
        type: 'escrow',
        amount,
        memberId: senderId,
        reason: `Large E-Cash transfer to ${recipient.fullName} (${recipient.memberId})`,
        status: 'pending'
      });
      return { success: true, message: t('ecash.dialog.errorLargeTransfer') };
    }

    // Create transfer transactions
    const debitTransaction: Commission = {
      id: `TR-DEBIT-${Date.now()}`,
      userId: senderId,
      date: new Date().toISOString(),
      type: `Transfer to ${recipient.fullName}`,
      status: 'Paid',
      amount: -amount
    };

    const creditTransaction: Commission = {
      id: `TR-CREDIT-${Date.now()}`,
      userId: recipient.id,
      date: new Date().toISOString(),
      type: `Transfer from ${recipient.firstName} ${recipient.surname}`,
      status: 'Paid',
      amount: amount
    };

    // Execute transfers using Prisma
    await Promise.all([
      prisma.commission.create({ data: debitTransaction }),
      prisma.commission.create({ data: creditTransaction })
    ]);

    return {
      success: true,
      message: t('ecash.dialog.successMessage', {
        amount: amount.toFixed(2),
        name: `${recipient.firstName} ${recipient.surname}`
      })
    };

  } catch (error: any) {
    return { success: false, message: error.message || t('ecash.dialog.errorDb') };
  }
}