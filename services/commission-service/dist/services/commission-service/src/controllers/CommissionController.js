"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionController = void 0;
const CommissionService_1 = require("../services/CommissionService");
const PayoutService_1 = require("../services/PayoutService");
const BonusService_1 = require("../services/BonusService");
const RuleService_1 = require("../services/RuleService");
const metrics_1 = require("../utils/metrics");
const logger_1 = require("../utils/logger");
class CommissionController {
    constructor() {
        this.calculateCommissions = async (req, res) => {
            try {
                const { orderId } = req.body;
                const commissions = await this.commissionService.calculateCommissions(orderId);
                // Record metrics
                commissions.forEach(commission => {
                    (0, metrics_1.recordCommissionCalculated)(commission.type, commission.level);
                    (0, metrics_1.recordCommissionAmount)(commission.amount, commission.type);
                    (0, logger_1.logCommissionCalculated)(commission.userId, orderId, commission.amount, commission.type);
                });
                // Use Response type directly - Next.js has issues with express.Response namespace
                const response = res;
                response.status(201).json({
                    success: true,
                    data: commissions,
                    timestamp: new Date().toISOString(),
                    requestId: response.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                const body = req.body;
                (0, logger_1.logCommissionError)('system', body?.orderId || 'unknown', error.message);
                const errorResponse = res;
                errorResponse.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: errorResponse.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getCommissions = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const query = reqAny.query;
                const { page = 1, limit = 10, status, type, userId, startDate, endDate } = query;
                const result = await this.commissionService.getCommissions({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    status: status,
                    type: type,
                    userId: userId,
                    startDate: startDate,
                    endDate: endDate,
                });
                resAny.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getCommission = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { id } = reqAny.params;
                const commission = await this.commissionService.getCommissionById(id);
                if (!commission) {
                    return resAny.status(404).json({
                        success: false,
                        error: 'Commission not found',
                        timestamp: new Date().toISOString(),
                        requestId: resAny.getHeader('X-Request-ID') || undefined,
                    });
                }
                resAny.json({
                    success: true,
                    data: commission,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getUserCommissions = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { userId } = reqAny.params;
                const query = reqAny.query;
                const { page = 1, limit = 10, status } = query;
                const result = await this.commissionService.getUserCommissions(userId, parseInt(page), parseInt(limit), status);
                resAny.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getUserCommissionStats = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { userId } = reqAny.params;
                const query = reqAny.query;
                const { period = 'month' } = query;
                const stats = await this.commissionService.getUserCommissionStats(userId, period);
                resAny.json({
                    success: true,
                    data: stats,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.updateCommissionStatus = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { id } = reqAny.params;
                const body = reqAny.body;
                const { status } = body;
                const commission = await this.commissionService.updateCommissionStatus(id, status);
                if (status === 'PAID') {
                    (0, metrics_1.recordCommissionPaid)('system', 'success');
                    (0, logger_1.logCommissionPaid)(commission.userId, id, commission.amount, 'system');
                }
                resAny.json({
                    success: true,
                    data: commission,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.deleteCommission = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { id } = reqAny.params;
                await this.commissionService.deleteCommission(id);
                resAny.json({
                    success: true,
                    message: 'Commission deleted successfully',
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        // Commission Rules
        this.createCommissionRule = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const body = reqAny.body;
                const rule = await this.ruleService.createRule(body);
                resAny.status(201).json({
                    success: true,
                    data: rule,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getCommissionRules = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const query = reqAny.query;
                const { page = 1, limit = 10, type, isActive } = query;
                const result = await this.ruleService.getRules({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    type: type,
                    isActive: isActive === 'true',
                });
                resAny.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getCommissionRule = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { id } = reqAny.params;
                const rule = await this.ruleService.getRuleById(id);
                if (!rule) {
                    return resAny.status(404).json({
                        success: false,
                        error: 'Commission rule not found',
                        timestamp: new Date().toISOString(),
                        requestId: resAny.getHeader('X-Request-ID') || undefined,
                    });
                }
                resAny.json({
                    success: true,
                    data: rule,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.updateCommissionRule = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { id } = reqAny.params;
                const body = reqAny.body;
                const rule = await this.ruleService.updateRule(id, body);
                resAny.json({
                    success: true,
                    data: rule,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.deleteCommissionRule = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { id } = reqAny.params;
                await this.ruleService.deleteRule(id);
                resAny.json({
                    success: true,
                    message: 'Commission rule deleted successfully',
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        // Payouts
        this.createPayout = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const userId = reqAny.user?.id;
                const body = reqAny.body;
                const payoutData = { ...body, userId };
                const payout = await this.payoutService.createPayout(payoutData);
                resAny.status(201).json({
                    success: true,
                    data: payout,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                const userId = req.user?.id || 'unknown';
                (0, logger_1.logPayoutError)(userId, 'new', error.message);
                resAny.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getPayouts = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const query = reqAny.query;
                const { page = 1, limit = 10, status, method, startDate, endDate } = query;
                const result = await this.payoutService.getPayouts({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    status: status,
                    method: method,
                    startDate: startDate,
                    endDate: endDate,
                });
                resAny.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getPayout = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { id } = reqAny.params;
                const payout = await this.payoutService.getPayoutById(id);
                if (!payout) {
                    return resAny.status(404).json({
                        success: false,
                        error: 'Payout not found',
                        timestamp: new Date().toISOString(),
                        requestId: resAny.getHeader('X-Request-ID') || undefined,
                    });
                }
                resAny.json({
                    success: true,
                    data: payout,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getUserPayouts = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { userId } = reqAny.params;
                const query = reqAny.query;
                const { page = 1, limit = 10, status } = query;
                const result = await this.payoutService.getUserPayouts(userId, parseInt(page), parseInt(limit), status);
                resAny.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.updatePayoutStatus = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            const { id } = reqAny.params;
            try {
                const body = reqAny.body;
                const { status } = body;
                const payout = await this.payoutService.updatePayoutStatus(id, status);
                if (status === 'COMPLETED') {
                    (0, metrics_1.recordPayoutProcessed)(payout.method, 'success');
                    (0, logger_1.logPayoutProcessed)(payout.userId, id, payout.amount, status);
                }
                resAny.json({
                    success: true,
                    data: payout,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                (0, logger_1.logPayoutError)('system', id, error.message);
                resAny.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        // Bonuses
        this.calculateBonuses = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const body = reqAny.body;
                const { period } = body;
                const bonuses = await this.bonusService.calculateBonuses(period);
                bonuses.forEach(bonus => {
                    (0, metrics_1.recordBonusAchieved)(bonus.type, period);
                    (0, logger_1.logBonusAchieved)(bonus.userId, bonus.type, bonus.amount, period);
                });
                resAny.status(201).json({
                    success: true,
                    data: bonuses,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getBonuses = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const query = reqAny.query;
                const { page = 1, limit = 10, type, period, startDate, endDate } = query;
                const result = await this.bonusService.getBonuses({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    type: type,
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                resAny.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getBonus = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { id } = reqAny.params;
                const bonus = await this.bonusService.getBonusById(id);
                if (!bonus) {
                    return resAny.status(404).json({
                        success: false,
                        error: 'Bonus not found',
                        timestamp: new Date().toISOString(),
                        requestId: resAny.getHeader('X-Request-ID') || undefined,
                    });
                }
                resAny.json({
                    success: true,
                    data: bonus,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getUserBonuses = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const { userId } = reqAny.params;
                const query = reqAny.query;
                const { page = 1, limit = 10, type, period } = query;
                const result = await this.bonusService.getUserBonuses(userId, parseInt(page), parseInt(limit), type, period);
                resAny.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        // Analytics
        this.getCommissionAnalytics = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const query = reqAny.query;
                const { period = 'month', startDate, endDate } = query;
                const analytics = await this.commissionService.getCommissionAnalytics({
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                resAny.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getPayoutAnalytics = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const query = reqAny.query;
                const { period = 'month', startDate, endDate } = query;
                const analytics = await this.payoutService.getPayoutAnalytics({
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                resAny.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.getBonusAnalytics = async (req, res) => {
            const reqAny = req;
            const resAny = res;
            try {
                const query = reqAny.query;
                const { period = 'month', startDate, endDate } = query;
                const analytics = await this.bonusService.getBonusAnalytics({
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                resAny.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
            catch (error) {
                resAny.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: resAny.getHeader('X-Request-ID') || undefined,
                });
            }
        };
        this.commissionService = new CommissionService_1.CommissionService();
        this.payoutService = new PayoutService_1.PayoutService();
        this.bonusService = new BonusService_1.BonusService();
        this.ruleService = new RuleService_1.RuleService();
    }
}
exports.CommissionController = CommissionController;
//# sourceMappingURL=CommissionController.js.map