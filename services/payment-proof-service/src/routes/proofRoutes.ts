import express, { Request, Response } from 'express';
import multer from 'multer';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, requireRole, requireUplineAccess, AuthRequest } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ProofController } from '../controllers/ProofController';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: any, cb: multer.FileFilterCallback) => {
    // Allow images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  },
});

// Validation middleware
const uploadValidation = [
  body('orderId').isUUID().withMessage('Valid order ID is required'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
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
router.post('/upload',
  authMiddleware,
  upload.single('proof'),
  uploadValidation,
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ProofController();
    await controller.uploadProof(req, res);
  })
);

router.get('/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ProofController();
    await controller.getProofs(req, res);
  })
);

router.get('/:id',
  authMiddleware,
  param('id').isUUID(),
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ProofController();
    await controller.getProof(req, res);
  })
);

router.get('/:id/download',
  authMiddleware,
  param('id').isUUID(),
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ProofController();
    await controller.downloadProof(req, res);
  })
);

router.delete('/:id',
  authMiddleware,
  requireRole(['admin']),
  param('id').isUUID(),
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ProofController();
    await controller.deleteProof(req, res);
  })
);

// QR Code routes
router.post('/qr-codes',
  authMiddleware,
  requireRole(['upline', 'admin']),
  [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('currency').optional().isString().withMessage('Currency must be a string'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ProofController();
    await controller.createQRCode(req, res);
  })
);

router.get('/qr-codes',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ProofController();
    await controller.getQRCodes(req, res);
  })
);

router.delete('/qr-codes/:id',
  authMiddleware,
  requireRole(['upline', 'admin']),
  param('id').isUUID(),
  handleValidationErrors,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const controller = new ProofController();
    await controller.deleteQRCode(req, res);
  })
);

export { router as proofRoutes };