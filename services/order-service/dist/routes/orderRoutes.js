"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRoutes = void 0;
const express_1 = __importDefault(require("express"));
const OrderController_1 = require("../controllers/OrderController");
const router = express_1.default.Router();
exports.orderRoutes = router;
const orderController = new OrderController_1.OrderController();
// Order CRUD operations
router.post('/', orderController.createOrder);
router.get('/:id', orderController.getOrder);
router.put('/:id', orderController.updateOrder);
router.delete('/:id', orderController.cancelOrder);
// Order listing and search
router.get('/', orderController.getOrders);
// Order status management
router.patch('/:id/status', orderController.updateOrderStatus);
router.post('/:id/ship', orderController.shipOrder);
router.post('/:id/deliver', orderController.deliverOrder);
// Order analytics
router.get('/analytics/summary', orderController.getOrderSummary);
router.get('/analytics/revenue', orderController.getRevenueAnalytics);
// Order items management
router.get('/:id/items', orderController.getOrderItems);
router.post('/:id/items', orderController.addOrderItem);
router.put('/:id/items/:itemId', orderController.updateOrderItem);
router.delete('/:id/items/:itemId', orderController.removeOrderItem);
// Refunds
router.post('/:id/refund', orderController.processRefund);
router.get('/:id/refunds', orderController.getOrderRefunds);
//# sourceMappingURL=orderRoutes.js.map