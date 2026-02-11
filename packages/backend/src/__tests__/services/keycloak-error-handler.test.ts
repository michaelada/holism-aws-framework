/**
 * Unit tests for Keycloak Error Handler utilities
 */

import {
  mapKeycloakError,
  handleKeycloakOperation,
  executeDualStoreOperation,
  validateInput,
  ValidationRules
} from '../../services/keycloak-error-handler';
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
  InternalError,
  ValidationError,
  AuthError,
  ForbiddenError
} from '../../middleware/errors';
import { KeycloakAdminService } from '../../services/keycloak-admin.service';

// Mock logger
jest.mock('../../config/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('Keycloak Error Handler', () => {
  describe('mapKeycloakError', () => {
    it('should map 400 status to BadRequestError', () => {
      const error: any = {
        response: {
          status: 400,
          data: { errorMessage: 'Invalid request' }
        }
      };

      const result = mapKeycloakError(error);
      expect(result).toBeInstanceOf(BadRequestError);
      expect(result.message).toBe('Invalid request');
    });

    it('should map 401 status to AuthError', () => {
      const error: any = {
        response: {
          status: 401,
          data: { errorMessage: 'Unauthorized' }
        }
      };

      const result = mapKeycloakError(error);
      expect(result).toBeInstanceOf(AuthError);
      expect(result.message).toBe('Unauthorized');
    });

    it('should map 403 status to ForbiddenError', () => {
      const error: any = {
        response: {
          status: 403,
          data: { errorMessage: 'Forbidden' }
        }
      };

      const result = mapKeycloakError(error);
      expect(result).toBeInstanceOf(ForbiddenError);
      expect(result.message).toBe('Forbidden');
    });

    it('should map 404 status to NotFoundError', () => {
      const error: any = {
        response: {
          status: 404,
          data: { errorMessage: 'User not found' }
        }
      };

      const result = mapKeycloakError(error);
      expect(result).toBeInstanceOf(NotFoundError);
      expect(result.message).toBe('User not found');
    });

    it('should map 409 status to ConflictError', () => {
      const error: any = {
        response: {
          status: 409,
          data: { errorMessage: 'User already exists' }
        }
      };

      const result = mapKeycloakError(error);
      expect(result).toBeInstanceOf(ConflictError);
      expect(result.message).toBe('User already exists');
    });

    it('should map 422 status to ValidationError', () => {
      const error: any = {
        response: {
          status: 422,
          data: { errorMessage: 'Invalid email format' }
        }
      };

      const result = mapKeycloakError(error);
      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('Invalid email format');
    });

    it('should map 500 status to InternalError', () => {
      const error: any = {
        response: {
          status: 500,
          data: { errorMessage: 'Internal server error' }
        }
      };

      const result = mapKeycloakError(error);
      expect(result).toBeInstanceOf(InternalError);
      expect(result.message).toContain('Keycloak service error');
    });

    it('should extract error message from error_description field', () => {
      const error: any = {
        response: {
          status: 400,
          data: { error_description: 'Description error' }
        }
      };

      const result = mapKeycloakError(error);
      expect(result.message).toBe('Description error');
    });

    it('should extract error message from error field', () => {
      const error: any = {
        response: {
          status: 400,
          data: { error: 'Simple error' }
        }
      };

      const result = mapKeycloakError(error);
      expect(result.message).toBe('Simple error');
    });

    it('should use default message if no error data available', () => {
      const error: any = {
        response: {
          status: 400
        }
      };

      const result = mapKeycloakError(error);
      expect(result.message).toBe('Keycloak operation failed');
    });

    it('should handle error without response object', () => {
      const error: any = {
        statusCode: 404,
        message: 'Not found'
      };

      const result = mapKeycloakError(error);
      expect(result).toBeInstanceOf(NotFoundError);
      expect(result.message).toBe('Not found');
    });
  });

  describe('handleKeycloakOperation', () => {
    let mockKcAdmin: jest.Mocked<KeycloakAdminService>;

    beforeEach(() => {
      mockKcAdmin = {
        ensureAuthenticated: jest.fn(),
        authenticate: jest.fn()
      } as any;
    });

    it('should execute operation successfully', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await handleKeycloakOperation(
        mockKcAdmin,
        operation,
        'test operation'
      );

      expect(mockKcAdmin.ensureAuthenticated).toHaveBeenCalled();
      expect(operation).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should retry operation on 401 error', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce({
          response: { status: 401 },
          message: 'Unauthorized'
        })
        .mockResolvedValueOnce('success after retry');

      const result = await handleKeycloakOperation(
        mockKcAdmin,
        operation,
        'test operation'
      );

      expect(mockKcAdmin.authenticate).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledTimes(2);
      expect(result).toBe('success after retry');
    });

    it('should throw mapped error if retry fails', async () => {
      const operation = jest.fn().mockRejectedValue({
        response: { status: 401 },
        message: 'Unauthorized'
      });

      await expect(
        handleKeycloakOperation(mockKcAdmin, operation, 'test operation')
      ).rejects.toThrow(AuthError);

      expect(mockKcAdmin.authenticate).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw mapped error for non-401 errors', async () => {
      const operation = jest.fn().mockRejectedValue({
        response: { status: 404, data: { errorMessage: 'Not found' } }
      });

      await expect(
        handleKeycloakOperation(mockKcAdmin, operation, 'test operation')
      ).rejects.toThrow(NotFoundError);

      expect(mockKcAdmin.authenticate).not.toHaveBeenCalled();
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeDualStoreOperation', () => {
    it('should execute both operations successfully', async () => {
      const keycloakOp = jest.fn().mockResolvedValue('kc-result');
      const databaseOp = jest.fn().mockResolvedValue('db-result');
      const rollbackOp = jest.fn();

      const result = await executeDualStoreOperation(
        keycloakOp,
        databaseOp,
        rollbackOp,
        'test operation'
      );

      expect(keycloakOp).toHaveBeenCalled();
      expect(databaseOp).toHaveBeenCalled();
      expect(rollbackOp).not.toHaveBeenCalled();
      expect(result).toBe('db-result');
    });

    it('should rollback Keycloak operation if database fails', async () => {
      const keycloakOp = jest.fn().mockResolvedValue('kc-result');
      const databaseOp = jest.fn().mockRejectedValue(new Error('DB error'));
      const rollbackOp = jest.fn().mockResolvedValue(undefined);

      await expect(
        executeDualStoreOperation(
          keycloakOp,
          databaseOp,
          rollbackOp,
          'test operation'
        )
      ).rejects.toThrow('DB error');

      expect(keycloakOp).toHaveBeenCalled();
      expect(databaseOp).toHaveBeenCalled();
      expect(rollbackOp).toHaveBeenCalled();
    });

    it('should not rollback if Keycloak operation fails', async () => {
      const keycloakOp = jest.fn().mockRejectedValue(new Error('KC error'));
      const databaseOp = jest.fn();
      const rollbackOp = jest.fn();

      await expect(
        executeDualStoreOperation(
          keycloakOp,
          databaseOp,
          rollbackOp,
          'test operation'
        )
      ).rejects.toThrow('KC error');

      expect(keycloakOp).toHaveBeenCalled();
      expect(databaseOp).not.toHaveBeenCalled();
      expect(rollbackOp).not.toHaveBeenCalled();
    });

    it('should throw original error even if rollback fails', async () => {
      const keycloakOp = jest.fn().mockResolvedValue('kc-result');
      const databaseOp = jest.fn().mockRejectedValue(new Error('DB error'));
      const rollbackOp = jest.fn().mockRejectedValue(new Error('Rollback error'));

      await expect(
        executeDualStoreOperation(
          keycloakOp,
          databaseOp,
          rollbackOp,
          'test operation'
        )
      ).rejects.toThrow('DB error');

      expect(rollbackOp).toHaveBeenCalled();
    });
  });

  describe('validateInput', () => {
    it('should pass validation for valid data', () => {
      const data = { name: 'John', email: 'john@example.com' };
      const rules = {
        name: ValidationRules.required('Name'),
        email: ValidationRules.email
      };

      expect(() => validateInput(data, rules)).not.toThrow();
    });

    it('should throw ValidationError for missing required field', () => {
      const data = { email: 'john@example.com' };
      const rules = {
        name: ValidationRules.required('Name'),
        email: ValidationRules.email
      };

      expect(() => validateInput(data, rules)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid email', () => {
      const data = { name: 'John', email: 'invalid-email' };
      const rules = {
        name: ValidationRules.required('Name'),
        email: ValidationRules.email
      };

      expect(() => validateInput(data, rules)).toThrow(ValidationError);
    });

    it('should collect multiple validation errors', () => {
      const data = { email: 'invalid' };
      const rules = {
        name: ValidationRules.required('Name'),
        email: ValidationRules.email
      };

      try {
        validateInput(data, rules);
        fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.fieldErrors).toHaveLength(2);
      }
    });
  });

  describe('ValidationRules', () => {
    describe('required', () => {
      it('should pass for non-empty value', () => {
        const validator = ValidationRules.required('Field');
        expect(validator('value')).toBeNull();
      });

      it('should fail for undefined', () => {
        const validator = ValidationRules.required('Field');
        expect(validator(undefined)).toBe('Field is required');
      });

      it('should fail for null', () => {
        const validator = ValidationRules.required('Field');
        expect(validator(null)).toBe('Field is required');
      });

      it('should fail for empty string', () => {
        const validator = ValidationRules.required('Field');
        expect(validator('')).toBe('Field is required');
      });
    });

    describe('email', () => {
      it('should pass for valid email', () => {
        expect(ValidationRules.email('test@example.com')).toBeNull();
      });

      it('should fail for invalid email', () => {
        expect(ValidationRules.email('invalid')).toBe('Invalid email format');
      });

      it('should pass for empty value', () => {
        expect(ValidationRules.email('')).toBeNull();
      });
    });

    describe('minLength', () => {
      it('should pass for string meeting minimum length', () => {
        const validator = ValidationRules.minLength(5);
        expect(validator('hello')).toBeNull();
      });

      it('should fail for string below minimum length', () => {
        const validator = ValidationRules.minLength(5);
        expect(validator('hi')).toBe('Must be at least 5 characters');
      });

      it('should pass for empty value', () => {
        const validator = ValidationRules.minLength(5);
        expect(validator('')).toBeNull();
      });
    });

    describe('maxLength', () => {
      it('should pass for string within maximum length', () => {
        const validator = ValidationRules.maxLength(5);
        expect(validator('hello')).toBeNull();
      });

      it('should fail for string exceeding maximum length', () => {
        const validator = ValidationRules.maxLength(5);
        expect(validator('hello world')).toBe('Must be at most 5 characters');
      });

      it('should pass for empty value', () => {
        const validator = ValidationRules.maxLength(5);
        expect(validator('')).toBeNull();
      });
    });

    describe('pattern', () => {
      it('should pass for matching pattern', () => {
        const validator = ValidationRules.pattern(/^[A-Z]/, 'Must start with uppercase');
        expect(validator('Hello')).toBeNull();
      });

      it('should fail for non-matching pattern', () => {
        const validator = ValidationRules.pattern(/^[A-Z]/, 'Must start with uppercase');
        expect(validator('hello')).toBe('Must start with uppercase');
      });

      it('should pass for empty value', () => {
        const validator = ValidationRules.pattern(/^[A-Z]/, 'Must start with uppercase');
        expect(validator('')).toBeNull();
      });
    });
  });
});
