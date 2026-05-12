"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const database_1 = require("../config/database");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
class PaymentService {
    async processPayment(paymentData) {
        const { userId, orderId, commissionId, amount, currency, method, provider, paymentData: providerData } = paymentData;
        const transactionId = this.generateTransactionId();
        try {
            // Create transaction record
            const transaction = await database_1.paymentDb.paymentTransaction.create({
                data: {
                    transactionId,
                    userId,
                    orderId,
                    commissionId,
                    type: orderId ? 'PAYMENT' : commissionId ? 'COMMISSION' : 'DEPOSIT',
                    method: method,
                    provider: provider,
                    amount,
                    currency,
                    status: 'PROCESSING',
                    metadata: providerData,
                },
            });
            // Process payment with provider (simplified - would integrate with actual payment providers)
            const processedTransaction = await this.processWithProvider(transaction, providerData);
            // Cache the transaction
            await cache_1.cacheService.setCachedTransaction(transactionId, processedTransaction);
            // Invalidate user transactions cache
            await cache_1.cacheService.invalidateUserTransactionsCache(userId);
            logger_1.logger.info('Payment processed successfully', {
                transactionId,
                userId,
                amount,
                method,
                provider,
                status: processedTransaction.status,
            });
            return processedTransaction;
        }
        catch (error) {
            // Update transaction status to failed
            await database_1.paymentDb.paymentTransaction.updateMany({
                where: { transactionId },
                data: {
                    status: 'FAILED',
                    failedAt: new Date(),
                    failureReason: error.message,
                },
            });
            logger_1.logger.error('Payment processing failed', {
                transactionId,
                userId,
                amount,
                error: error.message,
            });
            throw error;
        }
    }
    async processRefund(transactionId, amount, reason) {
        const originalTransaction = await database_1.paymentDb.paymentTransaction.findUnique({
            where: { id: transactionId },
        });
        if (!originalTransaction) {
            throw new Error('Original transaction not found');
        }
        if (originalTransaction.status !== 'COMPLETED') {
            throw new Error('Can only refund completed transactions');
        }
        if (amount > originalTransaction.netAmount) {
            throw new Error('Refund amount cannot exceed original transaction amount');
        }
        // Create refund record
        const refund = await database_1.paymentDb.refund.create({
            data: {
                transactionId,
                amount,
                reason,
                status: 'PROCESSING',
            },
        });
        try {
            // Process refund with provider (simplified)
            const processedRefund = await this.processRefundWithProvider(refund, originalTransaction);
            // Update original transaction
            await database_1.paymentDb.paymentTransaction.update({
                where: { id: transactionId },
                data: {
                    refundedAt: new Date(),
                    refundAmount: {
                        increment: amount,
                    },
                    status: amount >= originalTransaction.netAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                },
            });
            // Invalidate caches
            await cache_1.cacheService.invalidateTransactionCache(transactionId);
            await cache_1.cacheService.invalidateUserTransactionsCache(originalTransaction.userId);
            logger_1.logger.info('Refund processed successfully', {
                transactionId,
                refundId: refund.id,
                amount,
                reason,
            });
            return processedRefund;
        }
        catch (error) {
            // Update refund status to failed
            await database_1.paymentDb.refund.update({
                where: { id: refund.id },
                data: {
                    status: 'FAILED',
                    failedAt: new Date(),
                    failureReason: error.message,
                },
            });
            throw error;
        }
    }
    async getTransactions(query) {
        const { page, limit, status, type, method, startDate, endDate } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        if (method)
            where.method = method;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [transactions, total] = await Promise.all([
            database_1.paymentDb.paymentTransaction.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            memberId: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.paymentDb.paymentTransaction.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async getTransactionById(transactionId) {
        // Try cache first
        let transaction = await cache_1.cacheService.getCachedTransaction(transactionId);
        if (transaction) {
            return transaction;
        }
        // Fetch from database
        transaction = await database_1.paymentDb.paymentTransaction.findUnique({
            where: { id: transactionId },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        memberId: true,
                    },
                },
                refunds: true,
            },
        });
        if (transaction) {
            // Cache for future requests
            await cache_1.cacheService.setCachedTransaction(transactionId, transaction);
        }
        return transaction;
    }
    async getUserTransactions(userId, page = 1, limit = 10, type) {
        const skip = (page - 1) * limit;
        const where = { userId };
        if (type)
            where.type = type;
        const [transactions, total] = await Promise.all([
            database_1.paymentDb.paymentTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.paymentDb.paymentTransaction.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async getPaymentAnalytics(query) {
        const { startDate, endDate } = this.getDateRange(query);
        const [transactionStats, methodStats, providerStats] = await Promise.all([
            // Transaction status distribution
            database_1.paymentDb.paymentTransaction.groupBy({
                by: ['status'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                _count: true,
            }),
            // Payment method distribution
            database_1.paymentDb.paymentTransaction.groupBy({
                by: ['method'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                    status: 'COMPLETED',
                },
                _count: true,
                _sum: {
                    amount: true,
                },
            }),
            // Provider revenue
            database_1.paymentDb.paymentTransaction.groupBy({
                by: ['provider'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                    status: 'COMPLETED',
                },
                _sum: {
                    netAmount: true,
                },
            }),
        ]);
        const statusDistribution = transactionStats.reduce((acc, stat) => {
            acc[stat.status] = stat._count;
            return acc;
        }, {});
        const paymentMethodDistribution = methodStats.reduce((acc, stat) => {
            acc[stat.method] = {
                count: stat._count,
                volume: stat._sum.amount || 0,
            };
            return acc;
        }, {});
        const revenueByProvider = providerStats.reduce((acc, stat) => {
            acc[stat.provider] = stat._sum.netAmount || 0;
            return acc;
        }, {});
        // Calculate success rate
        const totalTransactions = transactionStats.reduce((sum, stat) => sum + stat._count, 0);
        const successfulTransactions = statusDistribution['COMPLETED'] || 0;
        const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;
        return {
            period: query.period,
            startDate,
            endDate,
            totalTransactions,
            totalVolume: methodStats.reduce((sum, stat) => sum + (stat._sum.amount || 0), 0),
            averageTransactionValue: totalTransactions > 0
                ? methodStats.reduce((sum, stat) => sum + (stat._sum.amount || 0), 0) / totalTransactions
                : 0,
            successRate,
            statusDistribution,
            paymentMethodDistribution,
            revenueByProvider,
        };
    }
    async getRevenueAnalytics(query) {
        const { startDate, endDate } = this.getDateRange(query);
        // Revenue by period (daily/weekly/monthly)
        const revenueByPeriod = await database_1.paymentDb.$queryRaw `
      SELECT
        DATE_TRUNC('day', "createdAt") as period,
        COUNT(*) as transaction_count,
        SUM("netAmount") as revenue,
        SUM("fees") as fees
      FROM payment_transactions
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        AND status = 'COMPLETED'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY period
    `;
        // Top paying users
        const topPayingUsers = await database_1.paymentDb.paymentTransaction.groupBy({
            by: ['userId'],
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
                status: 'COMPLETED',
                type: 'PAYMENT',
            },
            _sum: {
                amount: true,
            },
            _count: true,
            orderBy: {
                _sum: {
                    amount: 'desc',
                },
            },
            take: 10,
        });
        return {
            period: query.period,
            startDate,
            endDate,
            revenueByPeriod,
            topPayingUsers: topPayingUsers.map((user) => ({
                userId: user.userId,
                totalPaid: user._sum.amount || 0,
                transactionCount: user._count,
            })),
        };
    }
    generateTransactionId() {
        return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }
    async processWithProvider(transaction, paymentData) {
        // Simulate payment processing with different providers
        // In a real implementation, this would integrate with Stripe, PayPal, etc.
        try {
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 100));
            // Simulate success/failure (90% success rate)
            const isSuccess = Math.random() > 0.1;
            if (isSuccess) {
                return await database_1.paymentDb.paymentTransaction.update({
                    where: { id: transaction.id },
                    data: {
                        status: 'COMPLETED',
                        processedAt: new Date(),
                        externalId: `ext_${transaction.transactionId}`,
                        fees: transaction.amount * 0.029 + 0.30, // 2.9% + $0.30
                        netAmount: transaction.amount - (transaction.amount * 0.029 + 0.30),
                    },
                });
            }
            else {
                throw new Error('Payment processing failed');
            }
        }
        catch (error) {
            throw new Error(`Payment provider error: ${error.message}`);
        }
    }
    async processRefundWithProvider(refund, originalTransaction) {
        // Simulate refund processing
        try {
            await new Promise(resolve => setTimeout(resolve, 50));
            return await database_1.paymentDb.refund.update({
                where: { id: refund.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    externalRefundId: `ref_${refund.id}`,
                },
            });
        }
        catch (error) {
            throw new Error(`Refund processing failed: ${error.message}`);
        }
    }
    getDateRange(query) {
        const now = new Date();
        let startDate;
        let endDate = now;
        if (query.startDate && query.endDate) {
            startDate = new Date(query.startDate);
            endDate = new Date(query.endDate);
        }
        else {
            switch (query.period) {
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'quarter':
                    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
                    startDate = new Date(now.getFullYear(), quarterStart, 1);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                default:
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }
        }
        return { startDate, endDate };
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=PaymentService.js.map