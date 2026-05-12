"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutController = void 0;
const PayoutService_1 = require("../services/PayoutService");
const metrics_1 = require("../utils/metrics");
const logger_1 = require("../utils/logger");
class PayoutController {
    constructor() {
        this.requestPayout = async (req, res) => {
            const body = req.body;
            const response = res;
            try {
                const { userId, amount, method, accountDetails } = body;
                if (!userId || !amount || !method || !accountDetails) {
                    return response.status(400).json({
                        success: false,
                        error: 'Missing required fields: userId, amount, method, accountDetails',
                        timestamp: new Date().toISOString(),
                    });
                }
                const payoutRequest = await this.payoutService.requestPayout({
                    userId,
                    amount,
                    method,
                    accountDetails,
                });
                (0, metrics_1.recordPayoutRequest)('PENDING', method);
                (0, logger_1.logPayoutRequest)(userId, amount, method);
                response.status(201).json({
                    success: true,
                    data: payoutRequest,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPayoutRequest)('FAILED', body.method || 'unknown');
                (0, metrics_1.recordPaymentError)('payout_request', 'database');
                response.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getPayoutRequests = async (req, res) => {
            const response = res;
            try {
                const { page = 1, limit = 10, status, userId } = req.query;
                const result = await this.payoutService.getPayoutRequests({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    status: status,
                    userId: userId,
                });
                response.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('payout_requests_listing', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getPayoutRequest = async (req, res) => {
            const response = res;
            try {
                const { id } = req.params;
                const payoutRequest = await this.payoutService.getPayoutRequestById(id);
                if (!payoutRequest) {
                    return response.status(404).json({
                        success: false,
                        error: 'Payout request not found',
                        timestamp: new Date().toISOString(),
                        requestId: response.getHeader('X-Request-ID') || undefined,
                    });
                }
                response.json({
                    success: true,
                    data: payoutRequest,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('payout_request_retrieval', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.approvePayout = async (req, res) => {
            const body = req.body;
            const response = res;
            try {
                const { id } = req.params;
                const { notes } = body;
                const payoutRequest = await this.payoutService.approvePayout(id, notes || undefined);
                (0, metrics_1.recordPayoutRequest)('APPROVED', payoutRequest.method);
                response.json({
                    success: true,
                    data: payoutRequest,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('payout_approval', 'database');
                response.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.rejectPayout = async (req, res) => {
            const body = req.body;
            const response = res;
            try {
                const { id } = req.params;
                const { reason } = body;
                if (!reason) {
                    return response.status(400).json({
                        success: false,
                        error: 'Missing required field: reason',
                        timestamp: new Date().toISOString(),
                    });
                }
                const payoutRequest = await this.payoutService.rejectPayout(id, reason);
                (0, metrics_1.recordPayoutRequest)('REJECTED', payoutRequest.method);
                response.json({
                    success: true,
                    data: payoutRequest,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('payout_rejection', 'database');
                response.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.processPayout = async (req, res) => {
            const response = res;
            try {
                const { id } = req.params;
                const payoutRequest = await this.payoutService.processPayout(id);
                (0, metrics_1.recordPayoutRequest)('COMPLETED', payoutRequest.method);
                response.json({
                    success: true,
                    data: payoutRequest,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('payout_processing', 'payment_provider');
                response.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.processCommissionPayout = async (req, res) => {
            const body = req.body;
            const response = res;
            try {
                const { commissionId } = req.params;
                const { userId, amount } = body;
                if (!userId || !amount) {
                    return response.status(400).json({
                        success: false,
                        error: 'Missing required fields: userId, amount',
                        timestamp: new Date().toISOString(),
                    });
                }
                const result = await this.payoutService.processCommissionPayout(commissionId, userId, amount);
                (0, metrics_1.recordCommissionPayout)('success');
                (0, logger_1.logCommissionPayout)(userId, commissionId, amount);
                response.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordCommissionPayout)('failed');
                (0, metrics_1.recordPaymentError)('commission_payout', 'wallet');
                response.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getPayoutAnalytics = async (req, res) => {
            const response = res;
            try {
                const { period = 'month', startDate, endDate } = req.query;
                const analytics = await this.payoutService.getPayoutAnalytics({
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                response.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('payout_analytics', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.payoutService = new PayoutService_1.PayoutService();
    }
}
exports.PayoutController = PayoutController;
//# sourceMappingURL=PayoutController.js.map