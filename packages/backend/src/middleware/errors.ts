/**
 * Custom error classes for the application
 */

export interface FieldError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400 Bad Request)
 */
export class ValidationError extends AppError {
  constructor(message: string, public fieldErrors: FieldError[] = []) {
    super(400, 'VALIDATION_ERROR', message, fieldErrors);
  }
}

/**
 * Not found error (404 Not Found)
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

/**
 * Authentication error (401 Unauthorized)
 */
export class AuthError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

/**
 * Authorization error (403 Forbidden)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, 'FORBIDDEN', message);
  }
}

/**
 * Conflict error (409 Conflict)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

/**
 * Bad request error (400 Bad Request)
 */
export class BadRequestError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

/**
 * Internal server error (500 Internal Server Error)
 */
export class InternalError extends AppError {
  constructor(message: string = 'An unexpected error occurred', public requestId?: string) {
    super(500, 'INTERNAL_ERROR', message);
  }
}
