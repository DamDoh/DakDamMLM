"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proofRoutes = void 0;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const express_validator_1 = require("express-validator");
const authMiddleware_1 = require("../middleware/authMiddleware");
const errorHandler_1 = require("../middleware/errorHandler");
const ProofController_1 = require("../controllers/ProofController");
const router = express_1.default.Router();
exports.proofRoutes = router;
// Configure multer for file uploads
const upload = (0, multer_1.default)({
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images and PDFs
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
        }
    },
});
// Validation middleware
const uploadValidation = [
    (0, express_validator_1.body)('orderId').isUUID().withMessage('Valid order ID is required'),
    (0, express_validator_1.body)('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
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
router.post('/upload', authMiddleware_1.authMiddleware, upload.single('proof'), uploadValidation, handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ProofController_1.ProofController();
    await controller.uploadProof(req, res);
}));
router.get('/', authMiddleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ProofController_1.ProofController();
    await controller.getProofs(req, res);
}));
router.get('/:id', authMiddleware_1.authMiddleware, (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ProofController_1.ProofController();
    await controller.getProof(req, res);
}));
router.get('/:id/download', authMiddleware_1.authMiddleware, (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ProofController_1.ProofController();
    await controller.downloadProof(req, res);
}));
router.delete('/:id', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['admin']), (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ProofController_1.ProofController();
    await controller.deleteProof(req, res);
}));
// QR Code routes
router.post('/qr-codes', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['upline', 'admin']), [
    (0, express_validator_1.body)('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    (0, express_validator_1.body)('currency').optional().isString().withMessage('Currency must be a string'),
], handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ProofController_1.ProofController();
    await controller.createQRCode(req, res);
}));
router.get('/qr-codes', authMiddleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ProofController_1.ProofController();
    await controller.getQRCodes(req, res);
}));
router.delete('/qr-codes/:id', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireRole)(['upline', 'admin']), (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const controller = new ProofController_1.ProofController();
    await controller.deleteQRCode(req, res);
}));
//# sourceMappingURL=proofRoutes.js.map