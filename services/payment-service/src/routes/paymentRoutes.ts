import express from 'express';
import { PaymentController } from '../controllers/PaymentController';

const router = express.Router();
const paymentController = new PaymentController();

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

export { router as paymentRoutes };