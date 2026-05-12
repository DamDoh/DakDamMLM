import express from 'express';
import { AuthController } from '../controllers/AuthController';

const router = express.Router();
const authController = new AuthController();

// Authentication routes
router.post('/register', authController.register);
router.post('/bulk-register', authController.bulkRegister);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/change-password', authController.changePassword);

// OTP-based routes
router.post('/request-email-verification', authController.requestEmailVerification);
router.post('/verify-email', authController.verifyEmail);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);
router.post('/request-sms-verification', authController.requestSmsVerification);
router.post('/verify-sms', authController.verifySms);

export { router as authRoutes };