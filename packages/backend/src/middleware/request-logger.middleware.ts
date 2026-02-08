import { Request, Response, NextFunction } from 'express';
import { logRequest } from '../config/logger';

/**
 * Request logging middleware
 * Logs request details for observability
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    const duration = Date.now() - startTime;
    
    // Extract user ID if available (from auth middleware)
    const userId = (req as any).user?.userId;

    // Log request completion
    logRequest(req.method, req.path, res.statusCode, duration, userId);

    return originalSend.call(this, data);
  };

  next();
}
