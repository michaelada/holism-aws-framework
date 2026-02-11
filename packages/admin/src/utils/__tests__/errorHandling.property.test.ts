import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { handleApiCall, getErrorMessage, isRetryableError } from '../errorHandling';
import { ApiError, NetworkError } from '../../services/adminApi';

/**
 * Feature: keycloak-admin-integration, Property 25: Frontend Error Display
 * 
 * For any failed operation in the Admin Frontend, the system should display
 * a user-friendly error message to the user.
 * 
 * Validates: Requirements 6.18, 11.8
 */
describe('Property 25: Frontend Error Display', () => {
  it('should display error messages for all types of failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // API errors with various status codes
          fc.record({
            type: fc.constant('api'),
            status: fc.integer({ min: 400, max: 599 }),
            code: fc.string({ minLength: 1, maxLength: 50 }),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          // Network errors
          fc.record({
            type: fc.constant('network'),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          // Generic errors
          fc.record({
            type: fc.constant('generic'),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          })
        ),
        fc.boolean(), // shouldShowError flag
        async (errorConfig, shouldShowError) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          // Create API call that throws the specified error
          const apiCall = async () => {
            if (errorConfig.type === 'api') {
              throw new ApiError(
                errorConfig.status,
                errorConfig.code,
                errorConfig.message
              );
            } else if (errorConfig.type === 'network') {
              throw new NetworkError(errorConfig.message);
            } else {
              throw new Error(errorConfig.message);
            }
          };

          // Execute API call with error handling
          const result = await handleApiCall(
            apiCall,
            { showError: shouldShowError },
            showSuccess,
            showError
          );

          // Property: Error should be captured
          expect(result.error).not.toBeNull();
          expect(result.data).toBeNull();

          // Property: Error message should be displayed if showError is true
          if (shouldShowError) {
            expect(showError).toHaveBeenCalledTimes(1);
            const displayedMessage = showError.mock.calls[0][0];
            expect(displayedMessage).toBeTruthy();
            expect(typeof displayedMessage).toBe('string');
            expect(displayedMessage.length).toBeGreaterThan(0);
          } else {
            expect(showError).not.toHaveBeenCalled();
          }

          // Property: Success should never be shown on error
          expect(showSuccess).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should extract user-friendly error messages from all error types', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            type: fc.constant('api'),
            status: fc.integer({ min: 400, max: 599 }),
            code: fc.string({ minLength: 1 }),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          fc.record({
            type: fc.constant('network'),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          fc.record({
            type: fc.constant('generic'),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          })
        ),
        (errorConfig) => {
          let error: Error;

          if (errorConfig.type === 'api') {
            error = new ApiError(
              errorConfig.status,
              errorConfig.code,
              errorConfig.message
            );
          } else if (errorConfig.type === 'network') {
            error = new NetworkError(errorConfig.message);
          } else {
            error = new Error(errorConfig.message);
          }

          const message = getErrorMessage(error);

          // Property: Message should always be a non-empty string
          expect(typeof message).toBe('string');
          expect(message.length).toBeGreaterThan(0);

          // Property: Message should match the error's message
          expect(message).toBe(errorConfig.message);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle custom error messages consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }), // custom error message
        fc.string({ minLength: 1, maxLength: 200 }), // actual error message
        async (customMessage, actualMessage) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          const apiCall = async () => {
            throw new ApiError(500, 'SERVER_ERROR', actualMessage);
          };

          await handleApiCall(
            apiCall,
            { errorMessage: customMessage },
            showSuccess,
            showError
          );

          // Property: Custom error message should be displayed instead of actual
          expect(showError).toHaveBeenCalledTimes(1);
          expect(showError).toHaveBeenCalledWith(customMessage);
        }
      ),
      { numRuns: 100 }
    );
  });
});
