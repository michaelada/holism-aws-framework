/**
 * Keycloak Error Handling Utilities
 * 
 * This module provides utilities for handling Keycloak Admin API errors,
 * including error mapping, logging, and rollback logic for database failures.
 */

import { logger } from '../config/logger';
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
  InternalError,
  ValidationError,
  AuthError,
  ForbiddenError
} from '../middleware/errors';
import { KeycloakAdminService } from './keycloak-admin.service';

/**
 * Keycloak error response structure
 */
interface KeycloakErrorResponse {
  status?: number;
  statusText?: string;
  data?: {
    error?: string;
    errorMessage?: string;
    error_description?: string;
  };
}

/**
 * Keycloak error structure
 */
interface KeycloakError extends Error {
  response?: KeycloakErrorResponse;
  statusCode?: number;
}

/**
 * Rollback operation function type
 */
type RollbackOperation = () => Promise<void>;

/**
 * Maps Keycloak Admin API errors to application error classes
 * 
 * @param error - The error from Keycloak Admin API
 * @returns Mapped application error
 */
export function mapKeycloakError(error: KeycloakError): Error {
  const status = error.response?.status || error.statusCode;
  const errorData = error.response?.data;
  
  // Extract error message from various possible locations
  const message = 
    errorData?.errorMessage || 
    errorData?.error_description || 
    errorData?.error || 
    error.message || 
    'Keycloak operation failed';

  // Log the error details
  logger.error('Keycloak API error', {
    status,
    message,
    errorData,
    stack: error.stack
  });

  // Map status codes to appropriate error classes
  switch (status) {
    case 400:
      return new BadRequestError(message);
    
    case 401:
      return new AuthError(message);
    
    case 403:
      return new ForbiddenError(message);
    
    case 404:
      return new NotFoundError(message);
    
    case 409:
      // Conflict - typically duplicate resource
      return new ConflictError(message);
    
    case 422:
      // Unprocessable entity - validation error
      return new ValidationError(message);
    
    case 500:
    case 502:
    case 503:
    case 504:
      return new InternalError('Keycloak service error: ' + message);
    
    default:
      return new InternalError(message);
  }
}

/**
 * Wraps a Keycloak Admin API operation with error handling and authentication retry
 * 
 * @param kcAdmin - Keycloak Admin Service instance
 * @param operation - The operation to execute
 * @param operationName - Name of the operation for logging
 * @returns Result of the operation
 * @throws Mapped application error if operation fails
 */
export async function handleKeycloakOperation<T>(
  kcAdmin: KeycloakAdminService,
  operation: () => Promise<T>,
  operationName: string = 'Keycloak operation'
): Promise<T> {
  try {
    // Ensure we have a valid token before the operation
    await kcAdmin.ensureAuthenticated();
    
    // Execute the operation
    return await operation();
  } catch (error: any) {
    // Check if it's an authentication error
    const status = error.response?.status || error.statusCode;
    
    if (status === 401) {
      // Re-authenticate and retry once
      logger.warn('Keycloak operation failed with 401, re-authenticating and retrying', {
        operationName
      });
      
      try {
        await kcAdmin.authenticate();
        return await operation();
      } catch (retryError: any) {
        logger.error('Keycloak operation failed after retry', {
          operationName,
          error: retryError.message
        });
        throw mapKeycloakError(retryError);
      }
    }
    
    // For other errors, map and throw
    throw mapKeycloakError(error);
  }
}

/**
 * Executes a dual-store operation (Keycloak + Database) with rollback support
 * 
 * This function ensures consistency between Keycloak and the database by:
 * 1. Executing the Keycloak operation first
 * 2. Executing the database operation
 * 3. Rolling back the Keycloak operation if the database operation fails
 * 
 * @param keycloakOperation - The Keycloak operation to execute
 * @param databaseOperation - The database operation to execute
 * @param rollbackOperation - The rollback operation to execute if database fails
 * @param operationName - Name of the operation for logging
 * @returns Result of the database operation
 * @throws Error if either operation fails
 */
export async function executeDualStoreOperation<T>(
  keycloakOperation: () => Promise<any>,
  databaseOperation: () => Promise<T>,
  rollbackOperation: RollbackOperation,
  operationName: string = 'Dual-store operation'
): Promise<T> {
  let keycloakCompleted = false;
  
  try {
    // Execute Keycloak operation first
    await keycloakOperation();
    keycloakCompleted = true;
    
    // Execute database operation
    const result = await databaseOperation();
    
    return result;
  } catch (error: any) {
    // If Keycloak succeeded but database failed, rollback Keycloak
    if (keycloakCompleted) {
      logger.error('Database operation failed, attempting Keycloak rollback', {
        operationName,
        error: error.message
      });
      
      try {
        await rollbackOperation();
        logger.info('Keycloak rollback successful', { operationName });
      } catch (rollbackError: any) {
        logger.error('Keycloak rollback failed', {
          operationName,
          rollbackError: rollbackError.message,
          originalError: error.message
        });
        // Don't throw rollback error, throw original error
      }
    }
    
    throw error;
  }
}

/**
 * Validates input data and throws ValidationError if invalid
 * 
 * @param data - The data to validate
 * @param rules - Validation rules
 * @throws ValidationError if validation fails
 */
export function validateInput(
  data: Record<string, any>,
  rules: Record<string, (value: any) => string | null>
): void {
  const errors: Array<{ field: string; message: string; value?: any }> = [];
  
  for (const [field, validator] of Object.entries(rules)) {
    const value = data[field];
    const error = validator(value);
    
    if (error) {
      errors.push({ field, message: error, value });
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  required: (fieldName: string) => (value: any) => {
    if (value === undefined || value === null || value === '') {
      return `${fieldName} is required`;
    }
    return null;
  },
  
  email: (value: any) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Invalid email format';
    }
    return null;
  },
  
  minLength: (min: number) => (value: any) => {
    if (!value) return null;
    if (typeof value === 'string' && value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  },
  
  maxLength: (max: number) => (value: any) => {
    if (!value) return null;
    if (typeof value === 'string' && value.length > max) {
      return `Must be at most ${max} characters`;
    }
    return null;
  },
  
  pattern: (regex: RegExp, message: string) => (value: any) => {
    if (!value) return null;
    if (typeof value === 'string' && !regex.test(value)) {
      return message;
    }
    return null;
  }
};
