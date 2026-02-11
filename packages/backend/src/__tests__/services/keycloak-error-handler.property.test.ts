/**
 * Property-Based Tests for Keycloak Error Handler
 * 
 * Feature: keycloak-admin-integration
 */

import fc from 'fast-check';
import {
  mapKeycloakError,
  handleKeycloakOperation,
  executeDualStoreOperation,
  validateInput
} from '../../services/keycloak-error-handler';
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
  InternalError,
  ValidationError,
  AuthError,
  ForbiddenError,
  AppError
} from '../../middleware/errors';
import { logger } from '../../config/logger';

// Mock logger
jest.mock('../../config/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('Keycloak Error Handler - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 22: Keycloak Error Logging and Mapping
   * 
   * For any Keycloak Admin API error, the system should log the error details
   * and return an appropriate HTTP status code with a meaningful error message.
   * 
   * Validates: Requirements 11.1, 11.2
   */
  describe('Property 22: Keycloak Error Logging and Mapping', () => {
    it('should log error details and map to appropriate error class for any Keycloak error', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary HTTP status codes
          fc.oneof(
            fc.constant(400),
            fc.constant(401),
            fc.constant(403),
            fc.constant(404),
            fc.constant(409),
            fc.constant(422),
            fc.constant(500),
            fc.constant(502),
            fc.constant(503),
            fc.integer({ min: 400, max: 599 })
          ),
          // Generate arbitrary error messages
          fc.string({ minLength: 1, maxLength: 100 }),
          (status, message) => {
            // Clear previous mock calls
            (logger.error as jest.Mock).mockClear();

            // Create Keycloak error
            const keycloakError: any = {
              response: {
                status,
                data: { errorMessage: message }
              },
              message
            };

            // Map the error
            const mappedError = mapKeycloakError(keycloakError);

            // Property 1: Error should be logged
            expect(logger.error).toHaveBeenCalledWith(
              'Keycloak API error',
              expect.objectContaining({
                status,
                message
              })
            );

            // Property 2: Error should be mapped to AppError subclass
            expect(mappedError).toBeInstanceOf(Error);
            expect(mappedError).toBeInstanceOf(AppError);

            // Property 3: Mapped error should have appropriate status code
            const expectedStatusMap: Record<number, any> = {
              400: BadRequestError,
              401: AuthError,
              403: ForbiddenError,
              404: NotFoundError,
              409: ConflictError,
              422: ValidationError,
              500: InternalError,
              502: InternalError,
              503: InternalError
            };

            if (expectedStatusMap[status]) {
              expect(mappedError).toBeInstanceOf(expectedStatusMap[status]);
            } else {
              // Unknown status codes should map to InternalError
              expect(mappedError).toBeInstanceOf(InternalError);
            }

            // Property 4: Mapped error should contain meaningful message
            expect(mappedError.message).toBeTruthy();
            expect(typeof mappedError.message).toBe('string');
            expect(mappedError.message.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle errors with different message field locations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 599 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.oneof(
            fc.constant('errorMessage'),
            fc.constant('error_description'),
            fc.constant('error')
          ),
          (status, message, messageField) => {
            const keycloakError: any = {
              response: {
                status,
                data: { [messageField]: message }
              }
            };

            const mappedError = mapKeycloakError(keycloakError);

            // Error message should be extracted regardless of field name
            expect(mappedError.message).toContain(message);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle errors without response object', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 599 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (statusCode, message) => {
            const keycloakError: any = {
              statusCode,
              message
            };

            const mappedError = mapKeycloakError(keycloakError);

            // Should still map correctly
            expect(mappedError).toBeInstanceOf(AppError);
            expect(mappedError.message).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 22 (continued): Authentication Retry with Error Logging
   * 
   * For any Keycloak operation that fails with 401, the system should log the retry
   * attempt and re-authenticate before retrying.
   */
  describe('Property 22: Authentication Retry with Error Logging', () => {
    it('should log retry attempt and re-authenticate on 401 errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (operationName) => {
            (logger.warn as jest.Mock).mockClear();

            const mockKcAdmin = {
              ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
              authenticate: jest.fn().mockResolvedValue(undefined)
            } as any;

            const operation = jest.fn()
              .mockRejectedValueOnce({
                response: { status: 401 },
                message: 'Unauthorized'
              })
              .mockResolvedValueOnce('success');

            await handleKeycloakOperation(mockKcAdmin, operation, operationName);

            // Should log the retry attempt
            expect(logger.warn).toHaveBeenCalledWith(
              expect.stringContaining('401'),
              expect.objectContaining({
                operationName
              })
            );

            // Should re-authenticate
            expect(mockKcAdmin.authenticate).toHaveBeenCalled();

            // Should retry the operation
            expect(operation).toHaveBeenCalledTimes(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log error if retry fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (operationName) => {
            (logger.error as jest.Mock).mockClear();

            const mockKcAdmin = {
              ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
              authenticate: jest.fn().mockResolvedValue(undefined)
            } as any;

            const operation = jest.fn().mockRejectedValue({
              response: { status: 401 },
              message: 'Unauthorized'
            });

            try {
              await handleKeycloakOperation(mockKcAdmin, operation, operationName);
            } catch (error) {
              // Expected to throw
            }

            // Should log the failure after retry
            expect(logger.error).toHaveBeenCalledWith(
              expect.stringContaining('failed after retry'),
              expect.objectContaining({
                operationName
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 23: Database Failure Rollback
   * 
   * For any database operation failure during a multi-step operation,
   * the system should attempt to rollback any Keycloak changes made
   * in the same operation.
   * 
   * Validates: Requirements 11.3
   */
  describe('Property 23: Database Failure Rollback', () => {
    it('should rollback Keycloak changes when database operation fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (keycloakResult, dbErrorMessage) => {
            (logger.error as jest.Mock).mockClear();
            (logger.info as jest.Mock).mockClear();

            const keycloakOp = jest.fn().mockResolvedValue(keycloakResult);
            const databaseOp = jest.fn().mockRejectedValue(new Error(dbErrorMessage));
            const rollbackOp = jest.fn().mockResolvedValue(undefined);

            try {
              await executeDualStoreOperation(
                keycloakOp,
                databaseOp,
                rollbackOp,
                'test operation'
              );
            } catch (error: any) {
              // Expected to throw database error
              expect(error.message).toBe(dbErrorMessage);
            }

            // Property 1: Keycloak operation should have been executed
            expect(keycloakOp).toHaveBeenCalled();

            // Property 2: Database operation should have been attempted
            expect(databaseOp).toHaveBeenCalled();

            // Property 3: Rollback should have been executed
            expect(rollbackOp).toHaveBeenCalled();

            // Property 4: Rollback attempt should be logged
            expect(logger.error).toHaveBeenCalledWith(
              expect.stringContaining('rollback'),
              expect.any(Object)
            );

            // Property 5: Successful rollback should be logged
            expect(logger.info).toHaveBeenCalledWith(
              expect.stringContaining('rollback successful'),
              expect.any(Object)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not rollback if Keycloak operation fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (kcErrorMessage) => {
            const keycloakOp = jest.fn().mockRejectedValue(new Error(kcErrorMessage));
            const databaseOp = jest.fn();
            const rollbackOp = jest.fn();

            try {
              await executeDualStoreOperation(
                keycloakOp,
                databaseOp,
                rollbackOp,
                'test operation'
              );
            } catch (error: any) {
              // Expected to throw Keycloak error
              expect(error.message).toBe(kcErrorMessage);
            }

            // Property 1: Keycloak operation should have been attempted
            expect(keycloakOp).toHaveBeenCalled();

            // Property 2: Database operation should NOT have been executed
            expect(databaseOp).not.toHaveBeenCalled();

            // Property 3: Rollback should NOT have been executed
            expect(rollbackOp).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log rollback failure but throw original error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (dbErrorMessage, rollbackErrorMessage) => {
            (logger.error as jest.Mock).mockClear();

            const keycloakOp = jest.fn().mockResolvedValue('success');
            const databaseOp = jest.fn().mockRejectedValue(new Error(dbErrorMessage));
            const rollbackOp = jest.fn().mockRejectedValue(new Error(rollbackErrorMessage));

            try {
              await executeDualStoreOperation(
                keycloakOp,
                databaseOp,
                rollbackOp,
                'test operation'
              );
            } catch (error: any) {
              // Should throw original database error, not rollback error
              expect(error.message).toBe(dbErrorMessage);
            }

            // Rollback failure should be logged
            const errorCalls = (logger.error as jest.Mock).mock.calls;
            const rollbackFailureLog = errorCalls.find(
              call => call[0].includes('rollback failed')
            );
            expect(rollbackFailureLog).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve operation order: Keycloak first, then database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (result) => {
            const executionOrder: string[] = [];

            const keycloakOp = jest.fn().mockImplementation(async () => {
              executionOrder.push('keycloak');
              return result;
            });

            const databaseOp = jest.fn().mockImplementation(async () => {
              executionOrder.push('database');
              return result;
            });

            const rollbackOp = jest.fn();

            await executeDualStoreOperation(
              keycloakOp,
              databaseOp,
              rollbackOp,
              'test operation'
            );

            // Property: Keycloak must execute before database
            expect(executionOrder).toEqual(['keycloak', 'database']);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 24: Input Validation Error Response
   * 
   * For any request with invalid input data, the system should return
   * 400 Bad Request with detailed validation error messages.
   * 
   * Validates: Requirements 11.7
   */
  describe('Property 24: Input Validation Error Response', () => {
    it('should throw ValidationError with field details for any invalid input', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.option(fc.string(), { nil: undefined }),
            email: fc.option(fc.string(), { nil: undefined }),
            password: fc.option(fc.string(), { nil: undefined })
          }),
          (data) => {
            const rules: Record<string, (value: any) => string | null> = {
              name: (value) => {
                if (!value) return 'Name is required';
                if (value.length < 2) return 'Name must be at least 2 characters';
                return null;
              },
              email: (value) => {
                if (!value) return 'Email is required';
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) return 'Invalid email format';
                return null;
              },
              password: (value) => {
                if (!value) return 'Password is required';
                if (value.length < 8) return 'Password must be at least 8 characters';
                return null;
              }
            };

            // Count expected errors
            let expectedErrorCount = 0;
            for (const [field, validator] of Object.entries(rules)) {
              if (validator(data[field as keyof typeof data])) {
                expectedErrorCount++;
              }
            }

            if (expectedErrorCount > 0) {
              // Should throw ValidationError
              try {
                validateInput(data, rules);
                // If we get here, validation should have thrown
                expect(expectedErrorCount).toBe(0);
              } catch (error: any) {
                // Property 1: Should be ValidationError
                expect(error).toBeInstanceOf(ValidationError);

                // Property 2: Should have correct status code
                expect(error.statusCode).toBe(400);

                // Property 3: Should have field errors
                expect(error.fieldErrors).toBeDefined();
                expect(Array.isArray(error.fieldErrors)).toBe(true);

                // Property 4: Should have correct number of errors
                expect(error.fieldErrors.length).toBe(expectedErrorCount);

                // Property 5: Each error should have field and message
                error.fieldErrors.forEach((fieldError: any) => {
                  expect(fieldError.field).toBeDefined();
                  expect(fieldError.message).toBeDefined();
                  expect(typeof fieldError.field).toBe('string');
                  expect(typeof fieldError.message).toBe('string');
                });
              }
            } else {
              // Should not throw
              expect(() => validateInput(data, rules)).not.toThrow();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include field values in validation errors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          (invalidEmail) => {
            // Skip valid emails
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(invalidEmail)) return;

            const data = { email: invalidEmail };
            const rules = {
              email: (value: any) => {
                if (!value) return 'Email is required';
                if (!emailRegex.test(value)) return 'Invalid email format';
                return null;
              }
            };

            try {
              validateInput(data, rules);
            } catch (error: any) {
              expect(error).toBeInstanceOf(ValidationError);
              
              // Property: Field error should include the invalid value
              const emailError = error.fieldErrors.find((e: any) => e.field === 'email');
              expect(emailError).toBeDefined();
              expect(emailError.value).toBe(invalidEmail);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate all fields and collect all errors', () => {
      fc.assert(
        fc.property(
          fc.record({
            field1: fc.constant(''),
            field2: fc.constant(''),
            field3: fc.constant('')
          }),
          (data) => {
            const rules = {
              field1: (value: any) => !value ? 'Field1 is required' : null,
              field2: (value: any) => !value ? 'Field2 is required' : null,
              field3: (value: any) => !value ? 'Field3 is required' : null
            };

            try {
              validateInput(data, rules);
              fail('Should have thrown ValidationError');
            } catch (error: any) {
              // Property: Should collect all validation errors, not just the first one
              expect(error.fieldErrors.length).toBe(3);
              
              const fields = error.fieldErrors.map((e: any) => e.field);
              expect(fields).toContain('field1');
              expect(fields).toContain('field2');
              expect(fields).toContain('field3');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map validation errors to 422 status from Keycloak', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (errorMessage) => {
            const keycloakError: any = {
              response: {
                status: 422,
                data: { errorMessage }
              }
            };

            const mappedError = mapKeycloakError(keycloakError);

            // Property: 422 status should map to ValidationError
            expect(mappedError).toBeInstanceOf(ValidationError);
            expect(mappedError.message).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
