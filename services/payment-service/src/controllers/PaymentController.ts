import express, { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { recordPaymentTransaction, recordPaymentError, recordRefundRequest } from '../utils/metrics';
import { logPaymentProcessing, logPaymentFailure } from '../utils/logger';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  processPayment = async (req: Request, res: Response) => {
    const body = (req as any).body as unknown as {
      userId?: string;
      orderId?: string;
      amount?: number;
      currency?: string;
      method?: string;
      provider?: string;
      paymentData?: any;
    };

    try {
      const {
        userId,
        orderId,
        amount,
        currency = 'USD',
        method,
        provider,
        paymentData
      } = body;

      if (!userId || !amount || !method || !provider) {
        const response = res as any;
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
      recordPaymentTransaction('success', method, provider);
      logPaymentProcessing(userId, amount, method, 'completed');

      const response = res as any;
      response.status(201).json({
        success: true,
        data: transaction,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    } catch (error: any) {
      recordPaymentTransaction('failed', body.method || 'unknown', body.provider || 'unknown');
      recordPaymentError('payment_processing', body.provider || 'unknown');
      logPaymentFailure(body.userId || 'unknown', body.amount || 0, error.message);

      const response = res as any;
      response.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    }
  };

  processRefund = async (req: Request, res: Response) => {
    const body = (req as any).body as unknown as { amount?: number; reason?: string };
    const response = res as any;

    try {
      const { transactionId } = (req as any).params;
      const { amount, reason } = body;

      if (!amount || !reason) {
        return response.status(400).json({
          success: false,
          error: 'Missing required fields: amount, reason',
          timestamp: new Date().toISOString(),
        });
      }

      const refund = await this.paymentService.processRefund(transactionId, amount, reason);

      recordRefundRequest('completed');
      logPaymentProcessing(refund.userId, amount, 'refund', 'completed');

      response.json({
        success: true,
        data: refund,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    } catch (error: any) {
      recordRefundRequest('failed');
      recordPaymentError('refund_processing', 'unknown');
      logPaymentFailure('unknown', body.amount || 0, error.message);

      response.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    }
  };

  getTransactions = async (req: Request, res: Response) => {
    const response = res as any;

    try {
      const {
        page = 1,
        limit = 10,
        status,
        type,
        method,
        startDate,
        endDate
      } = (req as any).query;

      const result = await this.paymentService.getTransactions({
        page: parseInt((page || '1') as string),
        limit: parseInt((limit || '10') as string),
        status: status as string,
        type: type as string,
        method: method as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      response.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    } catch (error: any) {
      recordPaymentError('transaction_listing', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    }
  };

  getTransaction = async (req: Request, res: Response) => {
    const response = res as any;

    try {
      const { id } = (req as any).params;
      const transaction = await this.paymentService.getTransactionById(id);

      if (!transaction) {
        return response.status(404).json({
          success: false,
          error: (req as any).t ? (req as any).t('errors.transaction_not_found') : 'Transaction not found',
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
    } catch (error: any) {
      recordPaymentError('transaction_retrieval', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    }
  };

  getUserTransactions = async (req: Request, res: Response) => {
    const response = res as any;

    try {
      const { userId } = (req as any).params;
      const { page = 1, limit = 10, type } = (req as any).query;

      if (!userId) {
        return response.status(400).json({
          success: false,
          error: 'Missing required parameter: userId',
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.paymentService.getUserTransactions(
        userId,
        parseInt((page || '1') as string),
        parseInt((limit || '10') as string),
        type as string
      );

      response.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    } catch (error: any) {
      recordPaymentError('user_transactions', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    }
  };

  getPaymentAnalytics = async (req: Request, res: Response) => {
    const response = res as any;

    try {
      const { period = 'month', startDate, endDate } = (req as any).query;

      const analytics = await this.paymentService.getPaymentAnalytics({
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      response.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    } catch (error: any) {
      recordPaymentError('analytics_generation', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    }
  };

  getRevenueAnalytics = async (req: Request, res: Response) => {
    const response = res as any;

    try {
      const { period = 'month', startDate, endDate } = (req as any).query;

      const analytics = await this.paymentService.getRevenueAnalytics({
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      response.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    } catch (error: any) {
      recordPaymentError('revenue_analytics', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (response.getHeader && response.getHeader('X-Request-ID')) || undefined,
      });
    }
  };
}
