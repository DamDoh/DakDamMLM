import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response) => {
    try {
      const result = await this.authService.registerUser(req.body as any);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const result = await this.authService.loginUser(req.body as any);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(401).json({ error: error.message });
    }
  };

  refreshToken = async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body as any;
      const tokens = await this.authService.refreshToken(refreshToken);
      (res as any).json({ tokens });
    } catch (error: any) {
      (res as any).status(401).json({ error: error.message });
    }
  };

  changePassword = async (req: Request, res: Response) => {
    try {
      const { userId, currentPassword, newPassword } = req.body as any;
      await this.authService.changePassword(userId, currentPassword, newPassword);
      (res as any).json({ message: 'Password changed successfully' });
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  requestEmailVerification = async (req: Request, res: Response) => {
    try {
      const { userId, companyId } = req.body as any;
      const result = await this.authService.requestEmailVerification(userId, companyId);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  verifyEmail = async (req: Request, res: Response) => {
    try {
      const { email, otpCode, companyId } = req.body as any;
      const result = await this.authService.verifyEmailWithOtp(email, otpCode, companyId);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  requestPasswordReset = async (req: Request, res: Response) => {
    try {
      const { email, companyId } = req.body as any;
      const result = await this.authService.requestPasswordReset(email, companyId);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  resetPassword = async (req: Request, res: Response) => {
    try {
      const { email, otpCode, newPassword, companyId } = req.body as any;
      const result = await this.authService.resetPasswordWithOtp(email, otpCode, newPassword, companyId);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  requestSmsVerification = async (req: Request, res: Response) => {
    try {
      const { userId, companyId } = req.body as any;
      const result = await this.authService.requestSmsVerification(userId, companyId);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  verifySms = async (req: Request, res: Response) => {
    try {
      const { phoneNumber, otpCode, companyId } = req.body as any;
      const result = await this.authService.verifySmsWithOtp(phoneNumber, otpCode, companyId);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  bulkRegister = async (req: Request, res: Response) => {
    try {
      const users = req.body as any[];
      const result = await this.authService.bulkRegisterUsers(users);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };
}