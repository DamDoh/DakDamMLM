import express from 'express';
import { TemplateController } from '../controllers/TemplateController';

const router = express.Router();
const templateController = new TemplateController();

// Template management
router.post('/', templateController.createTemplate);
router.get('/', templateController.getTemplates);
router.get('/:id', templateController.getTemplate);
router.put('/:id', templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate);

// Template rendering
router.post('/:id/render', templateController.renderTemplate);

// Template analytics
router.get('/:id/analytics', templateController.getTemplateAnalytics);

export { router as templateRoutes };