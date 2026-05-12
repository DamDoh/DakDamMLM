import { Request, Response } from 'express';
import { CommissionService } from '../services/CommissionService';

export class HealthController {
  private commissionService: CommissionService;

  constructor() {
    this.commissionService = new CommissionService();
  }

  healthCheck = async (req: Request, res: Response) => {
    const resAny = res as any;
    const health = await this.commissionService.healthCheck();
    resAny.json(health);
  };
}