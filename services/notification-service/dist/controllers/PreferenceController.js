"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferenceController = void 0;
const PreferenceService_1 = require("../services/PreferenceService");
class PreferenceController {
    constructor() {
        this.getUserPreferences = async (req, res) => {
            try {
                const { userId } = req.params;
                const preferences = await this.preferenceService.getUserPreferences(userId);
                res.json({
                    success: true,
                    data: preferences,
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
        this.createUserPreferences = async (req, res) => {
            try {
                const { userId } = req.params;
                const preferences = await this.preferenceService.createUserPreferences(userId, req.body);
                res.status(201).json({
                    success: true,
                    data: preferences,
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
        this.updateUserPreferences = async (req, res) => {
            try {
                const { userId } = req.params;
                const preferences = await this.preferenceService.updateUserPreferences(userId, req.body);
                res.json({
                    success: true,
                    data: preferences,
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
        this.bulkUpdatePreferences = async (req, res) => {
            try {
                const { updates } = req.body;
                const results = await this.preferenceService.bulkUpdatePreferences(updates);
                res.json({
                    success: true,
                    data: results,
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
        this.getPreferencesAnalytics = async (req, res) => {
            try {
                const analytics = await this.preferenceService.getPreferencesAnalytics();
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
        this.preferenceService = new PreferenceService_1.PreferenceService();
    }
}
exports.PreferenceController = PreferenceController;
//# sourceMappingURL=PreferenceController.js.map