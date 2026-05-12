"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genealogyRoutes = void 0;
const express_1 = __importDefault(require("express"));
const GenealogyController_1 = require("../controllers/GenealogyController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const router = express_1.default.Router();
exports.genealogyRoutes = router;
const genealogyController = new GenealogyController_1.GenealogyController();
// Apply authentication to all routes
router.use(authMiddleware_1.authenticateToken);
// Genealogy routes with validation
router.get('/tree/:userId', validationMiddleware_1.validateUserId, validationMiddleware_1.validateTreeDepth, genealogyController.getGenealogyTree);
router.get('/downline/:userId', validationMiddleware_1.validateUserId, genealogyController.getDownline);
router.get('/upline/:userId', validationMiddleware_1.validateUserId, genealogyController.getUpline);
router.post('/move', validationMiddleware_1.validateMoveDownline, authMiddleware_1.requireAdmin, // Only admins can move downlines
genealogyController.moveDownline);
router.get('/stats/:userId', validationMiddleware_1.validateUserId, genealogyController.getGenealogyStats);
router.get('/placement/:userId', validationMiddleware_1.validateUserId, genealogyController.getPlacementInfo);
router.get('/binary-tree/:userId', validationMiddleware_1.validateUserId, validationMiddleware_1.validateTreeDepth, genealogyController.getBinaryTree);
router.get('/downline-paginated/:userId', validationMiddleware_1.validateUserId, genealogyController.getDownlinePaginated);
router.post('/validate-placement', genealogyController.validatePlacement);
router.get('/metrics/:userId', validationMiddleware_1.validateUserId, genealogyController.getGenealogyMetrics);
router.post('/bulk-update', genealogyController.bulkUpdateGenealogy);
//# sourceMappingURL=genealogyRoutes.js.map