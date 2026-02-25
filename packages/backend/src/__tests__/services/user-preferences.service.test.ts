/**
 * Unit Tests for User Preferences Service
 * 
 * Tests the getOnboardingPreferences method
 * 
 * Requirements: 4.2, 4.4, 9.2, 9.4
 */

import { userPreferencesService } from '../../services/user-preferences.service';
import { db } from '../../database/pool';

// Mock the database pool
jest.mock('../../database/pool', () => ({
  db: {
    getPool: jest.fn()
  }
}));

describe('UserPreferencesService', () => {
  let mockPool: any;

  beforeEach(() => {
    // Create a fresh mock pool for each test
    mockPool = {
      query: jest.fn()
    };
    (db.getPool as jest.Mock).mockReturnValue(mockPool);
    // Set the mock pool on the service
    userPreferencesService.setPool(mockPool);
    jest.clearAllMocks();
  });

  describe('getOnboardingPreferences', () => {
    describe('Success Cases', () => {
      it('should return user preferences when they exist', async () => {
        // Arrange
        const userId = 'test-user-123';
        const mockDbResult = {
          rows: [
            {
              welcome_dismissed: true,
              modules_visited: ['dashboard', 'users']
            }
          ]
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        const result = await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(result).toEqual({
          welcomeDismissed: true,
          modulesVisited: ['dashboard', 'users']
        });
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT welcome_dismissed, modules_visited'),
          [userId]
        );
      });

      it('should return default preferences when none exist (Requirement 4.2)', async () => {
        // Arrange
        const userId = 'new-user-456';
        const mockDbResult = {
          rows: []
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        const result = await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(result).toEqual({
          welcomeDismissed: false,
          modulesVisited: []
        });
      });

      it('should handle preferences with empty modulesVisited array', async () => {
        // Arrange
        const userId = 'test-user-789';
        const mockDbResult = {
          rows: [
            {
              welcome_dismissed: true,
              modules_visited: []
            }
          ]
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        const result = await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(result.modulesVisited).toEqual([]);
        expect(Array.isArray(result.modulesVisited)).toBe(true);
      });

      it('should handle preferences with all modules visited', async () => {
        // Arrange
        const userId = 'test-user-complete';
        const allModules = ['dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'];
        const mockDbResult = {
          rows: [
            {
              welcome_dismissed: true,
              modules_visited: allModules
            }
          ]
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        const result = await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(result.modulesVisited).toEqual(allModules);
        expect(result.modulesVisited).toHaveLength(7);
      });

      it('should handle non-array modules_visited by converting to empty array', async () => {
        // Arrange
        const userId = 'test-user-malformed';
        const mockDbResult = {
          rows: [
            {
              welcome_dismissed: false,
              modules_visited: null // Malformed data
            }
          ]
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        const result = await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(result.modulesVisited).toEqual([]);
        expect(Array.isArray(result.modulesVisited)).toBe(true);
      });
    });

    describe('User Data Isolation (Requirement 9.4)', () => {
      it('should query preferences for specific user only', async () => {
        // Arrange
        const userId = 'specific-user-123';
        const mockDbResult = {
          rows: [
            {
              welcome_dismissed: true,
              modules_visited: ['dashboard']
            }
          ]
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE user_id = $1'),
          [userId]
        );
      });

      it('should not return data for other users', async () => {
        // Arrange
        const userId = 'user-a';
        const mockDbResult = {
          rows: [] // No data for this user
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        const result = await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(result).toEqual({
          welcomeDismissed: false,
          modulesVisited: []
        });
        // Verify query was made with correct user ID
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          [userId]
        );
      });
    });

    describe('Error Handling (Requirement 9.2)', () => {
      it('should throw error when database query fails', async () => {
        // Arrange
        const userId = 'test-user-error';
        const dbError = new Error('Database connection failed');
        mockPool.query.mockRejectedValue(dbError);

        // Act & Assert
        await expect(
          userPreferencesService.getOnboardingPreferences(userId)
        ).rejects.toThrow('Database connection failed');
      });

      it('should throw error when database is unavailable', async () => {
        // Arrange
        const userId = 'test-user-unavailable';
        mockPool.query.mockRejectedValue(new Error('ECONNREFUSED'));

        // Act & Assert
        await expect(
          userPreferencesService.getOnboardingPreferences(userId)
        ).rejects.toThrow('ECONNREFUSED');
      });

      it('should throw error when query times out', async () => {
        // Arrange
        const userId = 'test-user-timeout';
        mockPool.query.mockRejectedValue(new Error('Query timeout'));

        // Act & Assert
        await expect(
          userPreferencesService.getOnboardingPreferences(userId)
        ).rejects.toThrow('Query timeout');
      });
    });

    describe('Database Query Structure', () => {
      it('should use correct SQL query structure', async () => {
        // Arrange
        const userId = 'test-user-sql';
        mockPool.query.mockResolvedValue({ rows: [] });

        // Act
        await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        const queryCall = mockPool.query.mock.calls[0];
        const sql = queryCall[0];
        expect(sql).toContain('SELECT welcome_dismissed, modules_visited');
        expect(sql).toContain('FROM user_onboarding_preferences');
        expect(sql).toContain('WHERE user_id = $1');
      });

      it('should use parameterized query to prevent SQL injection', async () => {
        // Arrange
        const userId = "'; DROP TABLE users; --";
        mockPool.query.mockResolvedValue({ rows: [] });

        // Act
        await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        const queryCall = mockPool.query.mock.calls[0];
        const params = queryCall[1];
        expect(params).toEqual([userId]);
        // Verify userId is passed as parameter, not concatenated into SQL
        expect(queryCall[0]).not.toContain(userId);
      });
    });

    describe('Data Type Handling', () => {
      it('should correctly map snake_case database columns to camelCase', async () => {
        // Arrange
        const userId = 'test-user-mapping';
        const mockDbResult = {
          rows: [
            {
              welcome_dismissed: true,
              modules_visited: ['dashboard']
            }
          ]
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        const result = await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(result).toHaveProperty('welcomeDismissed');
        expect(result).toHaveProperty('modulesVisited');
        expect(result).not.toHaveProperty('welcome_dismissed');
        expect(result).not.toHaveProperty('modules_visited');
      });

      it('should ensure welcomeDismissed is boolean', async () => {
        // Arrange
        const userId = 'test-user-boolean';
        const mockDbResult = {
          rows: [
            {
              welcome_dismissed: true,
              modules_visited: []
            }
          ]
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        const result = await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(typeof result.welcomeDismissed).toBe('boolean');
      });

      it('should ensure modulesVisited is array', async () => {
        // Arrange
        const userId = 'test-user-array';
        const mockDbResult = {
          rows: [
            {
              welcome_dismissed: false,
              modules_visited: ['users', 'forms']
            }
          ]
        };
        mockPool.query.mockResolvedValue(mockDbResult);

        // Act
        const result = await userPreferencesService.getOnboardingPreferences(userId);

        // Assert
        expect(Array.isArray(result.modulesVisited)).toBe(true);
      });
    });
  });
});
