import express, { Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { recordPaymentError } from '../utils/metrics';
import { logWalletTransaction } from '../utils/logger';

export class WalletController {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  getWallet = async (req: Request, res: Response) => {
    const response = res as any;
    try {
      const { userId } = (req as any).params;
      const wallet = await this.walletService.getWallet(userId);

      response.json({
        success: true,
        data: wallet,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('wallet_retrieval', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  creditWallet = async (req: Request, res: Response) => {
    const body = (req as any).body as unknown as {
      amount?: number;
      description?: string;
      referenceId?: string;
      referenceType?: string;
    };
    const response = res as any;
    try {
      const { userId } = (req as any).params;
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

      logWalletTransaction(userId, 'CREDIT', amount, (result.transaction as any).balanceAfter || result.wallet.balance);

      response.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('wallet_credit', 'database');
      response.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  debitWallet = async (req: Request, res: Response) => {
    const body = (req as any).body as unknown as {
      amount?: number;
      description?: string;
      referenceId?: string;
      referenceType?: string;
    };
    const response = res as any;
    try {
      const { userId } = (req as any).params;
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

      logWalletTransaction(userId, 'DEBIT', amount, (result.transaction as any).balanceAfter || result.wallet.balance);

      response.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('wallet_debit', 'database');
      response.status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getWalletTransactions = async (req: Request, res: Response) => {
    const response = res as any;
    try {
      const { userId } = (req as any).params;
      const { page = 1, limit = 10, type } = (req as any).query;

      const result = await this.walletService.getWalletTransactions(
        userId,
        parseInt(page as string),
        parseInt(limit as string),
        type as string
      );

      response.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('wallet_transactions', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getWalletBalance = async (req: Request, res: Response) => {
    const response = res as any;
    try {
      const { userId } = (req as any).params;
      const balance = await this.walletService.getWalletBalance(userId);

      response.json({
        success: true,
        data: { balance },
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('wallet_balance', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };

  getWalletAnalytics = async (req: Request, res: Response) => {
    const response = res as any;
    try {
      const analytics = await this.walletService.getWalletAnalytics();

      response.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    } catch (error: any) {
      recordPaymentError('wallet_analytics', 'database');
      response.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') || undefined,
      });
    }
  };
}
