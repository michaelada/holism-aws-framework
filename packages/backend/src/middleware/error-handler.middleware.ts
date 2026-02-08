import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import {
  AppError,
  ValidationError,
  NotFoundError,
  AuthError,
  ForbiddenError
} from './errors';

/**
 * Error response interface
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    requestId?: string;
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Error handling middleware
 * Converts exceptions to standardized error responses
 * Logs detailed error information while returning sanitized messages to users
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Generate request ID for tracking
  const requestId = generateRequestId();

  // Handle known application errors
  if (error instanceof ValidationError) {
    logger.warn('Validation error', {
      requestId,
      path: req.path,
      method: req.method,
      error: error.message,
      fieldErrors: error.fieldErrors
    });

    const response: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: error.fieldErrors
      }
    };

    res.status(error.statusCode).json(response);
    return;
  }

  if (error instanceof NotFoundError) {
    logger.info('Not found error', {
      requestId,
      path: req.path,
      method: req.method,
      error: error.message
    });

    const response: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message
      }
    };

    res.status(error.statusCode).json(response);
    return;
  }

  if (error instanceof AuthError || error instanceof ForbiddenError) {
    logger.warn('Authentication/Authorization error', {
      requestId,
      path: req.path,
      method: req.method,
      error: error.message,
      statusCode: error.statusCode
    });

    const response: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message
      }
    };

    res.status(error.statusCode).json(response);
    return;
  }

  if (error instanceof AppError) {
    logger.error('Application error', {
      requestId,
      path: req.path,
      method: req.method,
      error: error.message,
      statusCode: error.statusCode,
      stack: error.stack
    });

    const response: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        requestId
      }
    };

    res.status(error.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  logger.error('Unexpected error', {
    requestId,
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack,
    name: error.name
  });

  // Return sanitized error to user
  const response: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId
    }
  };

  res.status(500).json(response);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors and pass them to error handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
