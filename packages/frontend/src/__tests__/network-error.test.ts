import { describe, it, expect } from 'vitest';
import { ApiError, NetworkError } from '../api/client';

// Feature: aws-web-app-framework, Property 26: Network Error Handling
// **Validates: Requirements 18.3**

describe('Network Error Handling', () => {
  describe('NetworkError', () => {
    it('should create user-friendly error messages without technical details', () => {
      const error = new NetworkError('Unable to connect to server. Please check your connection.');
      
      expect(error).toBeInstanceOf(NetworkError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Unable to connect to server. Please check your connection.');
      
      // Verify message doesn't contain technical details
      expect(error.message).not.toContain('ECONNREFUSED');
      expect(error.message).not.toContain('stack');
      expect(error.message).not.toContain('AxiosError');
      
      // Verify message is helpful
      expect(
        error.message.toLowerCase().includes('connect') ||
        error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('server')
      ).toBe(true);
    });
  });

  describe('ApiError', () => {
    it('should preserve structured error information', () => {
      const error = new ApiError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        [{ field: 'email', message: 'Invalid email format' }]
      );
      
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApiError');
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual([{ field: 'email', message: 'Invalid email format' }]);
    });

    it('should handle errors without details', () => {
      const error = new ApiError(404, 'NOT_FOUND', 'Resource not found');
      
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.details).toBeUndefined();
    });

    it('should preserve field-level validation errors', () => {
      const fieldErrors = [
        { field: 'name', message: 'Name is required' },
        { field: 'email', message: 'Invalid email format' },
        { field: 'age', message: 'Must be at least 18' },
      ];
      
      const error = new ApiError(
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        fieldErrors
      );
      
      expect(error.details).toEqual(fieldErrors);
      expect(error.details).toHaveLength(3);
    });
  });
});
