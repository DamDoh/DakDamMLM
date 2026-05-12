import express, { Request, Response } from 'express';
import { CommissionService } from '../services/CommissionService';
import { PayoutService } from '../services/PayoutService';
import { BonusService } from '../services/BonusService';
import { RuleService } from '../services/RuleService';
import { recordCommissionCalculated, recordCommissionPaid, recordCommissionAmount, recordPayoutProcessed, recordBonusAchieved } from '../utils/metrics';
import { logCommissionCalculated, logCommissionPaid, logPayoutProcessed, logBonusAchieved, logCommissionError, logPayoutError } from '../utils/logger';

export class CommissionController {
  private commissionService: CommissionService;
  private payoutService: PayoutService;
  private bonusService: BonusService;
  private ruleService: RuleService;

  constructor() {
    this.commissionService = new CommissionService();
    this.payoutService = new PayoutService();
    this.bonusService = new BonusService();
    this.ruleService = new RuleService();
  }

  calculateCommissions = async (req: Request, res: Response) => {
    try {
      const { orderId } = req.body as unknown as { orderId: string };
      const commissions = await this.commissionService.calculateCommissions(orderId);

      // Record metrics
      commissions.forEach(commission => {
        recordCommissionCalculated(commission.type, commission.level);
        recordCommissionAmount(commission.amount, commission.type);
        logCommissionCalculated(commission.userId, orderId, commission.amount, commission.type);
      });

      // Use Response type directly - Next.js has issues with express.Response namespace
      const response = res as any;
      response.status(201).json({
        success: true,
        data: commissions,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      const body = req.body as unknown as { orderId?: string } | null;
      logCommissionError('system', body?.orderId || 'unknown', error.message);
      const errorResponse = res as any;
      errorResponse.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: errorResponse.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getCommissions = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const query = reqAny.query;
      const {
        page = 1,
        limit = 10,
        status,
        type,
        userId,
        startDate,
        endDate
      } = query;

      const result = await this.commissionService.getCommissions({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        type: type as string,
        userId: userId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      resAny.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getCommission = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
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
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getUserCommissions = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const { userId } = reqAny.params;
      const query = reqAny.query;
      const { page = 1, limit = 10, status } = query;

      const result = await this.commissionService.getUserCommissions(
        userId,
        parseInt(page as string),
        parseInt(limit as string),
        status as string
      );

      resAny.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getUserCommissionStats = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const { userId } = reqAny.params;
      const query = reqAny.query;
      const { period = 'month' } = query;

      const stats = await this.commissionService.getUserCommissionStats(userId, period as string);

      resAny.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  updateCommissionStatus = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const { id } = reqAny.params;
      const body = reqAny.body;
      const { status } = body;

      const commission = await this.commissionService.updateCommissionStatus(id, status);

      if (status === 'PAID') {
        recordCommissionPaid('system', 'success');
        logCommissionPaid(commission.userId, id, commission.amount, 'system');
      }

      resAny.json({
        success: true,
        data: commission,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  deleteCommission = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const { id } = reqAny.params;
      await this.commissionService.deleteCommission(id);

      resAny.json({
        success: true,
        message: 'Commission deleted successfully',
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  // Commission Rules
  createCommissionRule = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const body = reqAny.body;
      const rule = await this.ruleService.createRule(body);

      resAny.status(201).json({
        success: true,
        data: rule,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getCommissionRules = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const query = reqAny.query;
      const { page = 1, limit = 10, type, isActive } = query;

      const result = await this.ruleService.getRules({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        type: type as string,
        isActive: isActive === 'true',
      });

      resAny.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getCommissionRule = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
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
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  updateCommissionRule = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
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
    } catch (error: any) {
      resAny.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  deleteCommissionRule = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const { id } = reqAny.params;
      await this.ruleService.deleteRule(id);

      resAny.json({
        success: true,
        message: 'Commission rule deleted successfully',
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  // Payouts
  createPayout = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
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
    } catch (error: any) {
      const userId = (req as any).user?.id || 'unknown';
      logPayoutError(userId, 'new', error.message);
      resAny.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getPayouts = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const query = reqAny.query;
      const { page = 1, limit = 10, status, method, startDate, endDate } = query;

      const result = await this.payoutService.getPayouts({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        method: method as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      resAny.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getPayout = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
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
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getUserPayouts = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const { userId } = reqAny.params;
      const query = reqAny.query;
      const { page = 1, limit = 10, status } = query;

      const result = await this.payoutService.getUserPayouts(
        userId,
        parseInt(page as string),
        parseInt(limit as string),
        status as string
      );

      resAny.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  updatePayoutStatus = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    const { id } = reqAny.params;
    try {
      const body = reqAny.body;
      const { status } = body;

      const payout = await this.payoutService.updatePayoutStatus(id, status);

      if (status === 'COMPLETED') {
        recordPayoutProcessed(payout.method, 'success');
        logPayoutProcessed(payout.userId, id, payout.amount, status);
      }

      resAny.json({
        success: true,
        data: payout,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      logPayoutError('system', id, error.message);
      resAny.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  // Bonuses
  calculateBonuses = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const body = reqAny.body;
      const { period } = body;
      const bonuses = await this.bonusService.calculateBonuses(period);

      bonuses.forEach(bonus => {
        recordBonusAchieved(bonus.type, period);
        logBonusAchieved(bonus.userId, bonus.type, bonus.amount, period);
      });

      resAny.status(201).json({
        success: true,
        data: bonuses,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getBonuses = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const query = reqAny.query;
      const { page = 1, limit = 10, type, period, startDate, endDate } = query;

      const result = await this.bonusService.getBonuses({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        type: type as string,
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      resAny.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getBonus = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
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
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getUserBonuses = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const { userId } = reqAny.params;
      const query = reqAny.query;
      const { page = 1, limit = 10, type, period } = query;

      const result = await this.bonusService.getUserBonuses(
        userId,
        parseInt(page as string),
        parseInt(limit as string),
        type as string,
        period as string
      );

      resAny.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  // Analytics
  getCommissionAnalytics = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const query = reqAny.query;
      const { period = 'month', startDate, endDate } = query;

      const analytics = await this.commissionService.getCommissionAnalytics({
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      resAny.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getPayoutAnalytics = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const query = reqAny.query;
      const { period = 'month', startDate, endDate } = query;

      const analytics = await this.payoutService.getPayoutAnalytics({
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      resAny.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getBonusAnalytics = async (req: Request, res: Response) => {
    const reqAny = req as any;
    const resAny = res as any;
    try {
      const query = reqAny.query;
      const { period = 'month', startDate, endDate } = query;

      const analytics = await this.bonusService.getBonusAnalytics({
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      resAny.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      resAny.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: resAny.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  handleOrderCompletedWebhook = async (req: Request, res: Response) => {
    try {
      const { orderId, userId, amount } = req.body as unknown as { orderId: string; userId: string; amount: number };

      // Calculate commissions for the completed order
      const commissions = await this.commissionService.calculateCommissions(orderId);

      // Record metrics
      commissions.forEach(commission => {
        recordCommissionCalculated(commission.type, commission.level);
        recordCommissionAmount(commission.amount, commission.type);
        logCommissionCalculated(commission.userId, orderId, commission.amount, commission.type);
      });

      const response = res as any;
      response.status(200).json({
        success: true,
        data: { commissionsCalculated: commissions.length },
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      const body = req.body as unknown as { orderId?: string } | null;
      logCommissionError('webhook', body?.orderId || 'unknown', error.message);
      const errorResponse = res as any;
      errorResponse.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: errorResponse.getHeader('X-Request-ID') || undefined,
      });
    }
  };
}