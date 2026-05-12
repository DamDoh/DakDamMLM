"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = __importDefault(require("express"));
const AuthController_1 = require("../controllers/AuthController");
const router = express_1.default.Router();
exports.authRoutes = router;
const authController = new AuthController_1.AuthController();
// Authentication routes
router.post('/register', authController.register);
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
//# sourceMappingURL=authRoutes.js.map