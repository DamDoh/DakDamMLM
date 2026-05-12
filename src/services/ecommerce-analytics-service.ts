'use server';

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface SalesAnalytics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalPV: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  salesByPeriod: Array<{
    period: string;
    revenue: number;
    orders: number;
    pv: number;
  }>;
  conversionRate: number;
}

export interface InventoryAnalytics {
  totalProducts: number;
  lowStockItems: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    reorderPoint: number;
  }>;
  stockTurnover: number;
  stockValue: number;
  outOfStockItems: Array<{
    productId: string;
    productName: string;
    daysOutOfStock: number;
  }>;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  averageCustomerValue: number;
  customerLifetimeValue: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalSpent: number;
    totalOrders: number;
    lastOrderDate: Date;
  }>;
}

export interface EcommerceAnalytics {
  sales: SalesAnalytics;
  inventory: InventoryAnalytics;
  customers: CustomerAnalytics;
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Get comprehensive e-commerce analytics
 */
export async function getEcommerceAnalytics(
  companyId?: string,
  startDate?: Date,
  endDate?: Date,
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<EcommerceAnalytics> {
  try {
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate || now;

    // Get orders within date range
    const orders = await prisma.order.findMany({
      where: {
        companyId,
        createdAt: {
          gte: start,
          lte: end
        },
        status: {
          notIn: ['Cancelled', 'Pending']
        }
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                pv: true
              }
            }
          }
        },
        details: true
      }
    });

    // Calculate sales analytics
    const salesAnalytics = await calculateSalesAnalytics(orders, start, end, period);

    // Calculate inventory analytics
    const inventoryAnalytics = await calculateInventoryAnalytics(companyId);

    // Calculate customer analytics
    const customerAnalytics = await calculateCustomerAnalytics(orders, start, end);

    return {
      sales: salesAnalytics,
      inventory: inventoryAnalytics,
      customers: customerAnalytics,
      period: { start, end }
    };
  } catch (error) {
    logger.error('Failed to get e-commerce analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });

    // Return empty analytics on error
    return {
      sales: {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        totalPV: 0,
        topProducts: [],
        salesByPeriod: [],
        conversionRate: 0
      },
      inventory: {
        totalProducts: 0,
        lowStockItems: [],
        stockTurnover: 0,
        stockValue: 0,
        outOfStockItems: []
      },
      customers: {
        totalCustomers: 0,
        newCustomers: 0,
        repeatCustomers: 0,
        averageCustomerValue: 0,
        customerLifetimeValue: 0,
        topCustomers: []
      },
      period: { start: new Date(), end: new Date() }
    };
  }
}

/**
 * Calculate sales analytics
 */
async function calculateSalesAnalytics(
  orders: any[],
  start: Date,
  end: Date,
  period: string
): Promise<SalesAnalytics> {
  const totalRevenue = orders.reduce((sum, order) =>
    sum + (order.details?.totalAmount || order.totalAmount), 0
  );

  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const totalPV = orders.reduce((sum, order) =>
    sum + (order.details?.totalPV || 0), 0
  );

  // Calculate top products
  const productSales = new Map<string, {
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>();

  orders.forEach(order => {
    order.items.forEach((item: any) => {
      const existing = productSales.get(item.productId) || {
        productId: item.productId,
        productName: item.product?.name || 'Unknown Product',
        quantitySold: 0,
        revenue: 0
      };

      existing.quantitySold += item.quantity;
      existing.revenue += item.price * item.quantity;
      productSales.set(item.productId, existing);
    });
  });

  const topProducts = Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Calculate sales by period
  const salesByPeriod = await getSalesByPeriod(start, end, period, orders);

  // Calculate conversion rate (orders / cart sessions)
  const conversionRate = await calculateConversionRate(start, end);

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue,
    totalPV,
    topProducts,
    salesByPeriod,
    conversionRate
  };
}

/**
 * Calculate inventory analytics
 */
async function calculateInventoryAnalytics(companyId?: string): Promise<InventoryAnalytics> {
  // Get all products
  const products = await prisma.product.findMany({
    where: {
      companyId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      qty: true,
      price: true
    }
  });

  const totalProducts = products.length;

  // Low stock items (less than 10 units)
  const lowStockItems = products
    .filter(product => product.qty < 10)
    .map(product => ({
      productId: product.id,
      productName: product.name,
      currentStock: product.qty,
      reorderPoint: 10
    }));

  // Out of stock items
  const outOfStockItems = products
    .filter(product => product.qty === 0)
    .map(product => ({
      productId: product.id,
      productName: product.name,
      daysOutOfStock: 0 // Would need historical data to calculate
    }));

  // Calculate stock value
  const stockValue = products.reduce((sum, product) =>
    sum + (product.qty * product.price), 0
  );

  // Calculate stock turnover (simplified - would need sales data)
  const stockTurnover = totalProducts > 0 ? stockValue / totalProducts : 0;

  return {
    totalProducts,
    lowStockItems,
    stockTurnover,
    stockValue,
    outOfStockItems
  };
}

/**
 * Calculate customer analytics
 */
async function calculateCustomerAnalytics(
  orders: any[],
  start: Date,
  end: Date
): Promise<CustomerAnalytics> {
  // Get unique customers from orders
  const customerIds = [...new Set(orders.map(order => order.userId))];
  const totalCustomers = customerIds.length;

  // Get customer order history
  const customerStats = new Map<string, {
    customerId: string;
    totalSpent: number;
    orderCount: number;
    lastOrderDate: Date;
    customerName: string;
  }>();

  for (const order of orders) {
    const existing = customerStats.get(order.userId) || {
      customerId: order.userId,
      totalSpent: 0,
      orderCount: 0,
      lastOrderDate: order.createdAt,
      customerName: '' // Will be filled below
    };

    existing.totalSpent += order.details?.totalAmount || order.totalAmount;
    existing.orderCount += 1;
    existing.lastOrderDate = order.createdAt > existing.lastOrderDate
      ? order.createdAt
      : existing.lastOrderDate;

    customerStats.set(order.userId, existing);
  }

  // Get customer names
  if (customerIds.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: customerIds }
      },
      select: {
        id: true,
        fullName: true
      }
    });

    users.forEach(user => {
      const stats = customerStats.get(user.id);
      if (stats) {
        stats.customerName = user.fullName;
        customerStats.set(user.id, stats);
      }
    });
  }

  const customerArray = Array.from(customerStats.values());

  // Calculate metrics
  const newCustomers = customerArray.filter(customer => customer.orderCount === 1).length;
  const repeatCustomers = customerArray.filter(customer => customer.orderCount > 1).length;
  const averageCustomerValue = customerArray.length > 0
    ? customerArray.reduce((sum, customer) => sum + customer.totalSpent, 0) / customerArray.length
    : 0;

  // Top customers
  const topCustomers = customerArray
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10)
    .map(customer => ({
      customerId: customer.customerId,
      customerName: customer.customerName,
      totalSpent: customer.totalSpent,
      totalOrders: customer.orderCount,
      lastOrderDate: customer.lastOrderDate
    }));

  return {
    totalCustomers,
    newCustomers,
    repeatCustomers,
    averageCustomerValue,
    customerLifetimeValue: averageCustomerValue, // Simplified calculation
    topCustomers
  };
}

/**
 * Get sales by period
 */
async function getSalesByPeriod(
  start: Date,
  end: Date,
  period: string,
  orders: any[]
): Promise<Array<{ period: string; revenue: number; orders: number; pv: number }>> {
  const periodMap = new Map<string, { revenue: number; orders: number; pv: number }>();

  orders.forEach(order => {
    const date = new Date(order.createdAt);
    let periodKey: string;

    switch (period) {
      case 'day':
        periodKey = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodKey = `${date.getFullYear()}-Q${quarter}`;
        break;
      case 'year':
        periodKey = String(date.getFullYear());
        break;
      default:
        periodKey = date.toISOString().split('T')[0];
    }

    const existing = periodMap.get(periodKey) || { revenue: 0, orders: 0, pv: 0 };
    existing.revenue += order.details?.totalAmount || order.totalAmount;
    existing.orders += 1;
    existing.pv += order.details?.totalPV || 0;
    periodMap.set(periodKey, existing);
  });

  return Array.from(periodMap.entries()).map(([period, data]) => ({
    period,
    revenue: data.revenue,
    orders: data.orders,
    pv: data.pv
  }));
}

/**
 * Calculate conversion rate
 */
async function calculateConversionRate(start: Date, end: Date): Promise<number> {
  try {
    // Count cart sessions
    const cartSessions = await prisma.cart.count({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      }
    });

    // Count completed orders
    const completedOrders = await prisma.order.count({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        status: {
          notIn: ['Cancelled', 'Pending']
        }
      }
    });

    return cartSessions > 0 ? (completedOrders / cartSessions) * 100 : 0;
  } catch (error) {
    logger.error('Failed to calculate conversion rate', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
}

/**
 * Get real-time stock reconciliation
 */
export async function getStockReconciliation(companyId?: string): Promise<{
  discrepancies: Array<{
    productId: string;
    productName: string;
    expectedStock: number;
    actualStock: number;
    difference: number;
  }>;
  lastReconciliation: Date | null;
}> {
  try {
    // Get all products with their current stock
    const products = await prisma.product.findMany({
      where: {
        companyId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        qty: true
      }
    });

    // Get inventory transactions to calculate expected stock
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        companyId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Calculate expected stock based on transactions
    const expectedStock = new Map<string, number>();
    const initialStock = new Map<string, number>();

    // Set initial stock levels
    products.forEach(product => {
      initialStock.set(product.id, product.qty);
      expectedStock.set(product.id, product.qty);
    });

    // Apply transactions to calculate expected stock
    transactions.forEach(transaction => {
      const current = expectedStock.get(transaction.productId) || 0;
      if (transaction.type === 'purchase' || transaction.type === 'return') {
        expectedStock.set(transaction.productId, current + transaction.quantity);
      } else if (transaction.type === 'sale' || transaction.type === 'adjustment') {
        expectedStock.set(transaction.productId, current - transaction.quantity);
      }
    });

    // Find discrepancies
    const discrepancies = products
      .map(product => {
        const expected = expectedStock.get(product.id) || 0;
        const actual = product.qty;
        const difference = actual - expected;

        return {
          productId: product.id,
          productName: product.name,
          expectedStock: expected,
          actualStock: actual,
          difference
        };
      })
      .filter(item => Math.abs(item.difference) > 0);

    // Get last reconciliation time (simplified - would need a reconciliation log table)
    const lastReconciliation = null;

    return {
      discrepancies,
      lastReconciliation
    };
  } catch (error) {
    logger.error('Failed to get stock reconciliation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });
    return {
      discrepancies: [],
      lastReconciliation: null
    };
  }
}

/**
 * Get transaction analytics
 */
export async function getTransactionAnalytics(
  companyId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageTransactionValue: number;
  transactionVolumeByMethod: Record<string, number>;
  transactionTrends: Array<{
    date: string;
    volume: number;
    value: number;
  }>;
}> {
  try {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    // Get payment transactions
    const transactions = await prisma.paymentTransaction.findMany({
      where: {
        companyId,
        createdAt: {
          gte: start,
          lte: end
        }
      }
    });

    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(tx => tx.status === 'completed').length;
    const failedTransactions = transactions.filter(tx => tx.status === 'failed').length;

    const completedTransactions = transactions.filter(tx => tx.status === 'completed');
    const averageTransactionValue = completedTransactions.length > 0
      ? completedTransactions.reduce((sum, tx) => sum + tx.amount, 0) / completedTransactions.length
      : 0;

    // Transaction volume by method
    const volumeByMethod = completedTransactions.reduce((acc, tx) => {
      acc[tx.method] = (acc[tx.method] || 0) + tx.amount;
      return acc;
    }, {} as Record<string, number>);

    // Transaction trends (daily)
    const trendsMap = new Map<string, { volume: number; value: number }>();
    completedTransactions.forEach(tx => {
      const date = tx.createdAt.toISOString().split('T')[0];
      const existing = trendsMap.get(date) || { volume: 0, value: 0 };
      existing.volume += 1;
      existing.value += tx.amount;
      trendsMap.set(date, existing);
    });

    const transactionTrends = Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      volume: data.volume,
      value: data.value
    }));

    return {
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      averageTransactionValue,
      transactionVolumeByMethod: volumeByMethod,
      transactionTrends
    };
  } catch (error) {
    logger.error('Failed to get transaction analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });

    return {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      averageTransactionValue: 0,
      transactionVolumeByMethod: {},
      transactionTrends: []
    };
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\services\ecommerce-analytics-service.ts