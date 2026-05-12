import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import { DisputeController } from '../controllers/DisputeController';

const router = express.Router();

// Validation middleware
const createDisputeValidation = [
  body('proofId').isUUID().withMessage('Valid proof ID is required'),
  body('type').isIn(['amount_mismatch', 'invalid_proof', 'duplicate', 'other']).withMessage('Invalid dispute type'),
  body('reason').isString().isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
];

const resolveDisputeValidation = [
  body('resolution').isString().isLength({ min: 10, max: 1000 }).withMessage('Resolution must be 10-1000 characters'),
  body('status').isIn(['resolved', 'rejected']).withMessage('Status must be resolved or rejected'),
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
router.post('/',
  authMiddleware,
  createDisputeValidation,
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new DisputeController();
    await controller.createDispute(req, res);
  })
);

router.get('/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'resolved', 'rejected', 'escalated']).withMessage('Invalid status'),
    query('type').optional().isIn(['amount_mismatch', 'invalid_proof', 'duplicate', 'other']).withMessage('Invalid type'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new DisputeController();
    await controller.getDisputes(req, res);
  })
);

router.get('/:id',
  authMiddleware,
  param('id').isUUID(),
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new DisputeController();
    await controller.getDispute(req, res);
  })
);

router.post('/:id/resolve',
  authMiddleware,
  requireRole(['upline', 'admin']),
  param('id').isUUID(),
  resolveDisputeValidation,
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new DisputeController();
    await controller.resolveDispute(req, res);
  })
);

router.post('/:id/escalate',
  authMiddleware,
  requireRole(['upline']),
  param('id').isUUID(),
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new DisputeController();
    await controller.escalateDispute(req, res);
  })
);

router.get('/:id/messages',
  authMiddleware,
  param('id').isUUID(),
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new DisputeController();
    await controller.getDisputeMessages(req, res);
  })
);

router.post('/:id/messages',
  authMiddleware,
  param('id').isUUID(),
  [
    body('message').isString().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new DisputeController();
    await controller.addDisputeMessage(req, res);
  })
);

router.get('/stats',
  authMiddleware,
  requireRole(['admin', 'auditor']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new DisputeController();
    await controller.getDisputeStats(req, res);
  })
);

export { router as disputeRoutes };