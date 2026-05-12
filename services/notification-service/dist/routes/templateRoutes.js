"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateRoutes = void 0;
const express_1 = __importDefault(require("express"));
const TemplateController_1 = require("../controllers/TemplateController");
const router = express_1.default.Router();
exports.templateRoutes = router;
const templateController = new TemplateController_1.TemplateController();
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
//# sourceMappingURL=templateRoutes.js.map