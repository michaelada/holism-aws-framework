import { useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';
import { handleApiCall, HandleApiCallOptions, ApiCallResult } from '../utils/errorHandling';

/**
 * Custom hook for making API calls with automatic error handling and notifications
 * 
 * @returns Function to execute API calls with error handling
 */
export function useApiCall() {
  const { showSuccess, showError } = useNotification();

  const executeApiCall = useCallback(
    async <T>(
      apiCall: () => Promise<T>,
      options: HandleApiCallOptions = {}
    ): Promise<ApiCallResult<T>> => {
      return handleApiCall(apiCall, options, showSuccess, showError);
    },
    [showSuccess, showError]
  );

  return executeApiCall;
}
