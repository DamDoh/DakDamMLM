import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ApprovalController } from '../controllers/ApprovalController';

const router = express.Router();

// Validation middleware
const approvalValidation = [
  body('proofId').isUUID().withMessage('Valid proof ID is required'),
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];

const bulkApprovalValidation = [
  body('proofIds').isArray().withMessage('Proof IDs must be an array'),
  body('proofIds.*').isUUID().withMessage('Each proof ID must be valid'),
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];

const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return (res as any).status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Routes
router.get('/pending',
  authMiddleware,
  requireRole(['upline', 'admin']),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['uploaded', 'escalated']).withMessage('Invalid status'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ApprovalController();
    await controller.getPendingApprovals(req, res);
  })
);

router.post('/review',
  authMiddleware,
  requireRole(['upline', 'admin']),
  approvalValidation,
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ApprovalController();
    await controller.reviewProof(req, res);
  })
);

router.post('/bulk-review',
  authMiddleware,
  requireRole(['admin']),
  bulkApprovalValidation,
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ApprovalController();
    await controller.bulkReviewProofs(req, res);
  })
);

router.get('/history',
  authMiddleware,
  requireRole(['upline', 'admin', 'auditor']),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
    query('status').optional().isIn(['approved', 'rejected']).withMessage('Invalid status'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ApprovalController();
    await controller.getApprovalHistory(req, res);
  })
);

router.get('/stats',
  authMiddleware,
  requireRole(['upline', 'admin', 'auditor']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ApprovalController();
    await controller.getApprovalStats(req, res);
  })
);

router.post('/escalate/:proofId',
  authMiddleware,
  requireRole(['upline']),
  param('proofId').isUUID(),
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ApprovalController();
    await controller.escalateProof(req, res);
  })
);

export { router as approvalRoutes };