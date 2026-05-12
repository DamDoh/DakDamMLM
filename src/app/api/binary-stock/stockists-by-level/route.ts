import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { ApiResponseUtil } from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * Helper: Get stock inventory for a user (same logic as binary-stock route)
 */
async function getStockInventory(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, companyId: true }
  });

  if (!user) {
    return {
      items: [],
      totalStock: 0,
      productCount: 0
    };
  }

  // For admin users, get stock from StockItems table
  if (user.isAdmin) {
    const stockItems = await prisma.stockItem.findMany({
      where: {
        companyId: user.companyId || undefined,
        quantity: {
          gt: 0
        }
      },
      select: {
        id: true,
        name: true,
        code: true,
        quantity: true
      }
    });

    const items = stockItems.map(item => ({
      productId: item.id,
      productName: item.name,
      sku: item.code || item.id.substring(0, 8),
      quantity: item.quantity
    }));

    const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      totalStock,
      productCount: items.length
    };
  }

  // For non-admin users, get stock from inventory transactions
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });

  const inventory: Record<string, {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
  }> = {};

  for (const tx of transactions) {
    const productId = tx.productId;
    if (!inventory[productId]) {
      // Try to get product name from StockItem
      const stockItem = await prisma.stockItem.findUnique({
        where: { id: productId },
        select: { name: true, code: true }
      });
      
      inventory[productId] = {
        productId,
        productName: stockItem?.name || 'Unknown Product',
        sku: stockItem?.code || productId.substring(0, 8),
        quantity: 0
      };
    }

    const qty = Number(tx.quantity) || 0;
    if (tx.type === 'purchase' || tx.type === 'transfer' || tx.type === 'return') {
      inventory[productId].quantity += qty;
    } else if (tx.type === 'sale' || tx.type === 'adjustment') {
      inventory[productId].quantity -= qty;
    }
  }

  const items = Object.values(inventory).filter(item => item.quantity > 0);
  const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    totalStock,
    productCount: items.length
  };
}

/**
 * GET /api/binary-stock/stockists-by-level
 * Get all stockists grouped by level (for admin only)
 */
export async function GET(request: NextRequest) {
  return requireAuth(async (req: AuthenticatedRequest) => {
    try {
      const authUser = req.user!;

      // Only admins can access this endpoint
      if (!authUser.isAdmin) {
        return ApiResponseUtil.forbidden('Only admins can access this endpoint');
      }

      // Get all users with stock levels (excluding ADMIN001)
      const stockists = await prisma.user.findMany({
        where: {
          storeOwnerLevel: { in: ['S', 'M', 'C', 'D'] },
          memberId: { not: 'ADMIN001' }, // Exclude company/admin
          active: true,
          deleted: false
        },
        select: {
          id: true,
          fullName: true,
          memberId: true,
          storeOwnerLevel: true,
          rank: true
        }
      });

      // Get stock inventory for each stockist using the same function as binary-stock route
      const stockistsWithInventory = await Promise.all(
        stockists.map(async (stockist) => {
          const inventory = await getStockInventory(stockist.id);

          return {
            id: stockist.id,
            fullName: stockist.fullName,
            memberId: stockist.memberId,
            storeOwnerLevel: stockist.storeOwnerLevel,
            stockLevel: inventory.totalStock,
            productCount: inventory.productCount,
            rank: stockist.rank
          };
        })
      );

      // Group by level
      const grouped: { D: typeof stockistsWithInventory; C: typeof stockistsWithInventory; M: typeof stockistsWithInventory; S: typeof stockistsWithInventory } = {
        D: [],
        C: [],
        M: [],
        S: []
      };

      stockistsWithInventory.forEach((stockist) => {
        if (stockist.storeOwnerLevel && ['D', 'C', 'M', 'S'].includes(stockist.storeOwnerLevel)) {
          grouped[stockist.storeOwnerLevel as keyof typeof grouped].push(stockist);
        }
      });

      // Log detailed information for debugging
      logger.info('Stockists by level retrieved', {
        userId: authUser.id,
        totalStockists: stockistsWithInventory.length,
        byLevel: {
          D: grouped.D.length,
          C: grouped.C.length,
          M: grouped.M.length,
          S: grouped.S.length
        },
        stockists: stockistsWithInventory.map(s => ({
          memberId: s.memberId,
          level: s.storeOwnerLevel,
          stockLevel: s.stockLevel,
          productCount: s.productCount
        }))
      }, req);

      return ApiResponseUtil.success(grouped);

    } catch (error) {
      logger.error('Failed to get stockists by level', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, req);
      return ApiResponseUtil.error('Failed to get stockists by level');
    }
  })(request);
}

