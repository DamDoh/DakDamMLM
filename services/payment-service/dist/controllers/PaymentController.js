"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const PaymentService_1 = require("../services/PaymentService");
const metrics_1 = require("../utils/metrics");
const logger_1 = require("../utils/logger");
class PaymentController {
    constructor() {
        this.processPayment = async (req, res) => {
            const body = req.body;
            try {
                const { userId, orderId, amount, currency = 'USD', method, provider, paymentData } = body;
                if (!userId || !amount || !method || !provider) {
                    const response = res;
                    return response.status(400).json({
                        success: false,
                        error: 'Missing required fields: userId, amount, method, provider',
                        timestamp: new Date().toISOString(),
                    });
                }
                const transaction = await this.paymentService.processPayment({
                    userId,
                    orderId,
                    amount,
                    currency,
                    method,
                    provider,
                    paymentData,
                });
                // Record metrics
                (0, metrics_1.recordPaymentTransaction)('success', method, provider);
                (0, logger_1.logPaymentProcessing)(userId, amount, method, 'completed');
                const response = res;
                response.status(201).json({
                    success: true,
                    data: transaction,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentTransaction)('failed', body.method || 'unknown', body.provider || 'unknown');
                (0, metrics_1.recordPaymentError)('payment_processing', body.provider || 'unknown');
                (0, logger_1.logPaymentFailure)(body.userId || 'unknown', body.amount || 0, error.message);
                const response = res;
                response.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
        };
        this.processRefund = async (req, res) => {
            const body = req.body;
            const response = res;
            try {
                const { transactionId } = req.params;
                const { amount, reason } = body;
                if (!amount || !reason) {
                    return response.status(400).json({
                        success: false,
                        error: 'Missing required fields: amount, reason',
                        timestamp: new Date().toISOString(),
                    });
                }
                const refund = await this.paymentService.processRefund(transactionId, amount, reason);
                (0, metrics_1.recordRefundRequest)('completed');
                (0, logger_1.logPaymentProcessing)(refund.userId, amount, 'refund', 'completed');
                response.json({
                    success: true,
                    data: refund,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordRefundRequest)('failed');
                (0, metrics_1.recordPaymentError)('refund_processing', 'unknown');
                (0, logger_1.logPaymentFailure)('unknown', body.amount || 0, error.message);
                response.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
        };
        this.getTransactions = async (req, res) => {
            const response = res;
            try {
                const { page = 1, limit = 10, status, type, method, startDate, endDate } = req.query;
                const result = await this.paymentService.getTransactions({
                    page: parseInt((page || '1')),
                    limit: parseInt((limit || '10')),
                    status: status,
                    type: type,
                    method: method,
                    startDate: startDate,
                    endDate: endDate,
                });
                response.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('transaction_listing', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
        };
        this.getTransaction = async (req, res) => {
            const response = res;
            try {
                const { id } = req.params;
                const transaction = await this.paymentService.getTransactionById(id);
                if (!transaction) {
                    return response.status(404).json({
                        success: false,
                        error: req.t ? req.t('errors.transaction_not_found') : 'Transaction not found',
                        timestamp: new Date().toISOString(),
                        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                    });
                }
                response.json({
                    success: true,
                    data: transaction,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('transaction_retrieval', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
        };
        this.getUserTransactions = async (req, res) => {
            const response = res;
            try {
                const { userId } = req.params;
                const { page = 1, limit = 10, type } = req.query;
                if (!userId) {
                    return response.status(400).json({
                        success: false,
                        error: 'Missing required parameter: userId',
                        timestamp: new Date().toISOString(),
                    });
                }
                const result = await this.paymentService.getUserTransactions(userId, parseInt((page || '1')), parseInt((limit || '10')), type);
                response.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('user_transactions', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
        };
        this.getPaymentAnalytics = async (req, res) => {
            const response = res;
            try {
                const { period = 'month', startDate, endDate } = req.query;
                const analytics = await this.paymentService.getPaymentAnalytics({
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                response.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('analytics_generation', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
        };
        this.getRevenueAnalytics = async (req, res) => {
            const response = res;
            try {
                const { period = 'month', startDate, endDate } = req.query;
                const analytics = await this.paymentService.getRevenueAnalytics({
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                response.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('revenue_analytics', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
                });
            }
        };
        this.paymentService = new PaymentService_1.PaymentService();
    }
}
exports.PaymentController = PaymentController;
//# sourceMappingURL=PaymentController.js.map