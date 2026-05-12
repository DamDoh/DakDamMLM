import express from 'express';
import { PayoutController } from '../controllers/PayoutController';

const router = express.Router();
const payoutController = new PayoutController();

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

export { router as payoutRoutes };