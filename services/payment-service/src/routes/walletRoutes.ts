import express from 'express';
import { WalletController } from '../controllers/WalletController';

const router = express.Router();
const walletController = new WalletController();

// Wallet management
router.get('/:userId', walletController.getWallet);
router.post('/:userId/credit', walletController.creditWallet);
router.post('/:userId/debit', walletController.debitWallet);

// Wallet transactions
router.get('/:userId/transactions', walletController.getWalletTransactions);
router.get('/:userId/balance', walletController.getWalletBalance);

// Wallet analytics
router.get('/analytics/summary', walletController.getWalletAnalytics);

export { router as walletRoutes };