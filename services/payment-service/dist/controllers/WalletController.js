"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletController = void 0;
const WalletService_1 = require("../services/WalletService");
const metrics_1 = require("../utils/metrics");
const logger_1 = require("../utils/logger");
class WalletController {
    constructor() {
        this.getWallet = async (req, res) => {
            const response = res;
            try {
                const { userId } = req.params;
                const wallet = await this.walletService.getWallet(userId);
                response.json({
                    success: true,
                    data: wallet,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('wallet_retrieval', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.creditWallet = async (req, res) => {
            const body = req.body;
            const response = res;
            try {
                const { userId } = req.params;
                const { amount, description, referenceId, referenceType } = body;
                if (!amount || !description) {
                    return response.status(400).json({
                        success: false,
                        error: 'Missing required fields: amount, description',
                        timestamp: new Date().toISOString(),
                    });
                }
                const result = await this.walletService.creditWallet(userId, {
                    amount,
                    description,
                    referenceId,
                    referenceType,
                });
                (0, logger_1.logWalletTransaction)(userId, 'CREDIT', amount, result.transaction.balanceAfter || result.wallet.balance);
                response.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('wallet_credit', 'database');
                response.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.debitWallet = async (req, res) => {
            const body = req.body;
            const response = res;
            try {
                const { userId } = req.params;
                const { amount, description, referenceId, referenceType } = body;
                if (!amount || !description) {
                    return response.status(400).json({
                        success: false,
                        error: 'Missing required fields: amount, description',
                        timestamp: new Date().toISOString(),
                    });
                }
                const result = await this.walletService.debitWallet(userId, {
                    amount,
                    description,
                    referenceId,
                    referenceType,
                });
                (0, logger_1.logWalletTransaction)(userId, 'DEBIT', amount, result.transaction.balanceAfter || result.wallet.balance);
                response.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('wallet_debit', 'database');
                response.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getWalletTransactions = async (req, res) => {
            const response = res;
            try {
                const { userId } = req.params;
                const { page = 1, limit = 10, type } = req.query;
                const result = await this.walletService.getWalletTransactions(userId, parseInt(page), parseInt(limit), type);
                response.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('wallet_transactions', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getWalletBalance = async (req, res) => {
            const response = res;
            try {
                const { userId } = req.params;
                const balance = await this.walletService.getWalletBalance(userId);
                response.json({
                    success: true,
                    data: { balance },
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('wallet_balance', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getWalletAnalytics = async (req, res) => {
            const response = res;
            try {
                const analytics = await this.walletService.getWalletAnalytics();
                response.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, metrics_1.recordPaymentError)('wallet_analytics', 'database');
                response.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.walletService = new WalletService_1.WalletService();
    }
}
exports.WalletController = WalletController;
//# sourceMappingURL=WalletController.js.map