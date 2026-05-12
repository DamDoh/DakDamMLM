import { Request, Response } from 'express';
type NextFunction = (err?: any) => void;

export const validateUserId = (req: Request, res: Response, next: NextFunction) => {
  const { userId } = (req as any).params;

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return (res as any).status(400).json({
      success: false,
      error: 'Valid userId is required',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  next();
};

export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const { page, limit } = (req as any).query;

  const pageNum = page ? parseInt(page as string) : 1;
  const limitNum = limit ? parseInt(limit as string) : 10;

  if (isNaN(pageNum) || pageNum < 1) {
    return (res as any).status(400).json({
      success: false,
      error: 'Page must be a positive integer',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return (res as any).status(400).json({
      success: false,
      error: 'Limit must be between 1 and 100',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  // Attach validated values to request
  (req as any).pagination = { page: pageNum, limit: limitNum };
  next();
};

export const validateCommissionData = (req: Request, res: Response, next: NextFunction) => {
  const { userId, orderId, amount } = (req as any).body;

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return (res as any).status(400).json({
      success: false,
      error: 'Valid userId is required',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
    return (res as any).status(400).json({
      success: false,
      error: 'Valid orderId is required',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return (res as any).status(400).json({
      success: false,
      error: 'Valid amount (greater than 0) is required',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  next();
};

export const validateBatchCommissions = (req: Request, res: Response, next: NextFunction) => {
  const { orders } = (req as any).body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return (res as any).status(400).json({
      success: false,
      error: 'Orders array is required and cannot be empty',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  if (orders.length > 100) {
    return (res as any).status(400).json({
      success: false,
      error: 'Cannot process more than 100 orders at once',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  // Validate each order
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (!order.userId || !order.id || !order.amount) {
      return (res as any).status(400).json({
        success: false,
        error: `Order ${i + 1} is missing required fields (userId, id, amount)`,
        timestamp: new Date().toISOString(),
        requestId: generateRequestId(),
      });
    }

    if (typeof order.amount !== 'number' || order.amount <= 0) {
      return (res as any).status(400).json({
        success: false,
        error: `Order ${i + 1} has invalid amount`,
        timestamp: new Date().toISOString(),
        requestId: generateRequestId(),
      });
    }
  }

  next();
};

export const validateDateRange = (req: Request, res: Response, next: NextFunction) => {
  const { startDate, endDate } = (req as any).query;

  if (!startDate || !endDate) {
    return (res as any).status(400).json({
      success: false,
      error: 'Both startDate and endDate are required',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return (res as any).status(400).json({
      success: false,
      error: 'Invalid date format',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  if (start > end) {
    return (res as any).status(400).json({
      success: false,
      error: 'startDate cannot be after endDate',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  // Check date range is not too large (max 1 year)
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 365) {
    return (res as any).status(400).json({
      success: false,
      error: 'Date range cannot exceed 1 year',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  next();
};

export const validatePeriod = (req: Request, res: Response, next: NextFunction) => {
  const { period } = (req as any).query;
  const validPeriods = ['week', 'month', 'quarter', 'year'];

  if (period && !validPeriods.includes(period as string)) {
    return (res as any).status(400).json({
      success: false,
      error: 'Invalid period. Must be one of: week, month, quarter, year',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  next();
};

export const validateTopEarners = (req: Request, res: Response, next: NextFunction) => {
  const { limit, period } = (req as any).query;
  const validPeriods = ['week', 'month', 'quarter', 'year'];

  if (limit) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return (res as any).status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100',
        timestamp: new Date().toISOString(),
        requestId: generateRequestId(),
      });
    }
  }

  if (period && !validPeriods.includes(period as string)) {
    return (res as any).status(400).json({
      success: false,
      error: 'Invalid period. Must be one of: week, month, quarter, year',
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
    });
  }

  next();
};

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}