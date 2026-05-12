import { orderDb as db } from '../config/database';
import { cacheService } from '../utils/cache';
import { logger, logOrderCreation, logOrderStatusChange, logInventoryUpdate } from '../utils/logger';
import { recordInventoryUpdate, recordOrderRevenue } from '../utils/metrics';
import { v4 as uuidv4 } from 'uuid';

interface CreateOrderData {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    variant?: any;
  }>;
  shippingAddress?: any;
  billingAddress?: any;
  paymentMethod?: string;
}

interface OrderQuery {
  userId?: string;
  status?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface AnalyticsQuery {
  period: string;
  startDate?: string;
  endDate?: string;
}

export class OrderService {
  async createOrder(orderData: CreateOrderData) {
    const { userId, items, shippingAddress, billingAddress, paymentMethod } = orderData;

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Validate and calculate order totals
    const orderItems = [];
    let totalAmount = 0;
    let totalPV = 0;

    for (const item of items) {
      const product = await this.getProductWithInventory(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (!product.isActive) {
        throw new Error(`Product ${product.name} is not available`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`);
      }

      const unitPrice = product.price;
      const totalPrice = unitPrice * item.quantity;
      const pv = (product.pv || 0) * item.quantity;

      orderItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        price: unitPrice,
        unitPrice,
        totalPrice,
        pv,
        sku: (product as any).sku,
        variant: item.variant,
      });

      totalAmount += totalPrice;
      totalPV += pv;
    }

    // Calculate tax and shipping (simplified)
    const taxAmount = totalAmount * 0.08; // 8% tax
    const shippingAmount = totalAmount > 100 ? 0 : 9.99; // Free shipping over $100
    const finalTotal = totalAmount + taxAmount + shippingAmount;

    // Create order in database
    const order = await db.order.create({
      data: {
        ...({ orderNumber } as any),
        userId,
        totalAmount: finalTotal,
        taxAmount,
        shippingAmount,
        discountAmount: 0,
        currency: 'USD',
        paymentMethod,
        paymentStatus: 'PENDING',
        shippingAddress,
        billingAddress,
        status: 'PENDING',
        items: {
          create: orderItems as any,
        },
      },
      include: {
        items: true,
      },
    });

    // Update inventory
    await this.updateInventoryForOrder(orderItems, 'DECREASE', 'order_created');

    // Cache the order
    await cacheService.setCachedOrder(order.id, order);

    // Invalidate user orders cache
    await cacheService.invalidateUserOrdersCache(userId);

    logger.info('Order created successfully', {
      orderId: order.id,
      orderNumber,
      userId,
      totalAmount: finalTotal,
      itemCount: orderItems.length,
    });

    return order;
  }

  async getOrderById(orderId: string) {
    // Try cache first
    let order = await cacheService.getCachedOrder(orderId);
    if (order) {
      return order;
    }

    // Fetch from database
    order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shipments: true,
        refunds: true,
        ...({ user: { select: { id: true, fullName: true, email: true, memberId: true } } } as any),
      },
    });

    if (order) {
      // Cache for future requests
      await cacheService.setCachedOrder(orderId, order);
    }

    return order;
  }

  async getOrders(query: OrderQuery) {
    const { userId, status, page, limit, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          items: true,
          ...({ user: { select: { id: true, fullName: true, email: true, memberId: true } } } as any),
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      db.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async updateOrder(orderId: string, updates: any) {
    const order = await db.order.update({
      where: { id: orderId },
      data: updates,
      include: {
        items: true,
      },
    });

    // Invalidate cache
    await cacheService.invalidateOrderCache(orderId);
    await cacheService.invalidateUserOrdersCache(order.userId);

    return order;
  }

  async updateOrderStatus(orderId: string, status: string, notes?: string) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true, userId: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const oldStatus = order.status;

    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: status as any,
        ...(status === 'SHIPPED' && { shippedAt: new Date() }),
        ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
        ...(status === 'CANCELLED' && { cancelledAt: new Date() }),
      },
      include: {
        items: true,
      },
    });

    // Invalidate cache
    await cacheService.invalidateOrderCache(orderId);
    await cacheService.invalidateUserOrdersCache(order.userId);

    // Log status change
    logOrderStatusChange(orderId, oldStatus, status);

    return updatedOrder;
  }

  async cancelOrder(orderId: string, reason?: string) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw new Error(`Cannot cancel order with status ${order.status}`);
    }

    // Restore inventory
    await this.updateInventoryForOrder(order.items, 'INCREASE', 'order_cancelled');

    const cancelledOrder = await this.updateOrderStatus(orderId, 'CANCELLED', reason);

    return cancelledOrder;
  }

  async shipOrder(orderId: string, shippingData: {
    trackingNumber?: string;
    carrier?: string;
    shippingMethod: string;
  }) {
    const shipment = await (db as any).shipment.create({
      data: {
        orderId,
        trackingNumber: shippingData.trackingNumber,
        carrier: shippingData.carrier,
        shippingMethod: shippingData.shippingMethod,
        shippingCost: 0, // Would be calculated based on method
        status: 'SHIPPED',
        shippedAt: new Date(),
      },
    });

    return shipment;
  }

  async deliverOrder(orderId: string) {
    const order = await this.updateOrderStatus(orderId, 'DELIVERED');

    // Update shipment status
    await (db as any).shipment.updateMany({
      where: { orderId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });

    return order;
  }

  async getOrderSummary(query: AnalyticsQuery) {
    const { startDate, endDate } = this.getDateRange(query);

    const [orderStats, revenueStats] = await Promise.all([
      db.order.groupBy({
        by: ['status'],
        where: {
          ...({ orderedAt: { gte: startDate, lte: endDate } } as any),
        },
        _count: true,
      }),
      db.order.aggregate({
        where: {
          ...({ orderedAt: { gte: startDate, lte: endDate } } as any),
          status: {
            not: 'CANCELLED',
          },
        },
        _count: true,
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const statusDistribution = orderStats.reduce((acc: Record<string, number>, stat: { status: string; _count: number }) => {
      acc[stat.status] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      period: query.period,
      startDate,
      endDate,
      totalOrders: (revenueStats._count as any)?._all || (typeof revenueStats._count === 'number' ? revenueStats._count : 0),
      totalRevenue: revenueStats._sum?.totalAmount || 0,
      averageOrderValue: ((revenueStats._count as any)?._all || (typeof revenueStats._count === 'number' ? revenueStats._count : 0)) > 0
        ? (revenueStats._sum?.totalAmount || 0) / ((revenueStats._count as any)?._all || (typeof revenueStats._count === 'number' ? revenueStats._count : 1))
        : 0,
      orderStatusDistribution: statusDistribution,
    };
  }

  async getRevenueAnalytics(query: AnalyticsQuery) {
    const { startDate, endDate } = this.getDateRange(query);

    // Revenue by period (daily/weekly/monthly)
    const revenueByPeriod = await db.$queryRaw`
      SELECT
        DATE_TRUNC('day', "orderedAt") as period,
        COUNT(*) as order_count,
        SUM("totalAmount") as revenue
      FROM orders
      WHERE "orderedAt" >= ${startDate}
        AND "orderedAt" <= ${endDate}
        AND status != 'CANCELLED'
      GROUP BY DATE_TRUNC('day', "orderedAt")
      ORDER BY period
    `;

    // Top products - use raw SQL to calculate revenue correctly (price * quantity)
    // Note: OrderItem model uses 'orderId' which references Order.orderId (not Order.id)
    const topProductsRaw = await db.$queryRaw<Array<{
      productId: string;
      quantitySold: bigint;
      revenue: number;
    }>>`
      SELECT 
        oi."productId",
        SUM(oi.quantity)::bigint as "quantitySold",
        SUM(oi.price * oi.quantity)::numeric as revenue
      FROM order_items oi
      INNER JOIN orders o ON o."orderId" = oi."orderId"
      WHERE o."date" >= ${startDate}
        AND o."date" <= ${endDate}
        AND o.status != 'CANCELLED'
      GROUP BY oi."productId"
      ORDER BY "quantitySold" DESC
      LIMIT 10
    `;

    const topProducts = topProductsRaw.map((p: { productId: string; quantitySold: bigint; revenue: number }) => ({
      productId: p.productId,
      _sum: {
        quantity: Number(p.quantitySold),
      },
      revenue: Number(p.revenue),
    }));

    // Fetch product names separately
    const productIds = topProducts.map((p: any) => p.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p: { id: string; name: string }) => [p.id, p.name]));

    return {
      period: query.period,
      startDate,
      endDate,
      revenueByPeriod,
      topProducts: topProducts.map((product: any) => ({
        productId: product.productId,
        productName: productMap.get(product.productId) || 'Unknown',
        quantitySold: product._sum?.quantity || 0,
        revenue: product.revenue || 0,
      })),
    };
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  private async getProductWithInventory(productId: string) {
    // Try cache first
    let product = await cacheService.getCachedProduct(productId);
    if (product) {
      return product;
    }

    // Fetch from database
    product = await db.product.findUnique({
      where: { id: productId },
    });

    if (product) {
      // Cache for future requests
      await cacheService.setCachedProduct(productId, product);
    }

    return product;
  }

  private async updateInventoryForOrder(
    orderItems: any[],
    changeType: 'INCREASE' | 'DECREASE',
    reason: string
  ) {
    for (const item of orderItems) {
      const quantityChange = changeType === 'DECREASE' ? -item.quantity : item.quantity;

      // Update product stock
      const productBefore = await db.product.findUnique({
        where: { id: item.productId },
      }) as any;
      const previousStock = productBefore?.stockQuantity || 0;

      const product = await db.product.update({
        where: { id: item.productId },
        data: {
          ...({ stockQuantity: { increment: quantityChange } } as any),
        },
      }) as any;

      // Log inventory change
      await (db as any).inventoryLog.create({
        data: {
          productId: item.productId,
          changeType,
          quantityChange: Math.abs(quantityChange),
          previousStock: previousStock,
          newStock: product.stockQuantity,
          reason,
          performedBy: 'system', // Would be actual user in real implementation
        },
      });

      // Invalidate product cache
      await cacheService.invalidateProductCache(item.productId);

      // Log and record metrics
      logInventoryUpdate(item.productId, quantityChange, reason);
      recordInventoryUpdate(changeType.toLowerCase(), reason);
    }
  }

  private getDateRange(query: AnalyticsQuery): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      switch (query.period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    return { startDate, endDate };
  }
}