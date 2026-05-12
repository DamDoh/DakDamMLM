import { Request, Response } from 'express';
import { GenealogyService } from '../services/GenealogyService';

export class HealthController {
  private genealogyService: GenealogyService;

  constructor() {
    this.genealogyService = new GenealogyService();
  }

  healthCheck = async (req: Request, res: Response) => {
    const health = await this.genealogyService.healthCheck();
      (res as any).json(health);
  };
}