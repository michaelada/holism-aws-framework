import * as fc from 'fast-check';
import { Request, Response } from 'express';
import { errorHandler } from '../error-handler.middleware';
import { logger } from '../../config/logger';
import {
  ValidationError,
  NotFoundError,
  InternalError
} from '../errors';

/**
 * Feature: aws-web-app-framework, Property 27: Error Logging vs User Messages
 * 
 * For any error, the Framework should log detailed technical information (stack trace, request details)
 * while displaying simplified, user-friendly messages in the UI.
 * 
 * Validates: Requirements 18.4
 */

// Mock logger
jest.mock('../../config/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('Property 27: Error Logging vs User Messages', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    
    mockReq = {
      path: '/test/path',
      method: 'POST'
    };
    
    mockRes = {
      status: statusSpy,
      json: jsonSpy
    };

    // Clear mock calls
    jest.clearAllMocks();
  });

  test('unknown errors log detailed information including stack but return sanitized message to user', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          const error = new Error(errorMessage);
          
          errorHandler(
            error,
            mockReq as Request,
            mockRes as Response,
            jest.fn()
          );

          // Verify detailed logging occurred
          expect(logger.error).toHaveBeenCalled();
          const logCall = (logger.error as jest.Mock).mock.calls[0];
          
          // Log should contain detailed information
          expect(logCall[0]).toBe('Unexpected error');
          expect(logCall[1]).toHaveProperty('requestId');
          expect(logCall[1]).toHaveProperty('path', '/test/path');
          expect(logCall[1]).toHaveProperty('method', 'POST');
          expect(logCall[1]).toHaveProperty('error');
          expect(logCall[1]).toHaveProperty('stack');
          expect(typeof logCall[1].error).toBe('string');
          expect(typeof logCall[1].stack).toBe('string');
          expect(logCall[1].stack).toContain('Error');

          // User response should be sanitized
          const response = jsonSpy.mock.calls[0][0];
          expect(response.error.message).toBe('An unexpected error occurred');
          // Should not expose stack trace to user
          expect(response.error).not.toHaveProperty('stack');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('validation errors log field details while user response contains structured errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(
          fc.record({
            field: fc.string({ minLength: 1, maxLength: 50 }),
            message: fc.string({ minLength: 1, maxLength: 200 }),
            value: fc.oneof(fc.string(), fc.integer(), fc.boolean())
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (errorMessage, fieldErrors) => {
          const error = new ValidationError(errorMessage, fieldErrors);
          
          errorHandler(
            error,
            mockReq as Request,
            mockRes as Response,
            jest.fn()
          );

          // Verify logging occurred with details
          expect(logger.warn).toHaveBeenCalled();
          const logCall = (logger.warn as jest.Mock).mock.calls[0];
          
          expect(logCall[0]).toBe('Validation error');
          expect(logCall[1]).toHaveProperty('requestId');
          expect(logCall[1]).toHaveProperty('path');
          expect(logCall[1]).toHaveProperty('method');
          expect(logCall[1]).toHaveProperty('error');
          expect(logCall[1]).toHaveProperty('fieldErrors');
          // Verify field errors are logged
          expect(Array.isArray(logCall[1].fieldErrors)).toBe(true);
          expect(logCall[1].fieldErrors.length).toBeGreaterThan(0);

          // User response should contain structured error info
          const response = jsonSpy.mock.calls[0][0];
          expect(response.error).toHaveProperty('message');
          expect(response.error).toHaveProperty('details');
          expect(Array.isArray(response.error.details)).toBe(true);
          // But should not contain internal details like stack traces
          expect(response.error).not.toHaveProperty('stack');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('internal errors log full details including stack but user gets generic message with requestId', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          const error = new InternalError(errorMessage);
          
          errorHandler(
            error,
            mockReq as Request,
            mockRes as Response,
            jest.fn()
          );

          // Verify detailed logging
          expect(logger.error).toHaveBeenCalled();
          const logCall = (logger.error as jest.Mock).mock.calls[0];
          
          expect(logCall[0]).toBe('Application error');
          expect(logCall[1]).toHaveProperty('requestId');
          expect(logCall[1]).toHaveProperty('path');
          expect(logCall[1]).toHaveProperty('method');
          expect(logCall[1]).toHaveProperty('error');
          expect(logCall[1]).toHaveProperty('stack');
          expect(typeof logCall[1].stack).toBe('string');

          // User response should have requestId for tracking
          const response = jsonSpy.mock.calls[0][0];
          expect(response.error).toHaveProperty('message');
          expect(response.error).toHaveProperty('requestId');
          expect(typeof response.error.requestId).toBe('string');
          // Should not expose stack trace to user
          expect(response.error).not.toHaveProperty('stack');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('not found errors log request details but user gets simple message', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          const error = new NotFoundError(errorMessage);
          
          errorHandler(
            error,
            mockReq as Request,
            mockRes as Response,
            jest.fn()
          );

          // Verify logging occurred (info level for not found)
          expect(logger.info).toHaveBeenCalled();
          const logCall = (logger.info as jest.Mock).mock.calls[0];
          
          expect(logCall[0]).toBe('Not found error');
          expect(logCall[1]).toHaveProperty('requestId');
          expect(logCall[1]).toHaveProperty('path');
          expect(logCall[1]).toHaveProperty('method');
          expect(logCall[1]).toHaveProperty('error');

          // User response should be simple and clear
          const response = jsonSpy.mock.calls[0][0];
          expect(response.error).toHaveProperty('message');
          expect(response.error.code).toBe('NOT_FOUND');
          expect(response.error).not.toHaveProperty('stack');
        }
      ),
      { numRuns: 100 }
    );
  });
});
