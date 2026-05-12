"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preferenceRoutes = void 0;
const express_1 = __importDefault(require("express"));
const PreferenceController_1 = require("../controllers/PreferenceController");
const router = express_1.default.Router();
exports.preferenceRoutes = router;
const preferenceController = new PreferenceController_1.PreferenceController();
// User preferences
router.get('/user/:userId', preferenceController.getUserPreferences);
router.put('/user/:userId', preferenceController.updateUserPreferences);
router.post('/user/:userId', preferenceController.createUserPreferences);
// Bulk operations
router.post('/bulk-update', preferenceController.bulkUpdatePreferences);
// Analytics
router.get('/analytics/summary', preferenceController.getPreferencesAnalytics);
//# sourceMappingURL=preferenceRoutes.js.map