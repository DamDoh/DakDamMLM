import { Request, Response } from 'express';
import { TemplateService } from '../services/TemplateService';

export class TemplateController {
  private templateService: TemplateService;

  constructor() {
    this.templateService = new TemplateService();
  }

  createTemplate = async (req: Request, res: Response) => {
    try {
      const template = await this.templateService.createTemplate((req as any).body);

      (res as any).status(201).json({
        success: true,
        data: template,
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

  getTemplates = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10, type, channel, isActive } = (req as any).query;

      const result = await this.templateService.getTemplates({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        type: type as string,
        channel: channel as string,
        isActive: isActive === 'true',
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

  getTemplate = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const template = await this.templateService.getTemplateById(id);

      if (!template) {
        return (res as any).status(404).json({
          success: false,
          error: 'Template not found',
          timestamp: new Date().toISOString(),
          requestId: (res as any).get('X-Request-ID'),
        });
      }

      (res as any).json({
        success: true,
        data: template,
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

  updateTemplate = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const template = await this.templateService.updateTemplate(id, (req as any).body);

      (res as any).json({
        success: true,
        data: template,
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

  deleteTemplate = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      await this.templateService.deleteTemplate(id);

      (res as any).json({
        success: true,
        message: 'Template deleted successfully',
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

  renderTemplate = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const { variables } = (req as any).body;

      const rendered = await this.templateService.renderTemplate(id, variables);

      (res as any).json({
        success: true,
        data: rendered,
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

  getTemplateAnalytics = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const { period = 'month' } = (req as any).query;

      const analytics = await this.templateService.getTemplateAnalytics(id, {
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