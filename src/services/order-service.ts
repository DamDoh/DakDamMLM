'use server';

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { updateStockLevels, reserveStock, releaseStock } from '@/services/inventory-service';
import { calculateTaxAndShipping, type CartItem, type ShippingAddress, type OrderSummary } from '@/services/cart-service';
import { WalletServiceEnhanced } from '@/services/wallet-service-enhanced';

export interface OrderDetails {
  id: string;
  orderId: string;
  userId: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  totalPV: number;
  currency: string;
  shippingAddress?: ShippingAddress;
  paymentMethod?: string;
  paymentStatus: string;
  trackingNumber?: string;
  notes?: string;
  companyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  pv: number;
  unitType: string;
}

export interface CreateOrderRequest {
  userId: string;
  items: CartItem[];
  shippingAddress?: ShippingAddress;
  paymentMethod?: string;
  notes?: string;
  companyId?: string;
}

/**
 * Create a new order
 */
export async function createOrder(request: CreateOrderRequest): Promise<{ success: boolean; order?: OrderDetails; message?: string }> {
  try {
    const { userId, items, shippingAddress, paymentMethod, notes, companyId } = request;

    if (!items || items.length === 0) {
      return { success: false, message: 'No items in order' };
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalPV = items.reduce((sum, item) => sum + ((item.pv || 0) * item.quantity), 0);

    // Calculate tax and shipping
    const taxCalculation = await calculateTaxAndShipping(subtotal, shippingAddress, 'USD', companyId);

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    return await prisma.$transaction(async (tx) => {
      // Reserve stock for all items
      for (const item of items) {
        const reserved = await reserveStock(item.productId, item.quantity, orderId, userId, companyId);
        if (!reserved) {
          throw new Error(`Failed to reserve stock for ${item.productName}`);
        }
      }

      // Create order
      const order = await tx.order.create({
        data: {
          orderId,
          userId,
          status: 'Pending',
          itemCount: items.length,
          amount: subtotal,
          totalAmount: taxCalculation.total,
          companyId,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              pv: item.pv || 0
            }))
          }
        },
        include: {
          items: true
        }
      });

      // Create order details record for additional metadata
      const orderDetails = await tx.orderDetails.create({
        data: {
          orderId: order.id,
          subtotal,
          taxAmount: taxCalculation.taxAmount,
          shippingAmount: taxCalculation.shippingCost,
          totalAmount: taxCalculation.total,
          totalPV,
          currency: taxCalculation.currency,
          shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
          paymentMethod: paymentMethod || 'wallet',
          paymentStatus: 'pending',
          notes
        }
      });

      // Log transaction
      await tx.transactionLog.create({
        data: {
          userId,
          type: 'order_created',
          amount: taxCalculation.total,
          currency: taxCalculation.currency,
          description: `Order ${orderId} created`,
          referenceId: order.id,
          referenceType: 'order',
          status: 'completed',
          metadata: {
            itemCount: items.length,
            totalPV,
            paymentMethod: paymentMethod || 'wallet'
          },
          companyId
        }
      });

      const orderDetail: OrderDetails = {
        id: order.id,
        orderId: order.orderId,
        userId: order.userId,
        status: order.status,
        items: items.map((item, index) => ({
          id: order.items[index].id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          pv: item.pv || 0,
          unitType: item.unitType
        })),
        subtotal,
        taxAmount: taxCalculation.taxAmount,
        shippingAmount: taxCalculation.shippingCost,
        totalAmount: taxCalculation.total,
        totalPV,
        currency: taxCalculation.currency,
        shippingAddress,
        paymentMethod,
        paymentStatus: 'pending',
        notes,
        companyId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };

      revalidatePath('/orders');
      return { success: true, order: orderDetail };
    });
  } catch (error) {
    logger.error('Failed to create order', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: request.userId
    });
    return { success: false, message: 'Failed to create order' };
  }
}

/**
 * Process payment for order
 */
export async function processOrderPayment(
  orderId: string,
  paymentMethod: string = 'wallet',
  userId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, details: true }
    });

    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    if (order.userId !== userId) {
      return { success: false, message: 'Unauthorized' };
    }

    if (order.status !== 'Pending') {
      return { success: false, message: 'Order is not in pending status' };
    }

    const orderDetails = order.details;
    if (!orderDetails) {
      return { success: false, message: 'Order details not found' };
    }

    return await prisma.$transaction(async (tx) => {
      if (paymentMethod === 'wallet') {
        // Check wallet balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { eCashBalance: true }
        });

        if (!user || user.eCashBalance < orderDetails.totalAmount) {
          return { success: false, message: 'Insufficient wallet balance' };
        }

        // Deduct from wallet
        await tx.user.update({
          where: { id: userId },
          data: {
            eCashBalance: {
              decrement: orderDetails.totalAmount
            }
          }
        });

        // Update wallet balance
        const wallet = await tx.wallet.findUnique({
          where: { userId },
          select: { id: true }
        });

        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: {
                decrement: orderDetails.totalAmount
              }
            }
          });

          // Create wallet transaction
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'debit',
              amount: -orderDetails.totalAmount,
              balanceBefore: (user.eCashBalance || 0),
              balanceAfter: (user.eCashBalance || 0) - orderDetails.totalAmount,
              description: `Payment for order ${order.orderId}`,
              referenceId: orderId,
              referenceType: 'order_payment',
              status: 'completed'
            }
          });
        }
      }

      // Deduct stock
      for (const item of order.items) {
        const success = await updateStockLevels(
          item.productId,
          item.quantity,
          'subtract',
          orderId,
          userId,
          'Order fulfillment',
          order.companyId || undefined
        );
        if (!success.success) {
          throw new Error(`Failed to update stock for ${item.productId}`);
        }
      }

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'Processing' }
      });

      // Update order details payment status
      await tx.orderDetails.update({
        where: { orderId },
        data: { paymentStatus: 'completed' }
      });

      // Log transaction
      await tx.transactionLog.create({
        data: {
          userId,
          type: 'payment_processed',
          amount: orderDetails.totalAmount,
          currency: orderDetails.currency,
          description: `Payment processed for order ${order.orderId}`,
          referenceId: orderId,
          referenceType: 'order',
          status: 'completed',
          metadata: {
            paymentMethod,
            itemCount: order.itemCount
          },
          companyId: order.companyId
        }
      });

      revalidatePath('/orders');
      return { success: true };
    });
  } catch (error) {
    logger.error('Failed to process order payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId,
      userId
    });
    return { success: false, message: 'Failed to process payment' };
  }
}

/**
 * Get order by ID
 */
export async function getOrder(orderId: string, userId: string): Promise<OrderDetails | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                unitType: true
              }
            }
          }
        },
        details: true
      }
    });

    if (!order || order.userId !== userId) {
      return null;
    }

    const shippingAddress = order.details?.shippingAddress
      ? JSON.parse(order.details.shippingAddress)
      : undefined;

    return {
      id: order.id,
      orderId: order.orderId,
      userId: order.userId,
      status: order.status,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || 'Unknown Product',
        quantity: item.quantity,
        price: item.price,
        pv: item.pv,
        unitType: item.product?.unitType || 'piece'
      })),
      subtotal: order.details?.subtotal || order.amount,
      taxAmount: order.details?.taxAmount || 0,
      shippingAmount: order.details?.shippingAmount || 0,
      totalAmount: order.details?.totalAmount || order.totalAmount,
      totalPV: order.details?.totalPV || 0,
      currency: order.details?.currency || 'USD',
      shippingAddress,
      paymentMethod: order.details?.paymentMethod || undefined,
      paymentStatus: order.details?.paymentStatus || 'pending',
      trackingNumber: order.details?.trackingNumber || undefined,
      notes: order.details?.notes || undefined,
      companyId: order.companyId || undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  } catch (error) {
    logger.error('Failed to get order', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId,
      userId
    });
    return null;
  }
}

/**
 * Get user's orders
 */
export async function getUserOrders(
  userId: string,
  status?: string,
  companyId?: string,
  limit: number = 50
): Promise<OrderDetails[]> {
  try {
    const where: any = { userId };
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                unitType: true
              }
            }
          }
        },
        details: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return orders.map(order => {
      const shippingAddress = order.details?.shippingAddress
        ? JSON.parse(order.details.shippingAddress)
        : undefined;

      return {
        id: order.id,
        orderId: order.orderId,
        userId: order.userId,
        status: order.status,
        items: order.items.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.product?.name || 'Unknown Product',
          quantity: item.quantity,
          price: item.price,
          pv: item.pv,
          unitType: item.product?.unitType || 'piece'
        })),
        subtotal: order.details?.subtotal || order.amount,
        taxAmount: order.details?.taxAmount || 0,
        shippingAmount: order.details?.shippingAmount || 0,
        totalAmount: order.details?.totalAmount || order.totalAmount,
        totalPV: order.details?.totalPV || 0,
        currency: order.details?.currency || 'USD',
        shippingAddress,
        paymentMethod: order.details?.paymentMethod || undefined,
        paymentStatus: order.details?.paymentStatus || 'pending',
        trackingNumber: order.details?.trackingNumber || undefined,
        notes: order.details?.notes || undefined,
        companyId: order.companyId || undefined,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    });
  } catch (error) {
    logger.error('Failed to get user orders', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return [];
  }
}

/**
 * Cancel order
 */
export async function cancelOrder(
  orderId: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    if (order.userId !== userId) {
      return { success: false, message: 'Unauthorized' };
    }

    if (!['Pending', 'Processing'].includes(order.status)) {
      return { success: false, message: 'Order cannot be cancelled' };
    }

    return await prisma.$transaction(async (tx) => {
      // Release reserved stock
      for (const item of order.items) {
        await releaseStock(item.productId, item.quantity, orderId, userId, order.companyId || undefined);
      }

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'Cancelled' }
      });

      // Refund if payment was processed
      const orderDetails = await tx.orderDetails.findUnique({
        where: { orderId }
      });

      if (orderDetails?.paymentStatus === 'completed') {
        // Refund to wallet
        await tx.user.update({
          where: { id: userId },
          data: {
            eCashBalance: {
              increment: orderDetails.totalAmount
            }
          }
        });

        // Update wallet balance
        const wallet = await tx.wallet.findUnique({
          where: { userId },
          select: { id: true, balance: true }
        });

        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: {
                increment: orderDetails.totalAmount
              }
            }
          });

          // Create refund transaction
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'credit',
              amount: orderDetails.totalAmount,
              balanceBefore: wallet.balance,
              balanceAfter: wallet.balance + orderDetails.totalAmount,
              description: `Refund for cancelled order ${order.orderId}`,
              referenceId: orderId,
              referenceType: 'order_refund',
              status: 'completed'
            }
          });
        }
      }

      // Log transaction
      await tx.transactionLog.create({
        data: {
          userId,
          type: 'order_cancelled',
          amount: orderDetails?.totalAmount || order.totalAmount,
          currency: orderDetails?.currency || 'USD',
          description: `Order ${order.orderId} cancelled${reason ? `: ${reason}` : ''}`,
          referenceId: orderId,
          referenceType: 'order',
          status: 'completed',
          metadata: { reason },
          companyId: order.companyId
        }
      });

      revalidatePath('/orders');
      return { success: true };
    });
  } catch (error) {
    logger.error('Failed to cancel order', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId,
      userId
    });
    return { success: false, message: 'Failed to cancel order' };
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\services\order-service.ts