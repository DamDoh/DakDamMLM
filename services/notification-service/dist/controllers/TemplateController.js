"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateController = void 0;
const TemplateService_1 = require("../services/TemplateService");
class TemplateController {
    constructor() {
        this.createTemplate = async (req, res) => {
            try {
                const template = await this.templateService.createTemplate(req.body);
                res.status(201).json({
                    success: true,
                    data: template,
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
        this.getTemplates = async (req, res) => {
            try {
                const { page = 1, limit = 10, type, channel, isActive } = req.query;
                const result = await this.templateService.getTemplates({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    type: type,
                    channel: channel,
                    isActive: isActive === 'true',
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
        this.getTemplate = async (req, res) => {
            try {
                const { id } = req.params;
                const template = await this.templateService.getTemplateById(id);
                if (!template) {
                    return res.status(404).json({
                        success: false,
                        error: 'Template not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                res.json({
                    success: true,
                    data: template,
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
        this.updateTemplate = async (req, res) => {
            try {
                const { id } = req.params;
                const template = await this.templateService.updateTemplate(id, req.body);
                res.json({
                    success: true,
                    data: template,
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
        this.deleteTemplate = async (req, res) => {
            try {
                const { id } = req.params;
                await this.templateService.deleteTemplate(id);
                res.json({
                    success: true,
                    message: 'Template deleted successfully',
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
        this.renderTemplate = async (req, res) => {
            try {
                const { id } = req.params;
                const { variables } = req.body;
                const rendered = await this.templateService.renderTemplate(id, variables);
                res.json({
                    success: true,
                    data: rendered,
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
        this.getTemplateAnalytics = async (req, res) => {
            try {
                const { id } = req.params;
                const { period = 'month' } = req.query;
                const analytics = await this.templateService.getTemplateAnalytics(id, {
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
        this.templateService = new TemplateService_1.TemplateService();
    }
}
exports.TemplateController = TemplateController;
//# sourceMappingURL=TemplateController.js.map