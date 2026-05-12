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
                res.status(201).json({
                    success: true,
                    data: commissions,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, logger_1.logCommissionError)('system', req.body.orderId, error.message);
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getCommissions = async (req, res) => {
            try {
                const { page = 1, limit = 10, status, type, userId, startDate, endDate } = req.query;
                const result = await this.commissionService.getCommissions({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    status: status,
                    type: type,
                    userId: userId,
                    startDate: startDate,
                    endDate: endDate,
                });
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getCommission = async (req, res) => {
            try {
                const { id } = req.params;
                const commission = await this.commissionService.getCommissionById(id);
                if (!commission) {
                    return res.status(404).json({
                        success: false,
                        error: 'Commission not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                res.json({
                    success: true,
                    data: commission,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getUserCommissions = async (req, res) => {
            try {
                const { userId } = req.params;
                const { page = 1, limit = 10, status } = req.query;
                const result = await this.commissionService.getUserCommissions(userId, parseInt(page), parseInt(limit), status);
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getUserCommissionStats = async (req, res) => {
            try {
                const { userId } = req.params;
                const { period = 'month' } = req.query;
                const stats = await this.commissionService.getUserCommissionStats(userId, period);
                res.json({
                    success: true,
                    data: stats,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.updateCommissionStatus = async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;
                const commission = await this.commissionService.updateCommissionStatus(id, status);
                if (status === 'PAID') {
                    (0, metrics_1.recordCommissionPaid)('system', 'success');
                    (0, logger_1.logCommissionPaid)(commission.userId, id, commission.amount, 'system');
                }
                res.json({
                    success: true,
                    data: commission,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.deleteCommission = async (req, res) => {
            try {
                const { id } = req.params;
                await this.commissionService.deleteCommission(id);
                res.json({
                    success: true,
                    message: 'Commission deleted successfully',
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        // Commission Rules
        this.createCommissionRule = async (req, res) => {
            try {
                const rule = await this.ruleService.createRule(req.body);
                res.status(201).json({
                    success: true,
                    data: rule,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getCommissionRules = async (req, res) => {
            try {
                const { page = 1, limit = 10, type, isActive } = req.query;
                const result = await this.ruleService.getRules({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    type: type,
                    isActive: isActive === 'true',
                });
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getCommissionRule = async (req, res) => {
            try {
                const { id } = req.params;
                const rule = await this.ruleService.getRuleById(id);
                if (!rule) {
                    return res.status(404).json({
                        success: false,
                        error: 'Commission rule not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                res.json({
                    success: true,
                    data: rule,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.updateCommissionRule = async (req, res) => {
            try {
                const { id } = req.params;
                const rule = await this.ruleService.updateRule(id, req.body);
                res.json({
                    success: true,
                    data: rule,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.deleteCommissionRule = async (req, res) => {
            try {
                const { id } = req.params;
                await this.ruleService.deleteRule(id);
                res.json({
                    success: true,
                    message: 'Commission rule deleted successfully',
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        // Payouts
        this.createPayout = async (req, res) => {
            try {
                const userId = req.user?.id;
                const payoutData = { ...req.body, userId };
                const payout = await this.payoutService.createPayout(payoutData);
                res.status(201).json({
                    success: true,
                    data: payout,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                const userId = req.user?.id || 'unknown';
                (0, logger_1.logPayoutError)(userId, 'new', error.message);
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getPayouts = async (req, res) => {
            try {
                const { page = 1, limit = 10, status, method, startDate, endDate } = req.query;
                const result = await this.payoutService.getPayouts({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    status: status,
                    method: method,
                    startDate: startDate,
                    endDate: endDate,
                });
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getPayout = async (req, res) => {
            try {
                const { id } = req.params;
                const payout = await this.payoutService.getPayoutById(id);
                if (!payout) {
                    return res.status(404).json({
                        success: false,
                        error: 'Payout not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                res.json({
                    success: true,
                    data: payout,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getUserPayouts = async (req, res) => {
            try {
                const { userId } = req.params;
                const { page = 1, limit = 10, status } = req.query;
                const result = await this.payoutService.getUserPayouts(userId, parseInt(page), parseInt(limit), status);
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.updatePayoutStatus = async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;
                const payout = await this.payoutService.updatePayoutStatus(id, status);
                if (status === 'COMPLETED') {
                    (0, metrics_1.recordPayoutProcessed)(payout.method, 'success');
                    (0, logger_1.logPayoutProcessed)(payout.userId, id, payout.amount, status);
                }
                res.json({
                    success: true,
                    data: payout,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, logger_1.logPayoutError)('system', id, error.message);
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        // Bonuses
        this.calculateBonuses = async (req, res) => {
            try {
                const { period } = req.body;
                const bonuses = await this.bonusService.calculateBonuses(period);
                bonuses.forEach(bonus => {
                    (0, metrics_1.recordBonusAchieved)(bonus.type, period);
                    (0, logger_1.logBonusAchieved)(bonus.userId, bonus.type, bonus.amount, period);
                });
                res.status(201).json({
                    success: true,
                    data: bonuses,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getBonuses = async (req, res) => {
            try {
                const { page = 1, limit = 10, type, period, startDate, endDate } = req.query;
                const result = await this.bonusService.getBonuses({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    type: type,
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getBonus = async (req, res) => {
            try {
                const { id } = req.params;
                const bonus = await this.bonusService.getBonusById(id);
                if (!bonus) {
                    return res.status(404).json({
                        success: false,
                        error: 'Bonus not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                res.json({
                    success: true,
                    data: bonus,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getUserBonuses = async (req, res) => {
            try {
                const { userId } = req.params;
                const { page = 1, limit = 10, type, period } = req.query;
                const result = await this.bonusService.getUserBonuses(userId, parseInt(page), parseInt(limit), type, period);
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        // Analytics
        this.getCommissionAnalytics = async (req, res) => {
            try {
                const { period = 'month', startDate, endDate } = req.query;
                const analytics = await this.commissionService.getCommissionAnalytics({
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
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getPayoutAnalytics = async (req, res) => {
            try {
                const { period = 'month', startDate, endDate } = req.query;
                const analytics = await this.payoutService.getPayoutAnalytics({
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
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getBonusAnalytics = async (req, res) => {
            try {
                const { period = 'month', startDate, endDate } = req.query;
                const analytics = await this.bonusService.getBonusAnalytics({
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
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
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