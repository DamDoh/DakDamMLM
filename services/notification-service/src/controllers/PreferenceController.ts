import { Request, Response } from 'express';
import { PreferenceService } from '../services/PreferenceService';

export class PreferenceController {
  private preferenceService: PreferenceService;

  constructor() {
    this.preferenceService = new PreferenceService();
  }

  getUserPreferences = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const preferences = await this.preferenceService.getUserPreferences(userId);

      (res as any).json({
        success: true,
        data: preferences,
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

  createUserPreferences = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const preferences = await this.preferenceService.createUserPreferences(userId, (req as any).body);

      (res as any).status(201).json({
        success: true,
        data: preferences,
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

  updateUserPreferences = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const preferences = await this.preferenceService.updateUserPreferences(userId, (req as any).body);

      (res as any).json({
        success: true,
        data: preferences,
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

  bulkUpdatePreferences = async (req: Request, res: Response) => {
    try {
      const { updates } = (req as any).body;
      const results = await this.preferenceService.bulkUpdatePreferences(updates);

      (res as any).json({
        success: true,
        data: results,
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

  getPreferencesAnalytics = async (req: Request, res: Response) => {
    try {
      const analytics = await this.preferenceService.getPreferencesAnalytics();

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