"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignController = void 0;
const CampaignService_1 = require("../services/CampaignService");
class CampaignController {
    constructor() {
        this.createCampaign = async (req, res) => {
            try {
                const campaign = await this.campaignService.createCampaign(req.body);
                res.status(201).json({
                    success: true,
                    data: campaign,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getCampaigns = async (req, res) => {
            try {
                const { page = 1, limit = 10, status, type } = req.query;
                const result = await this.campaignService.getCampaigns({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    status: status,
                    type: type,
                });
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getCampaign = async (req, res) => {
            try {
                const { id } = req.params;
                const campaign = await this.campaignService.getCampaignById(id);
                if (!campaign) {
                    return res.status(404).json({
                        success: false,
                        error: 'Campaign not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                res.json({
                    success: true,
                    data: campaign,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.updateCampaign = async (req, res) => {
            try {
                const { id } = req.params;
                const campaign = await this.campaignService.updateCampaign(id, req.body);
                res.json({
                    success: true,
                    data: campaign,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.deleteCampaign = async (req, res) => {
            try {
                const { id } = req.params;
                await this.campaignService.deleteCampaign(id);
                res.json({
                    success: true,
                    message: 'Campaign deleted successfully',
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.executeCampaign = async (req, res) => {
            try {
                const { id } = req.params;
                const result = await this.campaignService.executeCampaign(id);
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.scheduleCampaign = async (req, res) => {
            try {
                const { id } = req.params;
                const { scheduledAt } = req.body;
                const campaign = await this.campaignService.scheduleCampaign(id, new Date(scheduledAt));
                res.json({
                    success: true,
                    data: campaign,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.cancelCampaign = async (req, res) => {
            try {
                const { id } = req.params;
                const campaign = await this.campaignService.cancelCampaign(id);
                res.json({
                    success: true,
                    data: campaign,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getCampaignAnalytics = async (req, res) => {
            try {
                const { id } = req.params;
                const analytics = await this.campaignService.getCampaignAnalytics(id);
                res.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getCampaignsAnalytics = async (req, res) => {
            try {
                const { period = 'month' } = req.query;
                const analytics = await this.campaignService.getCampaignsAnalytics({
                    period: period,
                });
                res.json({
                    success: true,
                    data: analytics,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.campaignService = new CampaignService_1.CampaignService();
    }
}
exports.CampaignController = CampaignController;
//# sourceMappingURL=CampaignController.js.map