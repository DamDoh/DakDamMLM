"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletRoutes = void 0;
const express_1 = __importDefault(require("express"));
const WalletController_1 = require("../controllers/WalletController");
const router = express_1.default.Router();
exports.walletRoutes = router;
const walletController = new WalletController_1.WalletController();
// Wallet management
router.get('/:userId', walletController.getWallet);
router.post('/:userId/credit', walletController.creditWallet);
router.post('/:userId/debit', walletController.debitWallet);
// Wallet transactions
router.get('/:userId/transactions', walletController.getWalletTransactions);
router.get('/:userId/balance', walletController.getWalletBalance);
// Wallet analytics
router.get('/analytics/summary', walletController.getWalletAnalytics);
//# sourceMappingURL=walletRoutes.js.map