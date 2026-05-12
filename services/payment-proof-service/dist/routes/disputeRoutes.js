"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disputeRoutes = void 0;
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const authMiddleware_1 = require("../middleware/authMiddleware");
const errorHandler_1 = require("../middleware/errorHandler");
const DisputeController_1 = require("../controllers/DisputeController");
const router = express_1.default.Router();
exports.disputeRoutes = router;
// Validation middleware
const createDisputeValidation = [
    (0, express_validator_1.body)('proofId').isUUID().withMessage('Valid proof ID is required'),
    (0, express_validator_1.body)('type').isIn(['amount_mismatch', 'invalid_proof', 'duplicate', 'other']).withMessage('Invalid dispute type'),
    (0, express_validator_1.body)('reason').isString().isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters'),
    (0, express_validator_1.body)('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
];
const resolveDisputeValidation = [
    (0, express_validator_1.body)('resolution').isString().isLength({ min: 10, max: 1000 }).withMessage('Resolution must be 10-1000 characters'),
    (0, express_validator_1.body)('status').isIn(['resolved', 'rejected']).withMessage('Status must be resolved or rejected'),
];
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};
// Routes
router.post('/', authMiddleware_1.authMiddleware, createDisputeValidation, handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new DisputeController_1.DisputeController();
    await controller.createDispute(req, res);
}));
router.get('/', authMiddleware_1.authMiddleware, [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('status').optional().isIn(['pending', 'resolved', 'rejected', 'escalated']).withMessage('Invalid status'),
    (0, express_validator_1.query)('type').optional().isIn(['amount_mismatch', 'invalid_proof', 'duplicate', 'other']).withMessage('Invalid type'),
], handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new DisputeController_1.DisputeController();
    await controller.getDisputes(req, res);
}));
router.get('/:id', authMiddleware_1.authMiddleware, (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new DisputeController_1.DisputeController();
    await controller.getDispute(req, res);
}));
router.post('/:id/resolve', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['upline', 'admin']), (0, express_validator_1.param)('id').isUUID(), resolveDisputeValidation, handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new DisputeController_1.DisputeController();
    await controller.resolveDispute(req, res);
}));
router.post('/:id/escalate', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['upline']), (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new DisputeController_1.DisputeController();
    await controller.escalateDispute(req, res);
}));
router.get('/:id/messages', authMiddleware_1.authMiddleware, (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new DisputeController_1.DisputeController();
    await controller.getDisputeMessages(req, res);
}));
router.post('/:id/messages', authMiddleware_1.authMiddleware, (0, express_validator_1.param)('id').isUUID(), [
    (0, express_validator_1.body)('message').isString().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
], handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new DisputeController_1.DisputeController();
    await controller.addDisputeMessage(req, res);
}));
router.get('/stats', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['admin', 'auditor']), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new DisputeController_1.DisputeController();
    await controller.getDisputeStats(req, res);
}));
//# sourceMappingURL=disputeRoutes.js.map