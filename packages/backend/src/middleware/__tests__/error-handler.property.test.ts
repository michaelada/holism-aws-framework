import * as fc from 'fast-check';
import { Request, Response } from 'express';
import { errorHandler } from '../error-handler.middleware';
import {
  ValidationError,
  NotFoundError,
  AuthError,
  ForbiddenError,
  InternalError,
  FieldError
} from '../errors';

/**
 * Feature: aws-web-app-framework, Property 24: Structured Error Responses
 * 
 * For any validation failure in the Generic_REST_API, the error response should include
 * a structured format with error code, message, and field-level details array.
 * 
 * Validates: Requirements 18.1
 */

describe('Property 24: Structured Error Responses', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    
    mockReq = {
      path: '/test',
      method: 'POST'
    };
    
    mockRes = {
      status: statusSpy,
      json: jsonSpy
    };
  });

  // Arbitrary for field errors
  const fieldErrorArbitrary = fc.record({
    field: fc.string({ minLength: 1, maxLength: 50 }),
    message: fc.string({ minLength: 1, maxLength: 200 }),
    value: fc.oneof(
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.constant(undefined)
    )
  });

  test('validation errors always return structured response with code, message, and field details', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(fieldErrorArbitrary, { minLength: 1, maxLength: 10 }),
        (errorMessage, fieldErrors) => {
          // Reset mocks
          jsonSpy.mockClear();
          statusSpy.mockClear();

          const error = new ValidationError(errorMessage, fieldErrors);
          
          errorHandler(
            error,
            mockReq as Request,
            mockRes as Response,
            jest.fn()
          );

          // Verify status code
          expect(statusSpy).toHaveBeenCalledWith(400);

          // Verify structured response
          expect(jsonSpy).toHaveBeenCalledTimes(1);
          const response = jsonSpy.mock.calls[0][0];

          // Must have error object
          expect(response).toHaveProperty('error');
          expect(typeof response.error).toBe('object');

          // Must have required fields
          expect(response.error).toHaveProperty('code');
          expect(response.error).toHaveProperty('message');
          expect(response.error).toHaveProperty('details');

          // Code must be VALIDATION_ERROR
          expect(response.error.code).toBe('VALIDATION_ERROR');

          // Message must match
          expect(response.error.message).toBe(errorMessage);

          // Details must be an array with field-level information
          expect(Array.isArray(response.error.details)).toBe(true);
          expect(response.error.details.length).toBe(fieldErrors.length);

          // Each detail must have field and message
          response.error.details.forEach((detail: FieldError, index: number) => {
            expect(detail).toHaveProperty('field');
            expect(detail).toHaveProperty('message');
            expect(detail.field).toBe(fieldErrors[index].field);
            expect(detail.message).toBe(fieldErrors[index].message);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('not found errors return structured response with code and message', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          jsonSpy.mockClear();
          statusSpy.mockClear();

          const error = new NotFoundError(errorMessage);
          
          errorHandler(
            error,
            mockReq as Request,
            mockRes as Response,
            jest.fn()
          );

          expect(statusSpy).toHaveBeenCalledWith(404);
          
          const response = jsonSpy.mock.calls[0][0];
          expect(response).toHaveProperty('error');
          expect(response.error).toHaveProperty('code', 'NOT_FOUND');
          expect(response.error).toHaveProperty('message', errorMessage);
          expect(response.error).not.toHaveProperty('details');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('auth errors return structured response with code and message', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new AuthError()),
          fc.constant(new AuthError('Custom auth message')),
          fc.constant(new ForbiddenError()),
          fc.constant(new ForbiddenError('Custom forbidden message'))
        ),
        (error) => {
          jsonSpy.mockClear();
          statusSpy.mockClear();

          errorHandler(
            error,
            mockReq as Request,
            mockRes as Response,
            jest.fn()
          );

          expect(statusSpy).toHaveBeenCalledWith(error.statusCode);
          
          const response = jsonSpy.mock.calls[0][0];
          expect(response).toHaveProperty('error');
          expect(response.error).toHaveProperty('code', error.code);
          expect(response.error).toHaveProperty('message', error.message);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('internal errors return structured response with code, message, and requestId', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          jsonSpy.mockClear();
          statusSpy.mockClear();

          const error = new InternalError(errorMessage);
          
          errorHandler(
            error,
            mockReq as Request,
            mockRes as Response,
            jest.fn()
          );

          expect(statusSpy).toHaveBeenCalledWith(500);
          
          const response = jsonSpy.mock.calls[0][0];
          expect(response).toHaveProperty('error');
          expect(response.error).toHaveProperty('code', 'INTERNAL_ERROR');
          expect(response.error).toHaveProperty('message', errorMessage);
          expect(response.error).toHaveProperty('requestId');
          expect(typeof response.error.requestId).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('unknown errors return structured response with sanitized message and requestId', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          jsonSpy.mockClear();
          statusSpy.mockClear();

          const error = new Error(errorMessage);
          
          errorHandler(
            error,
            mockReq as Request,
            mockRes as Response,
            jest.fn()
          );

          expect(statusSpy).toHaveBeenCalledWith(500);
          
          const response = jsonSpy.mock.calls[0][0];
          expect(response).toHaveProperty('error');
          expect(response.error).toHaveProperty('code', 'INTERNAL_ERROR');
          // Message should be sanitized, not the original error message
          expect(response.error.message).toBe('An unexpected error occurred');
          expect(response.error).toHaveProperty('requestId');
          expect(typeof response.error.requestId).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});
