import { Request, Response } from 'express';
type NextFunction = (err?: any) => void;

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${(req as any).ip || 'unknown'}`);

  (res as any).on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${(res as any).statusCode} - ${duration}ms`);
  });

  next();
};

export const errorLogger = (error: any, req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Error: ${error.message}`);
  console.error(`[${timestamp}] Stack: ${error.stack}`);
  console.error(`[${timestamp}] URL: ${req.method} ${req.url}`);
  console.error(`[${timestamp}] Body:`, req.body);

  next(error);
};