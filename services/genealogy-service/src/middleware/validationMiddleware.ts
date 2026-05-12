import { Request, Response } from 'express';
import { ValidationUtils } from '../../../../shared/utils';
type NextFunction = (err?: any) => void;

export const validateUserId = (req: Request, res: Response, next: NextFunction) => {
  const { userId } = (req as any).params;

  if (!userId || !ValidationUtils.isValidUUID(userId)) {
    return (res as any).status(400).json({ error: 'Valid userId parameter required' });
  }

  next();
};

export const validateMoveDownline = (req: Request, res: Response, next: NextFunction) => {
  const { userId, newParentId, position } = (req as any).body;

  if (!userId || !ValidationUtils.isValidUUID(userId)) {
    return (res as any).status(400).json({ error: 'Valid userId required' });
  }

  if (!newParentId || !ValidationUtils.isValidUUID(newParentId)) {
    return (res as any).status(400).json({ error: 'Valid newParentId required' });
  }

  if (!position || !['left', 'right'].includes(position)) {
    return (res as any).status(400).json({ error: 'Position must be either "left" or "right"' });
  }

  next();
};

export const validateTreeDepth = (req: Request, res: Response, next: NextFunction) => {
  const { depth } = (req as any).query;

  if (depth) {
    const depthNum = parseInt(depth as string);
    if (isNaN(depthNum) || depthNum < 1 || depthNum > 10) {
      return (res as any).status(400).json({ error: 'Depth must be a number between 1 and 10' });
    }
  }

  next();
};