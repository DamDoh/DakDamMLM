import { Request, Response } from 'express';
import { CampaignService } from '../services/CampaignService';

export class CampaignController {
  private campaignService: CampaignService;

  constructor() {
    this.campaignService = new CampaignService();
  }

  createCampaign = async (req: Request, res: Response) => {
    try {
      const campaign = await this.campaignService.createCampaign((req as any).body);

      (res as any).status(201).json({
        success: true,
        data: campaign,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getCampaigns = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10, status, type } = (req as any).query;

      const result = await this.campaignService.getCampaigns({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        type: type as string,
      });

      (res as any).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getCampaign = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const campaign = await this.campaignService.getCampaignById(id);

      if (!campaign) {
        return (res as any).status(404).json({
          success: false,
          error: 'Campaign not found',
          timestamp: new Date().toISOString(),
          requestId: (res as any).get('X-Request-ID'),
        });
      }

      (res as any).json({
        success: true,
        data: campaign,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  updateCampaign = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const campaign = await this.campaignService.updateCampaign(id, (req as any).body);

      (res as any).json({
        success: true,
        data: campaign,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  deleteCampaign = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      await this.campaignService.deleteCampaign(id);

      (res as any).json({
        success: true,
        message: 'Campaign deleted successfully',
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  executeCampaign = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const result = await this.campaignService.executeCampaign(id);

      (res as any).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  scheduleCampaign = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const { scheduledAt } = (req as any).body;

      const campaign = await this.campaignService.scheduleCampaign(id, new Date(scheduledAt));

      (res as any).json({
        success: true,
        data: campaign,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  cancelCampaign = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const campaign = await this.campaignService.cancelCampaign(id);

      (res as any).json({
        success: true,
        data: campaign,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getCampaignAnalytics = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const analytics = await this.campaignService.getCampaignAnalytics(id);

      (res as any).json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getCampaignsAnalytics = async (req: Request, res: Response) => {
    try {
      const { period = 'month' } = (req as any).query;
      const analytics = await this.campaignService.getCampaignsAnalytics({
        period: period as string,
      });

      (res as any).json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };
}