import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';

export class HealthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  healthCheck = async (req: Request, res: Response) => {
    const health = await this.authService.healthCheck();
    (res as any).json(health);
  };
}