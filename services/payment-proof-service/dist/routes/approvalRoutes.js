"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalRoutes = void 0;
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const authMiddleware_1 = require("../middleware/authMiddleware");
const errorHandler_1 = require("../middleware/errorHandler");
const ApprovalController_1 = require("../controllers/ApprovalController");
const router = express_1.default.Router();
exports.approvalRoutes = router;
// Validation middleware
const approvalValidation = [
    (0, express_validator_1.body)('proofId').isUUID().withMessage('Valid proof ID is required'),
    (0, express_validator_1.body)('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    (0, express_validator_1.body)('notes').optional().isString().withMessage('Notes must be a string'),
];
const bulkApprovalValidation = [
    (0, express_validator_1.body)('proofIds').isArray().withMessage('Proof IDs must be an array'),
    (0, express_validator_1.body)('proofIds.*').isUUID().withMessage('Each proof ID must be valid'),
    (0, express_validator_1.body)('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    (0, express_validator_1.body)('notes').optional().isString().withMessage('Notes must be a string'),
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
router.get('/pending', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['upline', 'admin']), [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('status').optional().isIn(['uploaded', 'escalated']).withMessage('Invalid status'),
], handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ApprovalController_1.ApprovalController();
    await controller.getPendingApprovals(req, res);
}));
router.post('/review', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['upline', 'admin']), approvalValidation, handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ApprovalController_1.ApprovalController();
    await controller.reviewProof(req, res);
}));
router.post('/bulk-review', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['admin']), bulkApprovalValidation, handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ApprovalController_1.ApprovalController();
    await controller.bulkReviewProofs(req, res);
}));
router.get('/history', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['upline', 'admin', 'auditor']), [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    (0, express_validator_1.query)('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
    (0, express_validator_1.query)('status').optional().isIn(['approved', 'rejected']).withMessage('Invalid status'),
], handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ApprovalController_1.ApprovalController();
    await controller.getApprovalHistory(req, res);
}));
router.get('/stats', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['upline', 'admin', 'auditor']), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ApprovalController_1.ApprovalController();
    await controller.getApprovalStats(req, res);
}));
router.post('/escalate/:proofId', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['upline']), (0, express_validator_1.param)('proofId').isUUID(), handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ApprovalController_1.ApprovalController();
    await controller.escalateProof(req, res);
}));
//# sourceMappingURL=approvalRoutes.js.map