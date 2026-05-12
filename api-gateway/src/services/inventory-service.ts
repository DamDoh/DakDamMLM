/**
 * INVENTORY MANAGEMENT SERVICE
 *
 * Handles all inventory operations including:
 * - Stock level tracking
 * - Transaction recording
 * - Stock transfers
 * - Low stock alerts
 *
 * Created: 2025-10-19 (Audit Fix)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface InventoryTransaction {
  id: string;
  productId: string;
  userId?: string;
  type: 'purchase' | 'sale' | 'transfer' | 'adjustment' | 'return';
  quantity: number;
  previousQty: number;
  newQty: number;
  reference?: string;
  reason?: string;
  companyId?: string;
  createdAt: Date;
  createdBy: string;
}

export interface StockTransferItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Update stock levels for a product
 */
export async function updateStockLevels(
  productId: string,
  quantity: number,
  operation: 'add' | 'subtract',
  reference?: string,
  userId?: string,
  reason?: string,
  companyId?: string
): Promise<{ success: boolean; newQuantity: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Get current product
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true, name: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      const previousQty = product.qty;
      const adjustment = operation === 'add' ? quantity : -quantity;
      const newQty = Math.max(0, previousQty + adjustment);

      // Update product quantity
      await tx.product.update({
        where: { id: productId },
        data: { qty: newQty }
      });

      // Record transaction
      await tx.inventoryTransaction.create({
        data: {
          productId,
          userId,
          type: operation === 'add' ? 'purchase' : 'sale',
          quantity: Math.abs(adjustment),
          previousQty,
          newQty,
          reference,
          reason,
          companyId,
          createdBy: userId || 'system'
        }
      });

      logger.info(`Stock levels updated`, {
        productId,
        product: product.name,
        operation,
        quantity,
        previousQty,
        newQty
      });

      return { success: true, newQuantity: newQty };
    });
  } catch (error) {
    logger.error('Failed to update stock levels', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      quantity,
      operation
    });
    throw error;
  }
}

/**
 * Get current stock level for a product
 */
export async function getStockLevel(productId: string, companyId?: string): Promise<number> {
  try {
    const where: any = { id: productId };
    if (companyId) {
      where.companyId = companyId;
    }

    const product = await prisma.product.findUnique({
      where,
      select: { qty: true }
    });

    return product?.qty || 0;
  } catch (error) {
    logger.error('Failed to get stock level', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId
    });
    return 0;
  }
}

/**
 * Reserve stock for an order (prevents overselling)
 */
export async function reserveStock(
  productId: string,
  quantity: number,
  orderId: string,
  userId: string,
  companyId?: string
): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true, name: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      if (product.qty < quantity) {
        logger.warn(`Insufficient stock for reservation`, {
          productId,
          available: product.qty,
          requested: quantity
        });
        return false;
      }

      // Deduct quantity
      const newQty = product.qty - quantity;
      await tx.product.update({
        where: { id: productId },
        data: { qty: newQty }
      });

      // Record reservation transaction
      await tx.inventoryTransaction.create({
        data: {
          productId,
          userId,
          type: 'sale',
          quantity,
          previousQty: product.qty,
          newQty,
          reference: orderId,
          reason: 'Stock reserved for order',
          companyId,
          createdBy: userId
        }
      });

      logger.info(`Stock reserved`, {
        productId,
        product: product.name,
        quantity,
        orderId
      });

      return true;
    });
  } catch (error) {
    logger.error('Failed to reserve stock', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      quantity,
      orderId
    });
    return false;
  }
}

/**
 * Release reserved stock (e.g., when order is cancelled)
 */
export async function releaseStock(
  productId: string,
  quantity: number,
  orderId: string,
  userId: string,
  companyId?: string
): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true, name: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Add quantity back
      const newQty = product.qty + quantity;
      await tx.product.update({
        where: { id: productId },
        data: { qty: newQty }
      });

      // Record release transaction
      await tx.inventoryTransaction.create({
        data: {
          productId,
          userId,
          type: 'return',
          quantity,
          previousQty: product.qty,
          newQty,
          reference: orderId,
          reason: 'Stock released from cancelled order',
          companyId,
          createdBy: userId
        }
      });

      logger.info(`Stock released`, {
        productId,
        product: product.name,
        quantity,
        orderId
      });

      return true;
    });
  } catch (error) {
    logger.error('Failed to release stock', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      quantity,
      orderId
    });
    return false;
  }
}

/**
 * Transfer stock between users (for stockist system)
 */
export async function transferStock(
  fromUserId: string,
  toUserId: string,
  items: StockTransferItem[],
  companyId?: string
): Promise<{ success: boolean; transferId?: string }> {
  try {
    const transferId = `TRANSFER-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { qty: true, name: true }
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        if (product.qty < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.qty}, Requested: ${item.quantity}`);
        }

        // No need to update product qty as it's a transfer between users
        // But record the transaction for audit trail
        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId,
            userId: fromUserId,
            type: 'transfer',
            quantity: item.quantity,
            previousQty: product.qty,
            newQty: product.qty,
            reference: transferId,
            reason: `Transfer from ${fromUserId} to ${toUserId}`,
            companyId,
            createdBy: fromUserId
          }
        });
      }

      logger.info(`Stock transferred`, {
        transferId,
        fromUserId,
        toUserId,
        itemCount: items.length
      });
    });

    return { success: true, transferId };
  } catch (error) {
    logger.error('Failed to transfer stock', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fromUserId,
      toUserId,
      itemCount: items.length
    });
    return { success: false };
  }
}

/**
 * Record an inventory transaction (for manual adjustments)
 */
export async function recordTransaction(
  productId: string,
  type: 'purchase' | 'sale' | 'transfer' | 'adjustment' | 'return',
  quantity: number,
  reference?: string,
  userId?: string,
  reason?: string,
  companyId?: string
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      await tx.inventoryTransaction.create({
        data: {
          productId,
          userId,
          type,
          quantity,
          previousQty: product.qty,
          newQty: product.qty, // Same as previous since this is just recording
          reference,
          reason,
          companyId,
          createdBy: userId || 'system'
        }
      });
    });

    return true;
  } catch (error) {
    logger.error('Failed to record transaction', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      type,
      quantity
    });
    return false;
  }
}

/**
 * Get inventory transaction history
 */
export async function getInventoryHistory(
  productId?: string,
  userId?: string,
  companyId?: string,
  limit: number = 100
): Promise<InventoryTransaction[]> {
  try {
    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return transactions as InventoryTransaction[];
  } catch (error) {
    logger.error('Failed to get inventory history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      userId
    });
    return [];
  }
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(
  threshold: number = 10,
  companyId?: string
): Promise<Array<{ id: string; name: string; qty: number; category: string }>> {
  try {
    const where: any = {
      qty: { lte: threshold },
      isActive: true
    };

    if (companyId) {
      where.companyId = companyId;
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        qty: true,
        category: true
      },
      orderBy: { qty: 'asc' }
    });

    return products;
  } catch (error) {
    logger.error('Failed to get low stock products', {
      error: error instanceof Error ? error.message : 'Unknown error',
      threshold
    });
    return [];
  }
}

/**
 * Adjust stock levels (for corrections, audits, etc.)
 */
export async function adjustStockLevels(
  productId: string,
  newQuantity: number,
  reason: string,
  userId: string,
  companyId?: string
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { qty: true, name: true }
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      const previousQty = product.qty;
      const difference = newQuantity - previousQty;

      // Update product quantity
      await tx.product.update({
        where: { id: productId },
        data: { qty: newQuantity }
      });

      // Record adjustment transaction
      await tx.inventoryTransaction.create({
        data: {
          productId,
          userId,
          type: 'adjustment',
          quantity: Math.abs(difference),
          previousQty,
          newQty: newQuantity,
          reason,
          companyId,
          createdBy: userId
        }
      });

      logger.info(`Stock adjusted`, {
        productId,
        product: product.name,
        previousQty,
        newQuantity,
        difference,
        reason
      });
    });

    return true;
  } catch (error) {
    logger.error('Failed to adjust stock levels', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
      newQuantity
    });
    return false;
  }
}

/**
 * Get inventory statistics
 */
export async function getInventoryStatistics(companyId?: string): Promise<{
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}> {
  try {
    const where: any = { isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }

    const [products, totalStockAgg, lowStock, outOfStock] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.aggregate({
        where,
        _sum: { qty: true }
      }),
      prisma.product.count({
        where: { ...where, qty: { lte: 10, gt: 0 } }
      }),
      prisma.product.count({
        where: { ...where, qty: 0 }
      })
    ]);

    return {
      totalProducts: products,
      totalStock: totalStockAgg._sum.qty || 0,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      totalValue: 0 // Would need qty * price calculation
    };
  } catch (error) {
    logger.error('Failed to get inventory statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });
    return {
      totalProducts: 0,
      totalStock: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalValue: 0
    };
  }
}