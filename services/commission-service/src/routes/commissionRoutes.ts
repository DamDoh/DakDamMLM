import express from 'express';
import { CommissionController } from '../controllers/CommissionController';
import { authenticateToken, requireAdmin, requireOwnershipOrAdmin } from '../middleware/auth';
import {
  validatePagination,
  validateCommissionData,
  validateBatchCommissions,
  validateDateRange,
  validatePeriod,
  validateTopEarners,
  validateUserId
} from '../middleware/validation';

const router = express.Router();
const commissionController = new CommissionController();

// Commission management (Admin only for most operations)
router.post('/calculate',
  authenticateToken,
  requireAdmin,
  validateCommissionData,
  commissionController.calculateCommissions
);

router.get('/',
  authenticateToken,
  requireAdmin,
  validatePagination,
  commissionController.getCommissions
);

router.get('/:id',
  authenticateToken,
  requireAdmin,
  commissionController.getCommission
);

router.put('/:id/status',
  authenticateToken,
  requireAdmin,
  commissionController.updateCommissionStatus
);

router.delete('/:id',
  authenticateToken,
  requireAdmin,
  commissionController.deleteCommission
);

// User commissions (Users can view their own, admins can view all)
router.get('/user/:userId',
  authenticateToken,
  requireOwnershipOrAdmin('userId'),
  validatePagination,
  commissionController.getUserCommissions
);

router.get('/user/:userId/stats',
  authenticateToken,
  requireOwnershipOrAdmin('userId'),
  validatePeriod,
  commissionController.getUserCommissionStats
);

// Commission rules (Admin only)
router.post('/rules',
  authenticateToken,
  requireAdmin,
  commissionController.createCommissionRule
);

router.get('/rules',
  authenticateToken,
  requireAdmin,
  validatePagination,
  commissionController.getCommissionRules
);

router.get('/rules/:id',
  authenticateToken,
  requireAdmin,
  commissionController.getCommissionRule
);

router.put('/rules/:id',
  authenticateToken,
  requireAdmin,
  commissionController.updateCommissionRule
);

router.delete('/rules/:id',
  authenticateToken,
  requireAdmin,
  commissionController.deleteCommissionRule
);

// Payouts (Users can create their own, admins can manage all)
router.post('/payouts',
  authenticateToken,
  commissionController.createPayout
);

router.get('/payouts',
  authenticateToken,
  requireAdmin,
  validatePagination,
  commissionController.getPayouts
);

router.get('/payouts/:id',
  authenticateToken,
  requireAdmin,
  commissionController.getPayout
);

router.put('/payouts/:id/status',
  authenticateToken,
  requireAdmin,
  commissionController.updatePayoutStatus
);

// User payouts (Users can view their own)
router.get('/payouts/user/:userId',
  authenticateToken,
  requireOwnershipOrAdmin('userId'),
  validatePagination,
  commissionController.getUserPayouts
);

// Bonuses (Admin only for calculations, users can view their own)
router.post('/bonuses/calculate',
  authenticateToken,
  requireAdmin,
  commissionController.calculateBonuses
);

router.get('/bonuses',
  authenticateToken,
  requireAdmin,
  validatePagination,
  commissionController.getBonuses
);

router.get('/bonuses/:id',
  authenticateToken,
  requireAdmin,
  commissionController.getBonus
);

// User bonuses (Users can view their own)
router.get('/bonuses/user/:userId',
  authenticateToken,
  requireOwnershipOrAdmin('userId'),
  validatePagination,
  commissionController.getUserBonuses
);

// Analytics (Admin only)
router.get('/analytics/summary',
  authenticateToken,
  requireAdmin,
  validatePeriod,
  commissionController.getCommissionAnalytics
);

router.get('/analytics/payouts',
  authenticateToken,
  requireAdmin,
  validatePeriod,
  commissionController.getPayoutAnalytics
);

router.get('/analytics/bonuses',
  authenticateToken,
  requireAdmin,
  validatePeriod,
  commissionController.getBonusAnalytics
);

// Webhook for order completion to trigger commission calculation
router.post('/webhook/order-completed',
  commissionController.handleOrderCompletedWebhook
);

export { router as commissionRoutes };