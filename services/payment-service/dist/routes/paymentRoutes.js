"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const PaymentController_1 = require("../controllers/PaymentController");
const router = express_1.default.Router();
exports.paymentRoutes = router;
const paymentController = new PaymentController_1.PaymentController();
// Payment processing
router.post('/process', paymentController.processPayment);
router.post('/refund/:transactionId', paymentController.processRefund);
// Transaction management
router.get('/transactions', paymentController.getTransactions);
router.get('/transactions/:id', paymentController.getTransaction);
router.get('/transactions/user/:userId', paymentController.getUserTransactions);
// Payment analytics
router.get('/analytics/summary', paymentController.getPaymentAnalytics);
router.get('/analytics/revenue', paymentController.getRevenueAnalytics);
//# sourceMappingURL=paymentRoutes.js.map