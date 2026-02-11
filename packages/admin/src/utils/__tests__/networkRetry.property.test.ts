import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { handleApiCall, isRetryableError } from '../errorHandling';
import { ApiError, NetworkError } from '../../services/adminApi';

/**
 * Feature: keycloak-admin-integration, Property 27: Network Error Retry Option
 * 
 * For any network error in the Admin Frontend, the system should display
 * a retry option to the user.
 * 
 * Validates: Requirements 11.9
 */
describe('Property 27: Network Error Retry Option', () => {
  it('should provide retry function for all network errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }), // error message
        async (errorMessage) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          // Create API call that throws network error
          const apiCall = async () => {
            throw new NetworkError(errorMessage);
          };

          // Execute API call
          const result = await handleApiCall(
            apiCall,
            {},
            showSuccess,
            showError
          );

          // Property: Network error should be flagged
          expect(result.isNetworkError).toBe(true);
          expect(result.error).toBeInstanceOf(NetworkError);
          expect(result.data).toBeNull();

          // Property: Retry function should be provided
          expect(result.retry).toBeDefined();
          expect(typeof result.retry).toBe('function');

          // Property: Error should be retryable
          expect(isRetryableError(result.error)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not provide retry function for non-network errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.record({
            type: fc.constant('api'),
            status: fc.integer({ min: 400, max: 599 }),
            code: fc.string({ minLength: 1 }),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          fc.record({
            type: fc.constant('generic'),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          })
        ),
        async (errorConfig) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          // Create API call that throws non-network error
          const apiCall = async () => {
            if (errorConfig.type === 'api') {
              throw new ApiError(
                errorConfig.status,
                errorConfig.code,
                errorConfig.message
              );
            } else {
              throw new Error(errorConfig.message);
            }
          };

          const result = await handleApiCall(
            apiCall,
            {},
            showSuccess,
            showError
          );

          // Property: Non-network errors should not be flagged as network errors
          expect(result.isNetworkError).toBe(false);
          expect(result.error).not.toBeInstanceOf(NetworkError);

          // Property: Retry function should not be provided
          expect(result.retry).toBeUndefined();

          // Property: Error should not be retryable
          expect(isRetryableError(result.error)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow retry to succeed after initial network failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything(), // success data
        fc.string({ minLength: 1, maxLength: 200 }), // error message
        async (successData, errorMessage) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          let attemptCount = 0;

          // Create API call that fails first time, succeeds on retry
          const apiCall = async () => {
            attemptCount++;
            if (attemptCount === 1) {
              throw new NetworkError(errorMessage);
            }
            return successData;
          };

          // First attempt - should fail
          const firstResult = await handleApiCall(
            apiCall,
            { successMessage: 'Success!' },
            showSuccess,
            showError
          );

          // Property: First attempt should fail with network error
          expect(firstResult.isNetworkError).toBe(true);
          expect(firstResult.data).toBeNull();
          expect(firstResult.retry).toBeDefined();

          // Property: Retry should be available
          if (firstResult.retry) {
            // Retry the operation
            const retryResult = await firstResult.retry();

            // Property: Retry should succeed
            expect(retryResult.data).toEqual(successData);
            expect(retryResult.error).toBeNull();
            expect(retryResult.isNetworkError).toBe(false);

            // Property: Success message should be shown on retry success
            expect(showSuccess).toHaveBeenCalledWith('Success!');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple retry attempts consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // number of failures before success
        fc.anything(), // success data
        async (failureCount, successData) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          let attemptCount = 0;

          // Create API call that fails N times, then succeeds
          const apiCall = async () => {
            attemptCount++;
            if (attemptCount <= failureCount) {
              throw new NetworkError('Network error');
            }
            return successData;
          };

          let currentResult = await handleApiCall(
            apiCall,
            { successMessage: 'Success!' },
            showSuccess,
            showError
          );

          // Property: Should fail initially
          expect(currentResult.isNetworkError).toBe(true);

          // Retry until success
          for (let i = 1; i < failureCount; i++) {
            expect(currentResult.retry).toBeDefined();
            if (currentResult.retry) {
              currentResult = await currentResult.retry();
              // Property: Should still fail
              expect(currentResult.isNetworkError).toBe(true);
            }
          }

          // Final retry should succeed
          expect(currentResult.retry).toBeDefined();
          if (currentResult.retry) {
            const finalResult = await currentResult.retry();

            // Property: Final retry should succeed
            expect(finalResult.data).toEqual(successData);
            expect(finalResult.error).toBeNull();
            expect(finalResult.isNetworkError).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve error context across retry attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }), // error message
        fc.string({ minLength: 1, maxLength: 200 }), // custom error message
        async (errorMessage, customMessage) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          const apiCall = async () => {
            throw new NetworkError(errorMessage);
          };

          const result = await handleApiCall(
            apiCall,
            { errorMessage: customMessage },
            showSuccess,
            showError
          );

          // Property: Custom error message should be used
          expect(showError).toHaveBeenCalledWith(customMessage);

          // Property: Retry should maintain the same error handling options
          if (result.retry) {
            showError.mockClear();

            const retryResult = await result.retry();

            // Property: Retry should use same custom message
            expect(showError).toHaveBeenCalledWith(customMessage);
            expect(retryResult.isNetworkError).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
