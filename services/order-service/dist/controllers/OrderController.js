"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const OrderService_1 = require("../services/OrderService");
const metrics_1 = require("../utils/metrics");
const logger_1 = require("../utils/logger");
class OrderController {
    constructor() {
        this.createOrder = async (req, res) => {
            try {
                const { userId, items, shippingAddress, billingAddress, paymentMethod } = req.body;
                const order = await this.orderService.createOrder({
                    userId,
                    items,
                    shippingAddress,
                    billingAddress,
                    paymentMethod,
                });
                // Record metrics
                (0, metrics_1.recordOrderCreation)('success', paymentMethod);
                (0, metrics_1.recordOrderRevenue)(order.totalAmount, order.currency || 'USD');
                // Log order creation
                (0, logger_1.logOrderCreation)(userId, order.id, order.totalAmount);
                // Trigger commission calculation
                await this.triggerCommissionCalculation(order);
                (0, metrics_1.recordCommissionTrigger)('order_creation');
                (0, logger_1.logCommissionTrigger)(order.id, userId, 0); // Commission amount calculated separately
                res.status(201).json({
                    success: true,
                    data: order,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordOrderCreation)('failed');
                (0, metrics_1.recordError)('order_creation', '/orders');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getOrder = async (req, res) => {
            try {
                const { id } = req.params;
                const order = await this.orderService.getOrderById(id);
                if (!order) {
                    return res.status(404).json({
                        success: false,
                        error: 'Order not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                res.json({
                    success: true,
                    data: order,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('order_retrieval', '/orders/:id');
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getOrders = async (req, res) => {
            try {
                const { userId, status, page = 1, limit = 10, sortBy = 'orderedAt', sortOrder = 'desc' } = req.query;
                const result = await this.orderService.getOrders({
                    userId: userId,
                    status: status,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    sortBy: sortBy,
                    sortOrder: sortOrder,
                });
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('orders_listing', '/orders');
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.updateOrder = async (req, res) => {
            try {
                const { id } = req.params;
                const updates = req.body;
                const order = await this.orderService.updateOrder(id, updates);
                res.json({
                    success: true,
                    data: order,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('order_update', '/orders/:id');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.updateOrderStatus = async (req, res) => {
            try {
                const { id } = req.params;
                const { status, notes } = req.body;
                const order = await this.orderService.getOrderById(id);
                if (!order) {
                    return res.status(404).json({
                        success: false,
                        error: 'Order not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                const oldStatus = order.status;
                const updatedOrder = await this.orderService.updateOrderStatus(id, status, notes);
                // Record status change
                (0, metrics_1.recordOrderStatusChange)(oldStatus, status);
                (0, logger_1.logOrderStatusChange)(id, oldStatus, status);
                res.json({
                    success: true,
                    data: updatedOrder,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('order_status_update', '/orders/:id/status');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.cancelOrder = async (req, res) => {
            try {
                const { id } = req.params;
                const { reason } = req.body;
                const order = await this.orderService.cancelOrder(id, reason);
                // Record status change
                (0, metrics_1.recordOrderStatusChange)(order.status, 'CANCELLED');
                (0, logger_1.logOrderStatusChange)(id, order.status, 'CANCELLED');
                res.json({
                    success: true,
                    data: order,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('order_cancellation', '/orders/:id');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.shipOrder = async (req, res) => {
            try {
                const { id } = req.params;
                const { trackingNumber, carrier, shippingMethod } = req.body;
                const shipment = await this.orderService.shipOrder(id, {
                    trackingNumber,
                    carrier,
                    shippingMethod,
                });
                // Update order status
                await this.orderService.updateOrderStatus(id, 'SHIPPED');
                res.json({
                    success: true,
                    data: shipment,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('order_shipping', '/orders/:id/ship');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.deliverOrder = async (req, res) => {
            try {
                const { id } = req.params;
                const order = await this.orderService.deliverOrder(id);
                // Record status change
                (0, metrics_1.recordOrderStatusChange)('SHIPPED', 'DELIVERED');
                (0, logger_1.logOrderStatusChange)(id, 'SHIPPED', 'DELIVERED');
                res.json({
                    success: true,
                    data: order,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('order_delivery', '/orders/:id/deliver');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getOrderSummary = async (req, res) => {
            try {
                const { period = 'month', startDate, endDate } = req.query;
                const summary = await this.orderService.getOrderSummary({
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                res.json({
                    success: true,
                    data: summary,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('order_summary', '/orders/analytics/summary');
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getRevenueAnalytics = async (req, res) => {
            try {
                const { period = 'month', startDate, endDate } = req.query;
                const analytics = await this.orderService.getRevenueAnalytics({
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                res.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('revenue_analytics', '/orders/analytics/revenue');
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        // Additional methods for order items and refunds would go here
        this.getOrderItems = async (req, res) => {
            // Implementation for getting order items
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.addOrderItem = async (req, res) => {
            // Implementation for adding order item
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.updateOrderItem = async (req, res) => {
            // Implementation for updating order item
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.removeOrderItem = async (req, res) => {
            // Implementation for removing order item
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.processRefund = async (req, res) => {
            // Implementation for processing refund
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.getOrderRefunds = async (req, res) => {
            // Implementation for getting order refunds
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.orderService = new OrderService_1.OrderService();
    }
    async triggerCommissionCalculation(order) {
        try {
            // This would typically call the commission service via HTTP or message queue
            // For now, we'll just log it
            console.log(`Triggering commission calculation for order ${order.id}`);
        }
        catch (error) {
            console.error('Failed to trigger commission calculation:', error);
        }
    }
}
exports.OrderController = OrderController;
//# sourceMappingURL=OrderController.js.map