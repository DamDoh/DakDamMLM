"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignRoutes = void 0;
const express_1 = __importDefault(require("express"));
const CampaignController_1 = require("../controllers/CampaignController");
const router = express_1.default.Router();
exports.campaignRoutes = router;
const campaignController = new CampaignController_1.CampaignController();
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
//# sourceMappingURL=campaignRoutes.js.map