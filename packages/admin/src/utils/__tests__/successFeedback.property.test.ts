import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { handleApiCall } from '../errorHandling';

/**
 * Feature: keycloak-admin-integration, Property 26: Frontend Success Feedback
 * 
 * For any successful operation in the Admin Frontend, the system should display
 * success feedback and refresh the displayed data.
 * 
 * Validates: Requirements 6.19
 */
describe('Property 26: Frontend Success Feedback', () => {
  it('should display success message for all successful operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything(), // arbitrary return data
        fc.string({ minLength: 1, maxLength: 200 }), // success message
        fc.boolean(), // shouldShowSuccess flag
        async (returnData, successMessage, shouldShowSuccess) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          // Create successful API call
          const apiCall = async () => returnData;

          // Execute API call with success handling
          const result = await handleApiCall(
            apiCall,
            {
              successMessage,
              showSuccess: shouldShowSuccess,
            },
            showSuccess,
            showError
          );

          // Property: Data should be returned on success
          expect(result.data).toEqual(returnData);
          expect(result.error).toBeNull();

          // Property: Success message should be displayed if enabled
          if (shouldShowSuccess) {
            expect(showSuccess).toHaveBeenCalledTimes(1);
            expect(showSuccess).toHaveBeenCalledWith(successMessage);
          } else {
            expect(showSuccess).not.toHaveBeenCalled();
          }

          // Property: Error should never be shown on success
          expect(showError).not.toHaveBeenCalled();

          // Property: Network error flag should be false
          expect(result.isNetworkError).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not display success message when not provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything(), // arbitrary return data
        async (returnData) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          const apiCall = async () => returnData;

          // Execute without success message
          const result = await handleApiCall(
            apiCall,
            {}, // no success message
            showSuccess,
            showError
          );

          // Property: Data should still be returned
          expect(result.data).toEqual(returnData);
          expect(result.error).toBeNull();

          // Property: Success notification should not be shown without message
          expect(showSuccess).not.toHaveBeenCalled();
          expect(showError).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle various success data types consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.boolean(),
          fc.integer(),
          fc.string(),
          fc.array(fc.anything()),
          fc.object(),
        ),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (returnData, successMessage) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          const apiCall = async () => returnData;

          const result = await handleApiCall(
            apiCall,
            { successMessage },
            showSuccess,
            showError
          );

          // Property: All data types should be handled correctly
          expect(result.data).toEqual(returnData);
          expect(result.error).toBeNull();
          expect(showSuccess).toHaveBeenCalledWith(successMessage);
          expect(showError).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain success feedback consistency across multiple calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            data: fc.anything(),
            message: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (operations) => {
          const showSuccess = vi.fn();
          const showError = vi.fn();

          // Execute multiple operations
          for (const op of operations) {
            const apiCall = async () => op.data;

            const result = await handleApiCall(
              apiCall,
              { successMessage: op.message },
              showSuccess,
              showError
            );

            // Property: Each operation should succeed independently
            expect(result.data).toEqual(op.data);
            expect(result.error).toBeNull();
          }

          // Property: Success should be shown for each operation
          expect(showSuccess).toHaveBeenCalledTimes(operations.length);
          expect(showError).not.toHaveBeenCalled();

          // Property: Each success message should match the operation
          operations.forEach((op, index) => {
            expect(showSuccess.mock.calls[index][0]).toBe(op.message);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
