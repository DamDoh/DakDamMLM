"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthService_1 = require("../services/AuthService");
class AuthController {
    constructor() {
        this.register = async (req, res) => {
            try {
                const result = await this.authService.registerUser(req.body);
                res.json(result);
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.login = async (req, res) => {
            try {
                const result = await this.authService.loginUser(req.body);
                res.json(result);
            }
            catch (error) {
                res.status(401).json({ error: error.message });
            }
        };
        this.refreshToken = async (req, res) => {
            try {
                const { refreshToken } = req.body;
                const tokens = await this.authService.refreshToken(refreshToken);
                res.json({ tokens });
            }
            catch (error) {
                res.status(401).json({ error: error.message });
            }
        };
        this.changePassword = async (req, res) => {
            try {
                const { userId, currentPassword, newPassword } = req.body;
                await this.authService.changePassword(userId, currentPassword, newPassword);
                res.json({ message: 'Password changed successfully' });
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.requestEmailVerification = async (req, res) => {
            try {
                const { userId, companyId } = req.body;
                const result = await this.authService.requestEmailVerification(userId, companyId);
                res.json(result);
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.verifyEmail = async (req, res) => {
            try {
                const { email, otpCode, companyId } = req.body;
                const result = await this.authService.verifyEmailWithOtp(email, otpCode, companyId);
                res.json(result);
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.requestPasswordReset = async (req, res) => {
            try {
                const { email, companyId } = req.body;
                const result = await this.authService.requestPasswordReset(email, companyId);
                res.json(result);
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.resetPassword = async (req, res) => {
            try {
                const { email, otpCode, newPassword, companyId } = req.body;
                const result = await this.authService.resetPasswordWithOtp(email, otpCode, newPassword, companyId);
                res.json(result);
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.requestSmsVerification = async (req, res) => {
            try {
                const { userId, companyId } = req.body;
                const result = await this.authService.requestSmsVerification(userId, companyId);
                res.json(result);
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.verifySms = async (req, res) => {
            try {
                const { phoneNumber, otpCode, companyId } = req.body;
                const result = await this.authService.verifySmsWithOtp(phoneNumber, otpCode, companyId);
                res.json(result);
            }
            catch (error) {
                res.status(400).json({ error: error.message });
            }
        };
        this.authService = new AuthService_1.AuthService();
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=AuthController.js.map