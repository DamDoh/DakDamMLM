import express, { Request, Response } from 'express';
import { PayoutService } from '../services/PayoutService';
import { recordPayoutRequest, recordCommissionPayout, recordPaymentError } from '../utils/metrics';
import { logPayoutRequest, logCommissionPayout } from '../utils/logger';

export class PayoutController {
  private payoutService: PayoutService;

  constructor() {
    this.payoutService = new PayoutService();
  }

  requestPayout = async (req: Request, res: Response) => {
    const body = (req as any).body as unknown as {
      userId?: string;
      amount?: number;
      method?: string;
      accountDetails?: any;
    };
    const response = res as any;

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

      recordPayoutRequest('PENDING', method);
      logPayoutRequest(userId, amount, method);

      response.status(201).json({
        success: true,
        data: payoutRequest,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPayoutRequest('FAILED', body.method || 'unknown');
      recordPaymentError('payout_request', 'database');
      response.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getPayoutRequests = async (req: Request, res: Response) => {
    const response = res as any;
    try {
      const { page = 1, limit = 10, status, userId } = (req as any).query;

      const result = await this.payoutService.getPayoutRequests({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        userId: userId as string,
      });

      response.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('payout_requests_listing', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getPayoutRequest = async (req: Request, res: Response) => {
    const response = res as any;
    try {
      const { id } = (req as any).params;
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
    } catch (error: any) {
      recordPaymentError('payout_request_retrieval', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  approvePayout = async (req: Request, res: Response) => {
    const body = (req as any).body as unknown as { notes?: string };
    const response = res as any;
    try {
      const { id } = (req as any).params;
      const { notes } = body;

      const payoutRequest = await this.payoutService.approvePayout(id, notes || undefined);

      recordPayoutRequest('APPROVED', payoutRequest.method);

      response.json({
        success: true,
        data: payoutRequest,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('payout_approval', 'database');
      response.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  rejectPayout = async (req: Request, res: Response) => {
    const body = (req as any).body as unknown as { reason?: string };
    const response = res as any;
    try {
      const { id } = (req as any).params;
      const { reason } = body;

      if (!reason) {
        return response.status(400).json({
          success: false,
          error: 'Missing required field: reason',
          timestamp: new Date().toISOString(),
        });
      }

      const payoutRequest = await this.payoutService.rejectPayout(id, reason);

      recordPayoutRequest('REJECTED', payoutRequest.method);

      response.json({
        success: true,
        data: payoutRequest,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('payout_rejection', 'database');
      response.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  processPayout = async (req: Request, res: Response) => {
    const response = res as any;
    try {
      const { id } = (req as any).params;

      const payoutRequest = await this.payoutService.processPayout(id);

      recordPayoutRequest('COMPLETED', payoutRequest.method);

      response.json({
        success: true,
        data: payoutRequest,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('payout_processing', 'payment_provider');
      response.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  processCommissionPayout = async (req: Request, res: Response) => {
    const body = (req as any).body as unknown as { userId?: string; amount?: number };
    const response = res as any;
    try {
      const { commissionId } = (req as any).params;
      const { userId, amount } = body;

      if (!userId || !amount) {
        return response.status(400).json({
          success: false,
          error: 'Missing required fields: userId, amount',
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.payoutService.processCommissionPayout(commissionId, userId, amount);

      recordCommissionPayout('success');
      logCommissionPayout(userId, commissionId, amount);

      response.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordCommissionPayout('failed');
      recordPaymentError('commission_payout', 'wallet');
      response.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getPayoutAnalytics = async (req: Request, res: Response) => {
    const response = res as any;
    try {
      const { period = 'month', startDate, endDate } = (req as any).query;

      const analytics = await this.payoutService.getPayoutAnalytics({
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      response.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('payout_analytics', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };
}
