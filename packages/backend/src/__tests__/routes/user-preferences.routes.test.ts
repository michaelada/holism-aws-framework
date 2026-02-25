/**
 * Unit Tests for User Preferences Routes
 * 
 * Tests the GET /api/user-preferences/onboarding endpoint
 * 
 * Requirements: 4.2, 4.4, 9.2, 9.3, 9.4
 */

// Mock the database pool BEFORE any imports
jest.mock('../../database/pool', () => ({
  db: {
    getPool: jest.fn(() => ({
      query: jest.fn()
    })),
    initialize: jest.fn(),
    close: jest.fn(),
    isHealthy: jest.fn()
  }
}));

// Mock the auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => {
    return (req: any, _res: any, next: any) => {
      // Set mock user for authenticated tests
      if (req.headers.authorization === 'Bearer valid-token') {
        req.user = {
          userId: 'test-user-123',
          email: 'test@example.com',
          username: 'testuser',
          roles: ['user'],
          groups: []
        };
      }
      next();
    };
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireAllRoles: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: () => (_req: any, _res: any, next: any) => next(),
  requireAdminRole: () => (_req: any, _res: any, next: any) => next(),
  optionalAuth: () => (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {} as any
}));

import request from 'supertest';
import { app } from '../../index';
import { userPreferencesService } from '../../services/user-preferences.service';

// Mock the service
jest.mock('../../services/user-preferences.service');

describe('GET /api/user-preferences/onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should return user preferences when they exist', async () => {
      // Arrange
      const mockPreferences = {
        welcomeDismissed: true,
        modulesVisited: ['dashboard', 'users']
      };

      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockResolvedValue(
        mockPreferences
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockPreferences
      });
      expect(userPreferencesService.getOnboardingPreferences).toHaveBeenCalledWith(
        'test-user-123'
      );
    });

    it('should return default preferences when none exist', async () => {
      // Arrange
      const defaultPreferences = {
        welcomeDismissed: false,
        modulesVisited: []
      };

      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockResolvedValue(
        defaultPreferences
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: defaultPreferences
      });
    });

    it('should return preferences with empty modulesVisited array', async () => {
      // Arrange
      const mockPreferences = {
        welcomeDismissed: true,
        modulesVisited: []
      };

      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockResolvedValue(
        mockPreferences
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.modulesVisited).toEqual([]);
    });

    it('should return preferences with all modules visited', async () => {
      // Arrange
      const mockPreferences = {
        welcomeDismissed: true,
        modulesVisited: ['dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments']
      };

      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockResolvedValue(
        mockPreferences
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.modulesVisited).toHaveLength(7);
    });
  });

  describe('Authentication Failures (Requirement 9.3)', () => {
    it('should return 401 when no authorization header is provided', async () => {
      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when invalid token is provided', async () => {
      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should return 401 when authorization header format is invalid', async () => {
      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'InvalidFormat token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Server Error Handling (Requirement 9.2)', () => {
    it('should return 500 when database error occurs', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockRejectedValue(
        dbError
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toContain('Database connection failed');
    });

    it('should return 500 when service throws unexpected error', async () => {
      // Arrange
      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });

    it('should handle non-Error exceptions gracefully', async () => {
      // Arrange
      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockRejectedValue(
        'String error'
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Failed to get onboarding preferences');
    });
  });

  describe('User Data Isolation (Requirement 9.4)', () => {
    it('should only return preferences for the authenticated user', async () => {
      // Arrange
      const mockPreferences = {
        welcomeDismissed: true,
        modulesVisited: ['dashboard']
      };

      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockResolvedValue(
        mockPreferences
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      // Verify service was called with the correct user ID from the token
      expect(userPreferencesService.getOnboardingPreferences).toHaveBeenCalledWith(
        'test-user-123'
      );
      // Verify it was only called once
      expect(userPreferencesService.getOnboardingPreferences).toHaveBeenCalledTimes(1);
    });

    it('should not allow accessing other users preferences', async () => {
      // This test verifies that the endpoint uses the userId from the JWT token
      // and not from any request parameter or body
      
      // Arrange
      const mockPreferences = {
        welcomeDismissed: false,
        modulesVisited: []
      };

      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockResolvedValue(
        mockPreferences
      );

      // Act - Try to pass a different userId in query params (should be ignored)
      const response = await request(app)
        .get('/api/user-preferences/onboarding?userId=other-user-456')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      // Verify service was called with the userId from the token, not the query param
      expect(userPreferencesService.getOnboardingPreferences).toHaveBeenCalledWith(
        'test-user-123'
      );
      expect(userPreferencesService.getOnboardingPreferences).not.toHaveBeenCalledWith(
        'other-user-456'
      );
    });
  });

  describe('Response Format', () => {
    it('should return response in correct format', async () => {
      // Arrange
      const mockPreferences = {
        welcomeDismissed: true,
        modulesVisited: ['dashboard']
      };

      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockResolvedValue(
        mockPreferences
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('welcomeDismissed');
      expect(response.body.data).toHaveProperty('modulesVisited');
      expect(typeof response.body.data.welcomeDismissed).toBe('boolean');
      expect(Array.isArray(response.body.data.modulesVisited)).toBe(true);
    });

    it('should return JSON content type', async () => {
      // Arrange
      const mockPreferences = {
        welcomeDismissed: false,
        modulesVisited: []
      };

      (userPreferencesService.getOnboardingPreferences as jest.Mock).mockResolvedValue(
        mockPreferences
      );

      // Act
      const response = await request(app)
        .get('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});

describe('PUT /api/user-preferences/onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should update welcomeDismissed preference', async () => {
      // Arrange
      const updatedPreferences = {
        welcomeDismissed: true,
        modulesVisited: []
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ welcomeDismissed: true });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: updatedPreferences
      });
      expect(userPreferencesService.updateOnboardingPreferences).toHaveBeenCalledWith(
        'test-user-123',
        { welcomeDismissed: true }
      );
    });

    it('should update modulesVisited preference', async () => {
      // Arrange
      const updatedPreferences = {
        welcomeDismissed: false,
        modulesVisited: ['dashboard', 'users']
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ modulesVisited: ['dashboard', 'users'] });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.modulesVisited).toEqual(['dashboard', 'users']);
      expect(userPreferencesService.updateOnboardingPreferences).toHaveBeenCalledWith(
        'test-user-123',
        { modulesVisited: ['dashboard', 'users'] }
      );
    });

    it('should update both preferences at once', async () => {
      // Arrange
      const updatedPreferences = {
        welcomeDismissed: true,
        modulesVisited: ['dashboard']
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ 
          welcomeDismissed: true,
          modulesVisited: ['dashboard']
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(updatedPreferences);
    });

    it('should accept all valid module IDs', async () => {
      // Arrange
      const allModules = ['dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'];
      const updatedPreferences = {
        welcomeDismissed: false,
        modulesVisited: allModules
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ modulesVisited: allModules });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.modulesVisited).toHaveLength(7);
    });

    it('should accept empty modulesVisited array', async () => {
      // Arrange
      const updatedPreferences = {
        welcomeDismissed: false,
        modulesVisited: []
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ modulesVisited: [] });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.modulesVisited).toEqual([]);
    });
  });

  describe('Authentication Failures (Requirement 9.3)', () => {
    it('should return 401 when no authorization header is provided', async () => {
      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .send({ welcomeDismissed: true });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when invalid token is provided', async () => {
      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer invalid-token')
        .send({ welcomeDismissed: true });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Validation Errors (Requirement 9.1)', () => {
    it('should return 400 when welcomeDismissed is not a boolean', async () => {
      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ welcomeDismissed: 'true' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_REQUEST');
      expect(response.body.error.message).toContain('boolean');
    });

    it('should return 400 when modulesVisited is not an array', async () => {
      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ modulesVisited: 'dashboard' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_REQUEST');
      expect(response.body.error.message).toContain('array');
    });

    it('should return 400 when modulesVisited contains invalid module IDs', async () => {
      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ modulesVisited: ['dashboard', 'invalid-module', 'users'] });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_REQUEST');
      expect(response.body.error.message).toContain('Invalid module IDs');
      expect(response.body.error.message).toContain('invalid-module');
    });

    it('should return 400 when no preferences are provided', async () => {
      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_REQUEST');
      expect(response.body.error.message).toContain('At least one preference');
    });

    it('should return 400 when modulesVisited contains only invalid module IDs', async () => {
      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ modulesVisited: ['invalid1', 'invalid2'] });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('invalid1');
      expect(response.body.error.message).toContain('invalid2');
    });

    it('should return 400 when welcomeDismissed is a number', async () => {
      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ welcomeDismissed: 1 });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    it('should return 400 when modulesVisited contains non-string values', async () => {
      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ modulesVisited: ['dashboard', 123, 'users'] });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Server Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockRejectedValue(
        dbError
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ welcomeDismissed: true });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toContain('Database connection failed');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      // Arrange
      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockRejectedValue(
        'String error'
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ welcomeDismissed: true });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Failed to update onboarding preferences');
    });
  });

  describe('User Data Isolation (Requirement 9.4)', () => {
    it('should only update preferences for the authenticated user', async () => {
      // Arrange
      const updatedPreferences = {
        welcomeDismissed: true,
        modulesVisited: []
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ welcomeDismissed: true });

      // Assert
      expect(response.status).toBe(200);
      // Verify service was called with the correct user ID from the token
      expect(userPreferencesService.updateOnboardingPreferences).toHaveBeenCalledWith(
        'test-user-123',
        expect.any(Object)
      );
    });

    it('should not allow updating other users preferences', async () => {
      // Arrange
      const updatedPreferences = {
        welcomeDismissed: true,
        modulesVisited: []
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act - Try to pass a different userId in the body (should be ignored)
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ 
          userId: 'other-user-456',
          welcomeDismissed: true 
        });

      // Assert
      expect(response.status).toBe(200);
      // Verify service was called with the userId from the token, not the body
      expect(userPreferencesService.updateOnboardingPreferences).toHaveBeenCalledWith(
        'test-user-123',
        expect.any(Object)
      );
      expect(userPreferencesService.updateOnboardingPreferences).not.toHaveBeenCalledWith(
        'other-user-456',
        expect.any(Object)
      );
    });
  });

  describe('Response Format', () => {
    it('should return response in correct format', async () => {
      // Arrange
      const updatedPreferences = {
        welcomeDismissed: true,
        modulesVisited: ['dashboard']
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ welcomeDismissed: true });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('welcomeDismissed');
      expect(response.body.data).toHaveProperty('modulesVisited');
    });

    it('should return JSON content type', async () => {
      // Arrange
      const updatedPreferences = {
        welcomeDismissed: true,
        modulesVisited: []
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ welcomeDismissed: true });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Merge Behavior (Requirement 4.3)', () => {
    it('should merge new preferences with existing ones', async () => {
      // This test verifies that the service is called correctly
      // The actual merge logic is tested in the service tests
      
      // Arrange
      const updatedPreferences = {
        welcomeDismissed: true,
        modulesVisited: ['dashboard', 'users', 'forms']
      };

      (userPreferencesService.updateOnboardingPreferences as jest.Mock).mockResolvedValue(
        updatedPreferences
      );

      // Act
      const response = await request(app)
        .put('/api/user-preferences/onboarding')
        .set('Authorization', 'Bearer valid-token')
        .send({ modulesVisited: ['forms'] });

      // Assert
      expect(response.status).toBe(200);
      expect(userPreferencesService.updateOnboardingPreferences).toHaveBeenCalledWith(
        'test-user-123',
        { modulesVisited: ['forms'] }
      );
    });
  });
});
