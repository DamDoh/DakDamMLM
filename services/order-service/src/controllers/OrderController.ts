import { Request, Response } from 'express';
import { OrderService } from '../services/OrderService';
import { recordOrderCreation, recordOrderStatusChange, recordOrderRevenue, recordCommissionTrigger, recordError } from '../utils/metrics';
import { logOrderCreation, logOrderStatusChange, logCommissionTrigger } from '../utils/logger';

export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  createOrder = async (req: Request, res: Response) => {
    try {
      const { userId, items, shippingAddress, billingAddress, paymentMethod } = (req as any).body;

      const order = await this.orderService.createOrder({
        userId,
        items,
        shippingAddress,
        billingAddress,
        paymentMethod,
      });

      // Record metrics
      recordOrderCreation('success', paymentMethod);
      recordOrderRevenue(order.totalAmount, (order as any).currency || 'USD');

      // Log order creation
      logOrderCreation(userId, order.id, order.totalAmount);

      // Trigger commission calculation
      await this.triggerCommissionCalculation(order);
      recordCommissionTrigger('order_creation');
      logCommissionTrigger(order.id, userId, 0); // Commission amount calculated separately

      (res as any).status(201).json({
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordOrderCreation('failed');
      recordError('order_creation', '/orders');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getOrder = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const order = await this.orderService.getOrderById(id);

      if (!order) {
        return (res as any).status(404).json({
          success: false,
          error: 'Order not found',
          timestamp: new Date().toISOString(),
          requestId: (res as any).get('X-Request-ID'),
        });
      }

      (res as any).json({
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('order_retrieval', '/orders/:id');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getOrders = async (req: Request, res: Response) => {
    try {
      const {
        userId,
        status,
        page = 1,
        limit = 10,
        sortBy = 'orderedAt',
        sortOrder = 'desc'
      } = (req as any).query;

      const result = await this.orderService.getOrders({
        userId: userId as string,
        status: status as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      (res as any).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('orders_listing', '/orders');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  updateOrder = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const updates = (req as any).body;

      const order = await this.orderService.updateOrder(id, updates);

      (res as any).json({
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('order_update', '/orders/:id');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  updateOrderStatus = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const { status, notes } = (req as any).body;

      const order = await this.orderService.getOrderById(id);
      if (!order) {
        return (res as any).status(404).json({
          success: false,
          error: 'Order not found',
          timestamp: new Date().toISOString(),
          requestId: (res as any).get('X-Request-ID'),
        });
      }

      const oldStatus = order.status;
      const updatedOrder = await this.orderService.updateOrderStatus(id, status, notes);

      // Record status change
      recordOrderStatusChange(oldStatus, status);
      logOrderStatusChange(id, oldStatus, status);

      (res as any).json({
        success: true,
        data: updatedOrder,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('order_status_update', '/orders/:id/status');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  cancelOrder = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const { reason } = (req as any).body;

      const order = await this.orderService.cancelOrder(id, reason);

      // Record status change
      recordOrderStatusChange(order.status, 'CANCELLED');
      logOrderStatusChange(id, order.status, 'CANCELLED');

      (res as any).json({
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('order_cancellation', '/orders/:id');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  shipOrder = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const { trackingNumber, carrier, shippingMethod } = (req as any).body;

      const shipment = await this.orderService.shipOrder(id, {
        trackingNumber,
        carrier,
        shippingMethod,
      });

      // Update order status
      await this.orderService.updateOrderStatus(id, 'SHIPPED');

      (res as any).json({
        success: true,
        data: shipment,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('order_shipping', '/orders/:id/ship');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  deliverOrder = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;

      const order = await this.orderService.deliverOrder(id);

      // Record status change
      recordOrderStatusChange('SHIPPED', 'DELIVERED');
      logOrderStatusChange(id, 'SHIPPED', 'DELIVERED');

      (res as any).json({
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('order_delivery', '/orders/:id/deliver');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getOrderSummary = async (req: Request, res: Response) => {
    try {
      const { period = 'month', startDate, endDate } = (req as any).query;

      const summary = await this.orderService.getOrderSummary({
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      (res as any).json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('order_summary', '/orders/analytics/summary');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getRevenueAnalytics = async (req: Request, res: Response) => {
    try {
      const { period = 'month', startDate, endDate } = (req as any).query;

      const analytics = await this.orderService.getRevenueAnalytics({
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      (res as any).json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('revenue_analytics', '/orders/analytics/revenue');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  // Additional methods for order items and refunds would go here
  getOrderItems = async (req: Request, res: Response) => {
    // Implementation for getting order items
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  addOrderItem = async (req: Request, res: Response) => {
    // Implementation for adding order item
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  updateOrderItem = async (req: Request, res: Response) => {
    // Implementation for updating order item
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  removeOrderItem = async (req: Request, res: Response) => {
    // Implementation for removing order item
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  processRefund = async (req: Request, res: Response) => {
    // Implementation for processing refund
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  getOrderRefunds = async (req: Request, res: Response) => {
    // Implementation for getting order refunds
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  private async triggerCommissionCalculation(order: any) {
    try {
      // This would typically call the commission service via HTTP or message queue
      // For now, we'll just log it
      console.log(`Triggering commission calculation for order ${order.id}`);
    } catch (error) {
      console.error('Failed to trigger commission calculation:', error);
    }
  }
}