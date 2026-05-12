import express from 'express';
import { PreferenceController } from '../controllers/PreferenceController';

const router = express.Router();
const preferenceController = new PreferenceController();

// User preferences
router.get('/user/:userId', preferenceController.getUserPreferences);
router.put('/user/:userId', preferenceController.updateUserPreferences);
router.post('/user/:userId', preferenceController.createUserPreferences);

// Bulk operations
router.post('/bulk-update', preferenceController.bulkUpdatePreferences);

// Analytics
router.get('/analytics/summary', preferenceController.getPreferencesAnalytics);

export { router as preferenceRoutes };