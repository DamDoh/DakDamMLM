"use server";
import type { Product, Rank, StockistLevel, Address } from '@/lib/types';
import { prisma } from '@/lib/database';
import { CommissionService } from './commission-service';

// Re-export commission functions
export const addCommission = async (commission: any) => {
  return CommissionService.createCommission(
    commission.userId,
    commission.amount,
    commission.type,
    commission.description,
    commission.companyId
  );
};

// Simple addOrder implementation
export const addOrder = async (userId: string, order: any) => {
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
      const orderItemPromises = order.items.map(async (item: any) => {
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
  } catch (error) {
    console.error('Failed to add order:', error);
    throw error;
  }
};

// Placeholder exports for other services that may be needed
export const runCommissionCycle = CommissionService.runCommissionCycle;
export const calculateBinaryBonus = CommissionService.calculateBinaryCommission;
export const calculateStockistBonus = async () => Promise.resolve(0);
export const calculateMatchingBonus = async () => Promise.resolve(0);