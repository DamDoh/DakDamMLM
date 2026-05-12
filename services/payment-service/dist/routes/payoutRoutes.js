"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutRoutes = void 0;
const express_1 = __importDefault(require("express"));
const PayoutController_1 = require("../controllers/PayoutController");
const router = express_1.default.Router();
exports.payoutRoutes = router;
const payoutController = new PayoutController_1.PayoutController();
// Payout requests
router.post('/request', payoutController.requestPayout);
router.get('/requests', payoutController.getPayoutRequests);
router.get('/requests/:id', payoutController.getPayoutRequest);
router.put('/requests/:id/approve', payoutController.approvePayout);
router.put('/requests/:id/reject', payoutController.rejectPayout);
router.put('/requests/:id/process', payoutController.processPayout);
// Commission payouts (automated)
router.post('/commission/:commissionId', payoutController.processCommissionPayout);
// Payout analytics
router.get('/analytics/summary', payoutController.getPayoutAnalytics);
//# sourceMappingURL=payoutRoutes.js.map