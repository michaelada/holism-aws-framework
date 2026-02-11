import { ApiError, NetworkError } from '../services/adminApi';

export interface HandleApiCallOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccess?: boolean;
  showError?: boolean;
  onRetry?: () => Promise<any>;
}

export interface ApiCallResult<T> {
  data: T | null;
  error: Error | null;
  isNetworkError: boolean;
  retry?: () => Promise<ApiCallResult<T>>;
}

/**
 * Wrapper function for API calls that handles errors and success feedback
 * 
 * @param apiCall - The API call function to execute
 * @param options - Configuration options for error handling and feedback
 * @param showSuccess - Function to display success toast
 * @param showError - Function to display error toast
 * @returns Result object with data, error, and retry function
 */
export async function handleApiCall<T>(
  apiCall: () => Promise<T>,
  options: HandleApiCallOptions,
  showSuccess: (message: string) => void,
  showError: (message: string) => void
): Promise<ApiCallResult<T>> {
  const {
    successMessage,
    errorMessage,
    showSuccess: shouldShowSuccess = true,
    showError: shouldShowError = true,
  } = options;

  try {
    const data = await apiCall();

    // Show success feedback if enabled and message provided
    if (shouldShowSuccess && successMessage) {
      showSuccess(successMessage);
    }

    return {
      data,
      error: null,
      isNetworkError: false,
    };
  } catch (error) {
    let displayMessage: string;
    let isNetworkError = false;

    if (error instanceof NetworkError) {
      // Network error - provide retry option
      isNetworkError = true;
      displayMessage = errorMessage || error.message;
    } else if (error instanceof ApiError) {
      // API error - extract meaningful message
      displayMessage = errorMessage || error.message;
    } else if (error instanceof Error) {
      // Generic error
      displayMessage = errorMessage || error.message;
    } else {
      // Unknown error
      displayMessage = errorMessage || 'An unexpected error occurred';
    }

    // Show error feedback if enabled
    if (shouldShowError) {
      showError(displayMessage);
    }

    // Create retry function for network errors
    const retry = isNetworkError
      ? async () => handleApiCall(apiCall, options, showSuccess, showError)
      : undefined;

    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
      isNetworkError,
      retry,
    };
  }
}

/**
 * Extract user-friendly error message from error object
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  } else if (error instanceof NetworkError) {
    return error.message;
  } else if (error instanceof Error) {
    return error.message;
  } else {
    return 'An unexpected error occurred';
  }
}

/**
 * Check if error is a network error that can be retried
 */
export function isRetryableError(error: unknown): boolean {
  return error instanceof NetworkError;
}
