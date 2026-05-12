import { Request, Response } from 'express';
import { GenealogyService } from '../services/GenealogyService';
import { GenealogyServiceResponse } from '../models/GenealogyTypes';
import { generateRequestId } from '../../../../shared/utils';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    memberId?: string;
    isAdmin: boolean;
  };
}

export class GenealogyController {
  private genealogyService: GenealogyService;

  constructor() {
    this.genealogyService = new GenealogyService();
  }

  private createResponse<T>(data: T, success: boolean = true, error?: string): GenealogyServiceResponse<T> {
    return {
      success,
      data: success ? data : undefined,
      error: !success ? error : undefined,
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    };
  }

  getGenealogyTree = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const { depth = 3 } = (req as any).query;

      // Users can only view their own tree or admin can view any
      if (!req.user?.isAdmin && req.user?.id !== userId) {
        return (res as any).status(403).json(this.createResponse(null, false, 'Access denied'));
      }

      const tree = await this.genealogyService.getGenealogyTree(userId, parseInt(depth as string));
      (res as any).json(this.createResponse(tree));
    } catch (error: any) {
      console.error('Controller error:', error);
      const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
      (res as any).status(statusCode).json(this.createResponse(null, false, error.message));
    }
  };

  getDownline = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const { maxLevel, includeStats = false, includeInactive = false } = (req as any).query;

      // Users can only view their own downline or admin can view any
      if (!req.user?.isAdmin && req.user?.id !== userId) {
        return (res as any).status(403).json(this.createResponse(null, false, 'Access denied'));
      }

      const downline = await this.genealogyService.getDownline(
        userId,
        maxLevel ? parseInt(maxLevel as string) : undefined,
        includeStats === 'true',
        includeInactive === 'true'
      );
      (res as any).json(this.createResponse(downline));
    } catch (error: any) {
      console.error('Controller error:', error);
      const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
      (res as any).status(statusCode).json(this.createResponse(null, false, error.message));
    }
  };

  getUpline = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = (req as any).params;

      // Users can only view their own upline or admin can view any
      if (!req.user?.isAdmin && req.user?.id !== userId) {
        return (res as any).status(403).json(this.createResponse(null, false, 'Access denied'));
      }

      const upline = await this.genealogyService.getUpline(userId);
      (res as any).json(this.createResponse(upline));
    } catch (error: any) {
      console.error('Controller error:', error);
      const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
      (res as any).status(statusCode).json(this.createResponse(null, false, error.message));
    }
  };

  moveDownline = async (req: Request, res: Response) => {
    try {
      const { userId, newParentId, position } = (req as any).body;
      const result = await this.genealogyService.moveDownline(userId, newParentId, position);
      (res as any).json(result);
    } catch (error: any) {
      (res as any).status(400).json({ error: error.message });
    }
  };

  getGenealogyStats = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const stats = await this.genealogyService.getGenealogyStats(userId);
      (res as any).json(stats);
    } catch (error: any) {
      (res as any).status(500).json({ error: error.message });
    }
  };

  getPlacementInfo = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = (req as any).params;

      // Users can only view their own placement or admin can view any
      if (!req.user?.isAdmin && req.user?.id !== userId) {
        return (res as any).status(403).json(this.createResponse(null, false, 'Access denied'));
      }

      const placement = await this.genealogyService.getPlacementInfo(userId);
      (res as any).json(this.createResponse(placement));
    } catch (error: any) {
      console.error('Controller error:', error);
      const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
      (res as any).status(statusCode).json(this.createResponse(null, false, error.message));
    }
  };

  getBinaryTree = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const { depth = 3 } = (req as any).query;

      // Users can only view their own tree or admin can view any
      if (!req.user?.isAdmin && req.user?.id !== userId) {
        return (res as any).status(403).json(this.createResponse(null, false, 'Access denied'));
      }

      const tree = await this.genealogyService.getBinaryTree(userId, parseInt(depth as string));
      (res as any).json(this.createResponse(tree));
    } catch (error: any) {
      console.error('Controller error:', error);
      const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
      (res as any).status(statusCode).json(this.createResponse(null, false, error.message));
    }
  };

  getDownlinePaginated = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = (req as any).params;
      const {
        page = 1,
        limit = 50,
        includeInactive = false,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = (req as any).query;

      // Users can only view their own downline or admin can view any
      if (!req.user?.isAdmin && req.user?.id !== userId) {
        return (res as any).status(403).json(this.createResponse(null, false, 'Access denied'));
      }

      const validSortBy = ['createdAt', 'pv', 'rank'].includes(sortBy as string) 
        ? (sortBy as 'createdAt' | 'pv' | 'rank')
        : 'createdAt';

      const result = await this.genealogyService.getDownlineWithPagination(
        userId,
        parseInt(page as string),
        parseInt(limit as string),
        includeInactive === 'true',
        validSortBy,
        sortOrder as 'asc' | 'desc'
      );
      (res as any).json(this.createResponse(result));
    } catch (error: any) {
      console.error('Controller error:', error);
      const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
      (res as any).status(statusCode).json(this.createResponse(null, false, error.message));
    }
  };

  validatePlacement = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, newParentId, position } = (req as any).body;

      // Only admins can validate placements
      if (!req.user?.isAdmin) {
        return (res as any).status(403).json(this.createResponse(null, false, 'Admin access required'));
      }

      const validation = await this.genealogyService.validatePlacementMove(
        userId,
        newParentId,
        position
      );
      (res as any).json(this.createResponse(validation));
    } catch (error: any) {
      console.error('Controller error:', error);
      (res as any).status(500).json(this.createResponse(null, false, error.message));
    }
  };

  getGenealogyMetrics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = (req as any).params;

      // Users can only view their own metrics or admin can view any
      if (!req.user?.isAdmin && req.user?.id !== userId) {
        return (res as any).status(403).json(this.createResponse(null, false, 'Access denied'));
      }

      const metrics = await this.genealogyService.getGenealogyMetrics(userId);
      (res as any).json(this.createResponse(metrics));
    } catch (error: any) {
      console.error('Controller error:', error);
      const statusCode = error.code === 'NOT_FOUND' ? 404 : 500;
      (res as any).status(statusCode).json(this.createResponse(null, false, error.message));
    }
  };

  bulkUpdateGenealogy = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const operations = (req as any).body.operations;

      // Only admins can perform bulk operations
      if (!req.user?.isAdmin) {
        return (res as any).status(403).json(this.createResponse(null, false, 'Admin access required'));
      }

      const result = await this.genealogyService.bulkUpdateGenealogy(operations);
      (res as any).json(this.createResponse(result));
    } catch (error: any) {
      console.error('Controller error:', error);
      (res as any).status(500).json(this.createResponse(null, false, error.message));
    }
  };
}