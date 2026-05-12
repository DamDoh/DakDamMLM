import express from 'express';
import { CampaignController } from '../controllers/CampaignController';

const router = express.Router();
const campaignController = new CampaignController();

// Campaign management
router.post('/', campaignController.createCampaign);
router.get('/', campaignController.getCampaigns);
router.get('/:id', campaignController.getCampaign);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

// Campaign execution
router.post('/:id/execute', campaignController.executeCampaign);
router.post('/:id/schedule', campaignController.scheduleCampaign);
router.post('/:id/cancel', campaignController.cancelCampaign);

// Campaign analytics
router.get('/:id/analytics', campaignController.getCampaignAnalytics);
router.get('/analytics/summary', campaignController.getCampaignsAnalytics);

export { router as campaignRoutes };