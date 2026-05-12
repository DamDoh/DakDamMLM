"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const database_1 = require("../config/database");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
class WalletService {
    async getWallet(userId) {
        // Try cache first
        let wallet = await cache_1.cacheService.getCachedWallet(userId);
        if (wallet) {
            return wallet;
        }
        // Fetch from database
        wallet = await database_1.paymentDb.wallet.findUnique({
            where: { userId },
        });
        if (!wallet) {
            // Create wallet if it doesn't exist
            wallet = await database_1.paymentDb.wallet.create({
                data: {
                    userId,
                    balance: 0,
                    currency: 'USD',
                    isActive: true,
                },
            });
        }
        // Cache the wallet
        await cache_1.cacheService.setCachedWallet(userId, wallet);
        return wallet;
    }
    async creditWallet(userId, transactionData) {
        const { amount, description, referenceId, referenceType } = transactionData;
        if (amount <= 0) {
            throw new Error('Credit amount must be positive');
        }
        // Get current wallet
        const wallet = await this.getWallet(userId);
        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + amount;
        // Update wallet balance
        const updatedWallet = await database_1.paymentDb.wallet.update({
            where: { userId },
            data: {
                balance: balanceAfter,
                updatedAt: new Date(),
            },
        });
        // Create wallet transaction record
        await database_1.paymentDb.walletTransaction.create({
            data: {
                walletId: updatedWallet.id,
                ...{ userId },
                type: 'CREDIT',
                amount,
                balanceBefore,
                balanceAfter,
                description,
                referenceId,
                referenceType,
            },
        });
        // Update cache
        await cache_1.cacheService.setCachedWallet(userId, updatedWallet);
        logger_1.logger.info('Wallet credited', {
            userId,
            amount,
            balanceBefore,
            balanceAfter,
            description,
        });
        return {
            wallet: updatedWallet,
            transaction: {
                type: 'CREDIT',
                amount,
                balanceBefore,
                balanceAfter,
                description,
            },
        };
    }
    async debitWallet(userId, transactionData) {
        const { amount, description, referenceId, referenceType } = transactionData;
        if (amount <= 0) {
            throw new Error('Debit amount must be positive');
        }
        // Get current wallet
        const wallet = await this.getWallet(userId);
        const balanceBefore = wallet.balance;
        if (balanceBefore < amount) {
            throw new Error('Insufficient wallet balance');
        }
        const balanceAfter = balanceBefore - amount;
        // Update wallet balance
        const updatedWallet = await database_1.paymentDb.wallet.update({
            where: { userId },
            data: {
                balance: balanceAfter,
                updatedAt: new Date(),
            },
        });
        // Create wallet transaction record
        await database_1.paymentDb.walletTransaction.create({
            data: {
                walletId: updatedWallet.id,
                ...{ userId },
                type: 'DEBIT',
                amount,
                balanceBefore,
                balanceAfter,
                description,
                referenceId,
                referenceType,
            },
        });
        // Update cache
        await cache_1.cacheService.setCachedWallet(userId, updatedWallet);
        logger_1.logger.info('Wallet debited', {
            userId,
            amount,
            balanceBefore,
            balanceAfter,
            description,
        });
        return {
            wallet: updatedWallet,
            transaction: {
                type: 'DEBIT',
                amount,
                balanceBefore,
                balanceAfter,
                description,
            },
        };
    }
    async getWalletTransactions(userId, page = 1, limit = 10, type) {
        const skip = (page - 1) * limit;
        const where = { userId };
        if (type)
            where.type = type;
        const [transactions, total] = await Promise.all([
            database_1.paymentDb.walletTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.paymentDb.walletTransaction.count({ where }),
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
    async getWalletBalance(userId) {
        const wallet = await this.getWallet(userId);
        return wallet.balance;
    }
    async holdAmount(userId, amount, description, referenceId) {
        // Get current wallet
        const wallet = await this.getWallet(userId);
        const balanceBefore = wallet.balance;
        if (balanceBefore < amount) {
            throw new Error('Insufficient wallet balance for hold');
        }
        // Update pending amount (if field exists in schema)
        const updatedWallet = await database_1.paymentDb.wallet.update({
            where: { userId },
            data: {
                ...{ pendingAmount: { increment: amount } },
                updatedAt: new Date(),
            },
        });
        // Create hold transaction record
        await database_1.paymentDb.walletTransaction.create({
            data: {
                walletId: updatedWallet.id,
                ...{ userId },
                type: 'HOLD',
                amount,
                balanceBefore,
                balanceAfter: balanceBefore, // Balance doesn't change for holds
                description,
                referenceId,
                referenceType: 'hold',
            },
        });
        // Update cache
        await cache_1.cacheService.setCachedWallet(userId, updatedWallet);
        logger_1.logger.info('Amount held in wallet', {
            userId,
            amount,
            description,
        });
        return updatedWallet;
    }
    async releaseHold(userId, amount, description, referenceId) {
        // Get current wallet
        const wallet = await this.getWallet(userId);
        if (wallet.pendingAmount < amount) {
            throw new Error('Insufficient pending amount to release');
        }
        // Update pending amount (if field exists in schema)
        const updatedWallet = await database_1.paymentDb.wallet.update({
            where: { userId },
            data: {
                ...{ pendingAmount: { decrement: amount } },
                updatedAt: new Date(),
            },
        });
        // Create release transaction record
        await database_1.paymentDb.walletTransaction.create({
            data: {
                walletId: updatedWallet.id,
                ...{ userId },
                type: 'RELEASE',
                amount,
                balanceBefore: wallet.balance,
                balanceAfter: wallet.balance, // Balance doesn't change for releases
                description,
                referenceId,
                referenceType: 'release',
            },
        });
        // Update cache
        await cache_1.cacheService.setCachedWallet(userId, updatedWallet);
        logger_1.logger.info('Hold released from wallet', {
            userId,
            amount,
            description,
        });
        return updatedWallet;
    }
    async getWalletAnalytics() {
        const [walletStats, transactionStats, topEarners] = await Promise.all([
            // Wallet statistics
            database_1.paymentDb.wallet.aggregate({
                _count: true,
                _sum: {
                    balance: true,
                },
            }),
            // Transaction statistics
            database_1.paymentDb.walletTransaction.groupBy({
                by: ['type'],
                _count: true,
                _sum: {
                    amount: true,
                },
            }),
            // Top earners (by balance)
            database_1.paymentDb.wallet.findMany({
                select: {
                    userId: true,
                    balance: true,
                },
                orderBy: {
                    balance: 'desc',
                },
                take: 10,
            }),
        ]);
        const transactionSummary = transactionStats.reduce((acc, stat) => {
            acc[stat.type] = {
                count: stat._count,
                volume: stat._sum.amount || 0,
            };
            return acc;
        }, {});
        return {
            totalWallets: walletStats._count || 0,
            totalBalance: walletStats._sum?.balance || 0,
            averageBalance: (walletStats._count && walletStats._count > 0) ? ((walletStats._sum?.balance || 0) / walletStats._count) : 0,
            transactionSummary,
            topEarners: topEarners.map((earner) => ({
                userId: earner.userId,
                currentBalance: earner.balance,
            })),
        };
    }
    async transferBetweenWallets(fromUserId, toUserId, amount, description) {
        if (amount <= 0) {
            throw new Error('Transfer amount must be positive');
        }
        // Check sender balance
        const senderWallet = await this.getWallet(fromUserId);
        if (senderWallet.balance < amount) {
            throw new Error('Insufficient balance for transfer');
        }
        // Debit from sender
        await this.debitWallet(fromUserId, {
            amount,
            description: `Transfer to ${toUserId}: ${description}`,
            referenceId: toUserId,
            referenceType: 'transfer_out',
        });
        // Credit to receiver
        await this.creditWallet(toUserId, {
            amount,
            description: `Transfer from ${fromUserId}: ${description}`,
            referenceId: fromUserId,
            referenceType: 'transfer_in',
        });
        logger_1.logger.info('Wallet transfer completed', {
            fromUserId,
            toUserId,
            amount,
            description,
        });
        return {
            fromWallet: await this.getWallet(fromUserId),
            toWallet: await this.getWallet(toUserId),
        };
    }
}
exports.WalletService = WalletService;
//# sourceMappingURL=WalletService.js.map