"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commissionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const CommissionController_1 = require("../controllers/CommissionController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
exports.commissionRoutes = router;
const commissionController = new CommissionController_1.CommissionController();
// Commission management (Admin only for most operations)
router.post('/calculate', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validateCommissionData, commissionController.calculateCommissions);
router.get('/', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validatePagination, commissionController.getCommissions);
router.get('/:id', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.getCommission);
router.put('/:id/status', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.updateCommissionStatus);
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.deleteCommission);
// User commissions (Users can view their own, admins can view all)
router.get('/user/:userId', auth_1.authenticateToken, (0, auth_1.requireOwnershipOrAdmin)('userId'), validation_1.validatePagination, commissionController.getUserCommissions);
router.get('/user/:userId/stats', auth_1.authenticateToken, (0, auth_1.requireOwnershipOrAdmin)('userId'), validation_1.validatePeriod, commissionController.getUserCommissionStats);
// Commission rules (Admin only)
router.post('/rules', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.createCommissionRule);
router.get('/rules', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validatePagination, commissionController.getCommissionRules);
router.get('/rules/:id', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.getCommissionRule);
router.put('/rules/:id', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.updateCommissionRule);
router.delete('/rules/:id', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.deleteCommissionRule);
// Payouts (Users can create their own, admins can manage all)
router.post('/payouts', auth_1.authenticateToken, commissionController.createPayout);
router.get('/payouts', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validatePagination, commissionController.getPayouts);
router.get('/payouts/:id', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.getPayout);
router.put('/payouts/:id/status', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.updatePayoutStatus);
// User payouts (Users can view their own)
router.get('/payouts/user/:userId', auth_1.authenticateToken, (0, auth_1.requireOwnershipOrAdmin)('userId'), validation_1.validatePagination, commissionController.getUserPayouts);
// Bonuses (Admin only for calculations, users can view their own)
router.post('/bonuses/calculate', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.calculateBonuses);
router.get('/bonuses', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validatePagination, commissionController.getBonuses);
router.get('/bonuses/:id', auth_1.authenticateToken, auth_1.requireAdmin, commissionController.getBonus);
// User bonuses (Users can view their own)
router.get('/bonuses/user/:userId', auth_1.authenticateToken, (0, auth_1.requireOwnershipOrAdmin)('userId'), validation_1.validatePagination, commissionController.getUserBonuses);
// Analytics (Admin only)
router.get('/analytics/summary', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validatePeriod, commissionController.getCommissionAnalytics);
router.get('/analytics/payouts', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validatePeriod, commissionController.getPayoutAnalytics);
router.get('/analytics/bonuses', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validatePeriod, commissionController.getBonusAnalytics);
//# sourceMappingURL=commissionRoutes.js.map