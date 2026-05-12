import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface ProductCreationData {
  name: string;
  description?: string;
  price: number;
  pv: number;
  bv: number;
  cv: number;
  category: string;
  membershipLevel?: string;
  isActive?: boolean;
  autoShipEnabled?: boolean;
}

export interface SubscriptionData {
  userId: string;
  productId: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
}

export class ProductEngine {
  /**
   * Create new MLM product
   */
  static async createProduct(data: ProductCreationData): Promise<any> {
    try {
      const product = await prisma.mlmProduct.create({
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          pv: data.pv,
          bv: data.bv,
          cv: data.cv,
          category: data.category,
          membershipLevel: data.membershipLevel,
          isActive: data.isActive ?? true,
          autoShipEnabled: data.autoShipEnabled ?? false
        }
      });

      logger.info('Created MLM product', {
        productId: product.id,
        name: data.name,
        category: data.category
      });

      return product;
    } catch (error) {
      logger.error('Error creating MLM product:', error);
      throw error;
    }
  }

  /**
   * Get products by category or membership level
   */
  static async getProducts(filters: {
    category?: string;
    membershipLevel?: string;
    isActive?: boolean;
    autoShipEnabled?: boolean;
  } = {}): Promise<any[]> {
    try {
      const where: any = {};

      if (filters.category) where.category = filters.category;
      if (filters.membershipLevel) where.membershipLevel = filters.membershipLevel;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.autoShipEnabled !== undefined) where.autoShipEnabled = filters.autoShipEnabled;

      const products = await prisma.mlmProduct.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return products;
    } catch (error) {
      logger.error('Error getting MLM products:', error);
      return [];
    }
  }

  /**
   * Update product
   */
  static async updateProduct(productId: string, updates: Partial<ProductCreationData>): Promise<any> {
    try {
      const product = await prisma.mlmProduct.update({
        where: { id: productId },
        data: updates
      });

      logger.info('Updated MLM product', {
        productId,
        updates
      });

      return product;
    } catch (error) {
      logger.error('Error updating MLM product:', error);
      throw error;
    }
  }

  /**
   * Get product volume metrics
   */
  static async getProductMetrics(productId: string): Promise<{
    totalSold: number;
    totalRevenue: number;
    totalPV: number;
    totalBV: number;
    totalCV: number;
  }> {
    try {
      const metrics = await prisma.mlmProduct.findUnique({
        where: { id: productId },
        include: {
          orders: {
            include: {
              items: true
            }
          },
          subscriptions: {
            where: { status: 'active' }
          }
        }
      });

      if (!metrics) {
        throw new Error('Product not found');
      }

      let totalSold = 0;
      let totalRevenue = 0;
      let totalPV = 0;
      let totalBV = 0;
      let totalCV = 0;

      // Calculate from orders
      for (const order of metrics.orders) {
        for (const item of order.items) {
          if (item.productId === productId) {
            totalSold += item.quantity;
            totalRevenue += item.price * item.quantity;
            totalPV += (metrics.pv || 0) * item.quantity;
            totalBV += (metrics.bv || 0) * item.quantity;
            totalCV += (metrics.cv || 0) * item.quantity;
          }
        }
      }

      // Add active subscriptions
      const activeSubs = metrics.subscriptions.length;
      totalSold += activeSubs;
      totalRevenue += activeSubs * metrics.price;

      return {
        totalSold,
        totalRevenue,
        totalPV,
        totalBV,
        totalCV
      };
    } catch (error) {
      logger.error('Error getting product metrics:', error);
      throw error;
    }
  }
}

export class SubscriptionEngine {
  /**
   * Create new subscription
   */
  static async createSubscription(data: SubscriptionData): Promise<any> {
    try {
      const product = await prisma.mlmProduct.findUnique({
        where: { id: data.productId }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.autoShipEnabled) {
        throw new Error('Product does not support auto-ship subscriptions');
      }

      const nextBilling = this.calculateNextBilling(new Date(), data.frequency);

      const subscription = await prisma.subscription.create({
        data: {
          userId: data.userId,
          productId: data.productId,
          frequency: data.frequency,
          nextBilling,
          amount: product.price,
          pv: product.pv,
          bv: product.bv,
          cv: product.cv
        }
      });

      logger.info('Created subscription', {
        subscriptionId: subscription.id,
        userId: data.userId,
        productId: data.productId,
        frequency: data.frequency
      });

      return subscription;
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Process subscription billing cycle
   */
  static async processSubscriptionBilling(subscriptionId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { product: true, user: true }
      });

      if (!subscription || subscription.status !== 'active') {
        return;
      }

      if (subscription.nextBilling > new Date()) {
        return; // Not due yet
      }

      // Create order for this billing cycle
      const order = await prisma.order.create({
        data: {
          userId: subscription.userId,
          totalAmount: subscription.amount,
          status: 'completed' // Auto-processed subscription
        }
      });

      // Add order item
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: subscription.productId,
          quantity: 1,
          price: subscription.amount,
          pv: subscription.pv
        }
      });

      // Update subscription next billing date
      const nextBilling = this.calculateNextBilling(subscription.nextBilling, subscription.frequency);

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { nextBilling }
      });

      // Process commissions for this subscription order
      const { PVMatchingService } = await import('../pv-matching-service');
      const commissionResult = await PVMatchingService.calculateMLMCommissions(order.id);
      await PVMatchingService.processCommissions(commissionResult);

      logger.info('Processed subscription billing', {
        subscriptionId,
        userId: subscription.userId,
        amount: subscription.amount,
        nextBilling
      });

    } catch (error) {
      logger.error('Error processing subscription billing:', error);
      throw error;
    }
  }

  /**
   * Process all due subscription billings
   */
  static async processAllDueSubscriptions(): Promise<number> {
    try {
      const dueSubscriptions = await prisma.subscription.findMany({
        where: {
          status: 'active',
          nextBilling: { lte: new Date() }
        },
        select: { id: true }
      });

      let processedCount = 0;

      for (const subscription of dueSubscriptions) {
        try {
          await this.processSubscriptionBilling(subscription.id);
          processedCount++;
        } catch (error) {
          logger.error(`Error processing subscription ${subscription.id}:`, error);
        }
      }

      logger.info('Processed due subscriptions', { processedCount });
      return processedCount;

    } catch (error) {
      logger.error('Error processing due subscriptions:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(subscriptionId: string, userId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          userId,
          status: 'active'
        }
      });

      if (!subscription) {
        throw new Error('Active subscription not found');
      }

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date()
        }
      });

      logger.info('Cancelled subscription', {
        subscriptionId,
        userId
      });

    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Get user's active subscriptions
   */
  static async getUserSubscriptions(userId: string): Promise<any[]> {
    try {
      const subscriptions = await prisma.subscription.findMany({
        where: {
          userId,
          status: 'active'
        },
        include: {
          product: true
        },
        orderBy: { nextBilling: 'asc' }
      });

      return subscriptions;
    } catch (error) {
      logger.error('Error getting user subscriptions:', error);
      return [];
    }
  }

  /**
   * Calculate next billing date
   */
  private static calculateNextBilling(fromDate: Date, frequency: string): Date {
    const nextDate = new Date(fromDate);

    switch (frequency) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    return nextDate;
  }
}

export class OrderProcessingEngine {
  /**
   * Process MLM order and calculate commissions
   */
  static async processMLMOrder(orderId: string): Promise<{
    order: any;
    commissions: any;
    volumeUpdates: any;
  }> {
    try {
      // Get order with MLM product details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true
            }
          },
          mlmProduct: true,
          user: true
        }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Calculate and process commissions
      const { PVMatchingService } = await import('../pv-matching-service');
      const commissionResult = await PVMatchingService.calculateMLMCommissions(orderId);
      await PVMatchingService.processCommissions(commissionResult);

      // Update genealogy volumes
      const volumeUpdates = await this.updateGenealogyVolumes(order);

      // Check for rank advancements
      const { RankAdvancementEngine } = await import('./rank-advancement-engine');
      const advancementResult = await RankAdvancementEngine.checkRankAdvancement(order.userId);

      if (advancementResult.qualified) {
        await RankAdvancementEngine.processRankAdvancement(order.userId, advancementResult);
      }

      // Create notifications
      const { NotificationEngine } = await import('./training-notification-engine');
      await NotificationEngine.createNotification({
        userId: order.userId,
        type: 'order_processed',
        title: 'Order Processed Successfully',
        message: `Your order #${order.orderId} has been processed and commissions calculated.`,
        data: {
          orderId: order.id,
          totalAmount: order.totalAmount,
          commissionsEarned: commissionResult.totalCommissions
        }
      });

      logger.info('Processed MLM order', {
        orderId,
        userId: order.userId,
        totalAmount: order.totalAmount,
        commissions: commissionResult.totalCommissions
      });

      return {
        order,
        commissions: commissionResult,
        volumeUpdates
      };

    } catch (error) {
      logger.error('Error processing MLM order:', error);
      throw error;
    }
  }

  /**
   * Update genealogy volumes after order
   */
  private static async updateGenealogyVolumes(order: any): Promise<any> {
    try {
      let totalPV = 0;
      let totalBV = 0;

      // Calculate volumes from order items
      for (const item of order.items) {
        const product = item.product;
        totalPV += (product.pv || 0) * item.quantity;
        totalBV += (product.bv || 0) * item.quantity;
      }

      // Update user's genealogy node
      const genealogy = await prisma.genealogyTree.findUnique({
        where: { userId: order.userId }
      });

      if (genealogy) {
        await prisma.genealogyTree.update({
          where: { userId: order.userId },
          data: {
            leftVolume: {
              increment: totalPV // Simplified - would need to determine left/right placement
            },
            rightVolume: {
              increment: totalBV
            },
            totalVolume: {
              increment: totalPV + totalBV
            }
          }
        });

        // Update upline volumes
        await this.updateUplineVolumes(order.userId, totalPV, totalBV);
      }

      return { totalPV, totalBV };
    } catch (error) {
      logger.error('Error updating genealogy volumes:', error);
      throw error;
    }
  }

  /**
   * Update upline genealogy volumes
   */
  private static async updateUplineVolumes(userId: string, pv: number, bv: number): Promise<void> {
    let currentId = userId;

    while (currentId) {
      const node = await prisma.genealogyTree.findUnique({
        where: { userId: currentId },
        select: { sponsorId: true }
      });

      if (!node?.sponsorId) break;

      await prisma.genealogyTree.update({
        where: { userId: node.sponsorId },
        data: {
          totalVolume: { increment: pv + bv }
        }
      });

      currentId = node.sponsorId;
    }
  }
}