/**
 * Property-Based Tests for User Preferences Service
 * 
 * Feature: onboarding-and-help-system
 * Property 10: User Data Isolation
 * 
 * For any authenticated user, when retrieving onboarding preferences, the system
 * should return only that user's preferences and never expose another user's
 * preference data.
 * 
 * Validates: Requirements 9.4
 */

import * as fc from 'fast-check';
import { userPreferencesService } from '../../services/user-preferences.service';

// Mock the database pool
jest.mock('../../database/pool', () => ({
  db: {
    getPool: jest.fn()
  }
}));

// Mock the logger
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Property 10: User Data Isolation', () => {
  let mockPool: any;

  beforeEach(() => {
    // Create a fresh mock pool for each test
    mockPool = {
      query: jest.fn()
    };
    
    // Import and mock the db module
    const { db } = require('../../database/pool');
    (db.getPool as jest.Mock).mockReturnValue(mockPool);
    
    // Set the mock pool on the service
    userPreferencesService.setPool(mockPool);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Arbitrary generator for user IDs
   * Generates realistic user ID strings
   */
  const userIdArbitrary = fc.oneof(
    fc.uuid(),
    fc.string({ minLength: 8, maxLength: 36 }),
    fc.integer({ min: 1, max: 999999 }).map(n => `user-${n}`)
  );

  /**
   * Arbitrary generator for onboarding preferences
   */
  const preferencesArbitrary = fc.record({
    welcomeDismissed: fc.boolean(),
    modulesVisited: fc.array(
      fc.constantFrom('dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'),
      { maxLength: 7 }
    )
  });

  it('should only return preferences for the requested user', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        preferencesArbitrary,
        async (userId, preferences) => {
          // Reset mocks for this property test iteration
          jest.clearAllMocks();
          mockPool.query.mockClear();
          
          // Arrange: Mock database to return preferences for this specific user
          mockPool.query.mockResolvedValue({
            rows: [
              {
                welcome_dismissed: preferences.welcomeDismissed,
                modules_visited: preferences.modulesVisited
              }
            ]
          });

          // Act: Retrieve preferences for the user
          const result = await userPreferencesService.getOnboardingPreferences(userId);

          // Assert: Property - Service must query with the exact userId
          expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE user_id = $1'),
            [userId]
          );

          // Assert: Property - Returned data matches the user's preferences
          expect(result.welcomeDismissed).toBe(preferences.welcomeDismissed);
          expect(result.modulesVisited).toEqual(preferences.modulesVisited);

          // Assert: Property - Query is called exactly once (no additional queries)
          expect(mockPool.query).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never return another user\'s preferences', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        userIdArbitrary,
        preferencesArbitrary,
        preferencesArbitrary,
        async (userA, userB, prefsA, prefsB) => {
          // Precondition: Users must be different
          fc.pre(userA !== userB);

          // Arrange: Create a mock database with preferences for both users
          const mockDatabase = new Map([
            [userA, prefsA],
            [userB, prefsB]
          ]);

          // Mock query to simulate database lookup
          mockPool.query.mockImplementation(async (_sql: string, params: any[]) => {
            const requestedUserId = params[0];
            const userPrefs = mockDatabase.get(requestedUserId);

            if (!userPrefs) {
              return { rows: [] };
            }

            return {
              rows: [
                {
                  welcome_dismissed: userPrefs.welcomeDismissed,
                  modules_visited: userPrefs.modulesVisited
                }
              ]
            };
          });

          // Act: Request preferences for user A
          const resultA = await userPreferencesService.getOnboardingPreferences(userA);

          // Assert: Property - User A receives only their own preferences
          expect(resultA.welcomeDismissed).toBe(prefsA.welcomeDismissed);
          expect(resultA.modulesVisited).toEqual(prefsA.modulesVisited);

          // Assert: Property - User A does NOT receive user B's preferences
          if (prefsA.welcomeDismissed !== prefsB.welcomeDismissed) {
            expect(resultA.welcomeDismissed).not.toBe(prefsB.welcomeDismissed);
          }

          // Clear mocks for next query
          jest.clearAllMocks();
          mockPool.query.mockImplementation(async (_sql: string, params: any[]) => {
            const requestedUserId = params[0];
            const userPrefs = mockDatabase.get(requestedUserId);

            if (!userPrefs) {
              return { rows: [] };
            }

            return {
              rows: [
                {
                  welcome_dismissed: userPrefs.welcomeDismissed,
                  modules_visited: userPrefs.modulesVisited
                }
              ]
            };
          });

          // Act: Request preferences for user B
          const resultB = await userPreferencesService.getOnboardingPreferences(userB);

          // Assert: Property - User B receives only their own preferences
          expect(resultB.welcomeDismissed).toBe(prefsB.welcomeDismissed);
          expect(resultB.modulesVisited).toEqual(prefsB.modulesVisited);

          // Assert: Property - User B does NOT receive user A's preferences
          if (prefsA.welcomeDismissed !== prefsB.welcomeDismissed) {
            expect(resultB.welcomeDismissed).not.toBe(prefsA.welcomeDismissed);
          }

          // Assert: Property - Each query uses the correct user ID
          expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE user_id = $1'),
            [userB]
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use parameterized queries to prevent SQL injection and ensure isolation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.uuid(),
          fc.string({ minLength: 5, maxLength: 100 }), // Longer strings to avoid single-char matches
          // Include potentially malicious strings
          fc.constant("'; DROP TABLE users; --"),
          fc.constant("' OR '1'='1"),
          fc.constant("admin' --"),
          fc.constant("1' UNION SELECT * FROM user_onboarding_preferences WHERE '1'='1"),
          fc.constant("malicious-user-123")
        ),
        async (userId) => {
          // Reset mocks for this property test iteration
          jest.clearAllMocks();
          mockPool.query.mockClear();
          
          // Arrange
          mockPool.query.mockResolvedValue({ rows: [] });

          // Act
          await userPreferencesService.getOnboardingPreferences(userId);

          // Assert: Property - userId is passed as a parameter, not concatenated
          const queryCall = mockPool.query.mock.calls[0];
          const sql = queryCall[0];
          const params = queryCall[1];

          // Property 1: SQL should use parameterized query ($1)
          expect(sql).toContain('$1');
          expect(sql).toContain('WHERE user_id = $1');

          // Property 2: userId should be in parameters array at position 0
          expect(params).toHaveLength(1);
          expect(params[0]).toBe(userId);

          // Property 3: The SQL structure should be fixed (not dynamically built with userId)
          expect(sql).toContain('SELECT welcome_dismissed, modules_visited');
          expect(sql).toContain('FROM user_onboarding_preferences');

          // Property 4: Query should be called exactly once
          expect(mockPool.query).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain data isolation across concurrent requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userId: userIdArbitrary,
            preferences: preferencesArbitrary
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (users) => {
          // Precondition: All users must have unique IDs
          const uniqueUserIds = new Set(users.map(u => u.userId));
          fc.pre(uniqueUserIds.size === users.length);

          // Reset mocks for this property test iteration
          jest.clearAllMocks();
          mockPool.query.mockClear();

          // Arrange: Create mock database with all users
          const mockDatabase = new Map(
            users.map(u => [u.userId, u.preferences])
          );

          mockPool.query.mockImplementation(async (_sql: string, params: any[]) => {
            const requestedUserId = params[0];
            const userPrefs = mockDatabase.get(requestedUserId);

            if (!userPrefs) {
              return { rows: [] };
            }

            return {
              rows: [
                {
                  welcome_dismissed: userPrefs.welcomeDismissed,
                  modules_visited: userPrefs.modulesVisited
                }
              ]
            };
          });

          // Act: Simulate concurrent requests for all users
          const results = await Promise.all(
            users.map(u => userPreferencesService.getOnboardingPreferences(u.userId))
          );

          // Assert: Property - Each user receives their own preferences
          for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const result = results[i];

            expect(result.welcomeDismissed).toBe(user.preferences.welcomeDismissed);
            expect(result.modulesVisited).toEqual(user.preferences.modulesVisited);

            // Property: No user receives another user's data
            for (let j = 0; j < users.length; j++) {
              if (i !== j) {
                const otherUser = users[j];
                // If preferences differ, ensure no cross-contamination
                if (user.preferences.welcomeDismissed !== otherUser.preferences.welcomeDismissed) {
                  expect(result.welcomeDismissed).not.toBe(otherUser.preferences.welcomeDismissed);
                }
              }
            }
          }

          // Assert: Property - Each user was queried exactly once
          expect(mockPool.query).toHaveBeenCalledTimes(users.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return default preferences without exposing other users\' data', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fc.array(
          fc.record({
            userId: userIdArbitrary,
            preferences: preferencesArbitrary
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (newUserId, existingUsers) => {
          // Precondition: newUserId should not be in existingUsers
          fc.pre(!existingUsers.some(u => u.userId === newUserId));

          // Arrange: Mock database with existing users only
          const mockDatabase = new Map(
            existingUsers.map(u => [u.userId, u.preferences])
          );

          mockPool.query.mockImplementation(async (_sql: string, params: any[]) => {
            const requestedUserId = params[0];
            const userPrefs = mockDatabase.get(requestedUserId);

            if (!userPrefs) {
              return { rows: [] }; // User not found
            }

            return {
              rows: [
                {
                  welcome_dismissed: userPrefs.welcomeDismissed,
                  modules_visited: userPrefs.modulesVisited
                }
              ]
            };
          });

          // Act: Request preferences for new user (not in database)
          const result = await userPreferencesService.getOnboardingPreferences(newUserId);

          // Assert: Property - New user receives default preferences
          expect(result.welcomeDismissed).toBe(false);
          expect(result.modulesVisited).toEqual([]);

          // Assert: Property - New user does NOT receive any existing user's data
          for (const existingUser of existingUsers) {
            if (existingUser.preferences.welcomeDismissed === true) {
              expect(result.welcomeDismissed).not.toBe(existingUser.preferences.welcomeDismissed);
            }
            if (existingUser.preferences.modulesVisited.length > 0) {
              expect(result.modulesVisited).not.toEqual(existingUser.preferences.modulesVisited);
            }
          }

          // Assert: Property - Query was made with the correct new user ID
          expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE user_id = $1'),
            [newUserId]
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: Preference Persistence
 * 
 * For any dialog dismissal action (welcome dialog with "don't show again", module
 * introduction dialog), the system should persist the dismissal preference to the
 * backend and the API should be called with the correct user and preference data.
 * 
 * **Validates: Requirements 1.3, 2.3, 4.1**
 */
describe('Property 2: Preference Persistence', () => {
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn()
    };
    
    const { db } = require('../../database/pool');
    (db.getPool as jest.Mock).mockReturnValue(mockPool);
    
    userPreferencesService.setPool(mockPool);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const userIdArbitrary = fc.oneof(
    fc.uuid(),
    fc.string({ minLength: 8, maxLength: 36 }),
    fc.integer({ min: 1, max: 999999 }).map(n => `user-${n}`)
  );

  const moduleIdArbitrary = fc.constantFrom(
    'dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'
  );

  it('should persist welcome dialog dismissal for any user', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fc.boolean(),
        async (userId, welcomeDismissed) => {
          jest.clearAllMocks();
          mockPool.query.mockClear();

          // Mock the GET query (current preferences)
          mockPool.query.mockResolvedValueOnce({
            rows: []
          });

          // Mock the INSERT/UPDATE query
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: welcomeDismissed,
              modules_visited: []
            }]
          });

          // Act: Update welcome dismissed preference
          await userPreferencesService.updateOnboardingPreferences(userId, {
            welcomeDismissed
          });

          // Assert: Property - Database was called to persist the preference
          expect(mockPool.query).toHaveBeenCalledTimes(2); // GET + INSERT/UPDATE

          // Assert: Property - The upsert query contains the correct user ID
          const upsertCall = mockPool.query.mock.calls[1];
          expect(upsertCall[0]).toContain('INSERT INTO user_onboarding_preferences');
          expect(upsertCall[1][0]).toBe(userId);

          // Assert: Property - The upsert query contains the correct preference value
          expect(upsertCall[1][1]).toBe(welcomeDismissed);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should persist module visit dismissal for any user and module', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fc.array(moduleIdArbitrary, { minLength: 1, maxLength: 7 }),
        async (userId, modulesToVisit) => {
          jest.clearAllMocks();
          mockPool.query.mockClear();

          // Mock the GET query (current preferences)
          mockPool.query.mockResolvedValueOnce({
            rows: []
          });

          // Mock the INSERT/UPDATE query
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: false,
              modules_visited: modulesToVisit
            }]
          });

          // Act: Update modules visited preference
          await userPreferencesService.updateOnboardingPreferences(userId, {
            modulesVisited: modulesToVisit
          });

          // Assert: Property - Database was called to persist the preference
          expect(mockPool.query).toHaveBeenCalledTimes(2); // GET + INSERT/UPDATE

          // Assert: Property - The upsert query contains the correct user ID
          const upsertCall = mockPool.query.mock.calls[1];
          expect(upsertCall[0]).toContain('INSERT INTO user_onboarding_preferences');
          expect(upsertCall[1][0]).toBe(userId);

          // Assert: Property - The upsert query contains the modules visited
          const persistedModules = JSON.parse(upsertCall[1][2]);
          expect(persistedModules).toEqual(expect.arrayContaining(modulesToVisit));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should persist both welcome dismissal and module visits together', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fc.boolean(),
        fc.array(moduleIdArbitrary, { maxLength: 7 }),
        async (userId, welcomeDismissed, modulesVisited) => {
          jest.clearAllMocks();
          mockPool.query.mockClear();

          // Mock the GET query (current preferences)
          mockPool.query.mockResolvedValueOnce({
            rows: []
          });

          // Mock the INSERT/UPDATE query
          const uniqueModules = [...new Set(modulesVisited)];
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: welcomeDismissed,
              modules_visited: uniqueModules
            }]
          });

          // Act: Update both preferences
          await userPreferencesService.updateOnboardingPreferences(userId, {
            welcomeDismissed,
            modulesVisited
          });

          // Assert: Property - Database was called to persist preferences
          expect(mockPool.query).toHaveBeenCalledTimes(2);

          // Assert: Property - Both preferences are persisted in the same call
          const upsertCall = mockPool.query.mock.calls[1];
          expect(upsertCall[1][0]).toBe(userId);
          expect(upsertCall[1][1]).toBe(welcomeDismissed);
          
          const persistedModules = JSON.parse(upsertCall[1][2]);
          expect(persistedModules).toEqual(expect.arrayContaining(modulesVisited));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use parameterized queries to persist preferences safely', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.uuid(),
          fc.string({ minLength: 5, maxLength: 100 }),
          fc.constant("'; DROP TABLE users; --"),
          fc.constant("' OR '1'='1")
        ),
        fc.boolean(),
        async (userId, welcomeDismissed) => {
          jest.clearAllMocks();
          mockPool.query.mockClear();

          // Mock the GET query
          mockPool.query.mockResolvedValueOnce({ rows: [] });

          // Mock the INSERT/UPDATE query
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: welcomeDismissed,
              modules_visited: []
            }]
          });

          // Act
          await userPreferencesService.updateOnboardingPreferences(userId, {
            welcomeDismissed
          });

          // Assert: Property - Upsert uses parameterized query
          const upsertCall = mockPool.query.mock.calls[1];
          const sql = upsertCall[0];
          const params = upsertCall[1];

          expect(sql).toContain('$1');
          expect(sql).toContain('$2');
          expect(sql).toContain('$3');
          expect(params[0]).toBe(userId);
          expect(params[1]).toBe(welcomeDismissed);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 5: Preference Data Integrity
 * 
 * For any set of onboarding preferences (welcome dismissed, modules visited), when
 * stored and then retrieved, the retrieved data should match the stored data exactly,
 * maintaining separate tracking for each dialog type.
 * 
 * **Validates: Requirements 4.3, 4.4**
 */
describe('Property 5: Preference Data Integrity', () => {
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn()
    };
    
    const { db } = require('../../database/pool');
    (db.getPool as jest.Mock).mockReturnValue(mockPool);
    
    userPreferencesService.setPool(mockPool);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const userIdArbitrary = fc.oneof(
    fc.uuid(),
    fc.string({ minLength: 8, maxLength: 36 }),
    fc.integer({ min: 1, max: 999999 }).map(n => `user-${n}`)
  );

  const preferencesArbitrary = fc.record({
    welcomeDismissed: fc.boolean(),
    modulesVisited: fc.array(
      fc.constantFrom('dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'),
      { maxLength: 7 }
    )
  });

  it('should maintain data integrity for any preference combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        preferencesArbitrary,
        async (userId, preferences) => {
          jest.clearAllMocks();
          mockPool.query.mockClear();

          // Remove duplicates from modules visited
          const uniqueModules = [...new Set(preferences.modulesVisited)];

          // Mock the GET query (current preferences - empty)
          mockPool.query.mockResolvedValueOnce({ rows: [] });

          // Mock the INSERT/UPDATE query (store)
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: preferences.welcomeDismissed,
              modules_visited: uniqueModules
            }]
          });

          // Act: Store preferences
          const stored = await userPreferencesService.updateOnboardingPreferences(
            userId,
            preferences
          );

          // Mock the GET query (retrieve)
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: preferences.welcomeDismissed,
              modules_visited: uniqueModules
            }]
          });

          // Act: Retrieve preferences
          const retrieved = await userPreferencesService.getOnboardingPreferences(userId);

          // Assert: Property - Retrieved data matches stored data exactly
          expect(retrieved.welcomeDismissed).toBe(stored.welcomeDismissed);
          expect(retrieved.modulesVisited).toEqual(stored.modulesVisited);

          // Assert: Property - Welcome dismissed is preserved
          expect(retrieved.welcomeDismissed).toBe(preferences.welcomeDismissed);

          // Assert: Property - Modules visited are preserved (order may differ, but content same)
          expect(retrieved.modulesVisited.sort()).toEqual(uniqueModules.sort());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain separate tracking for welcome and module preferences', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fc.boolean(),
        fc.array(
          fc.constantFrom('dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'),
          { maxLength: 7 }
        ),
        async (userId, welcomeDismissed, modulesVisited) => {
          jest.clearAllMocks();
          mockPool.query.mockClear();

          const uniqueModules = [...new Set(modulesVisited)];

          // Store welcome preference first
          mockPool.query.mockResolvedValueOnce({ rows: [] });
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: welcomeDismissed,
              modules_visited: []
            }]
          });

          await userPreferencesService.updateOnboardingPreferences(userId, {
            welcomeDismissed
          });

          // Store module preference separately
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: welcomeDismissed,
              modules_visited: []
            }]
          });
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: welcomeDismissed,
              modules_visited: uniqueModules
            }]
          });

          await userPreferencesService.updateOnboardingPreferences(userId, {
            modulesVisited
          });

          // Retrieve and verify both are preserved
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: welcomeDismissed,
              modules_visited: uniqueModules
            }]
          });

          const retrieved = await userPreferencesService.getOnboardingPreferences(userId);

          // Assert: Property - Both preferences are maintained independently
          expect(retrieved.welcomeDismissed).toBe(welcomeDismissed);
          expect(retrieved.modulesVisited.sort()).toEqual(uniqueModules.sort());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve data integrity across multiple updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fc.array(preferencesArbitrary, { minLength: 2, maxLength: 5 }),
        async (userId, updateSequence) => {
          jest.clearAllMocks();
          mockPool.query.mockClear();

          let currentWelcome = false;
          let currentModules: string[] = [];

          // Apply updates sequentially
          for (const update of updateSequence) {
            // Update expected state
            if (update.welcomeDismissed !== undefined) {
              currentWelcome = update.welcomeDismissed;
            }
            if (update.modulesVisited !== undefined) {
              currentModules = [...new Set([...currentModules, ...update.modulesVisited])];
            }

            // Mock GET (current state)
            mockPool.query.mockResolvedValueOnce({
              rows: currentModules.length > 0 || currentWelcome ? [{
                welcome_dismissed: currentWelcome,
                modules_visited: currentModules
              }] : []
            });

            // Mock INSERT/UPDATE
            mockPool.query.mockResolvedValueOnce({
              rows: [{
                welcome_dismissed: currentWelcome,
                modules_visited: currentModules
              }]
            });

            await userPreferencesService.updateOnboardingPreferences(userId, update);
          }

          // Final retrieval
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: currentWelcome,
              modules_visited: currentModules
            }]
          });

          const final = await userPreferencesService.getOnboardingPreferences(userId);

          // Assert: Property - Final state reflects all updates
          expect(final.welcomeDismissed).toBe(currentWelcome);
          expect(final.modulesVisited.sort()).toEqual(currentModules.sort());

          // Assert: Property - Modules are additive (no data loss)
          const allModulesFromUpdates = [...new Set(
            updateSequence.flatMap(u => u.modulesVisited || [])
          )];
          for (const module of allModulesFromUpdates) {
            expect(final.modulesVisited).toContain(module);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle empty and full preference sets correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        async (userId) => {
          jest.clearAllMocks();
          mockPool.query.mockClear();

          // Test empty preferences
          mockPool.query.mockResolvedValueOnce({ rows: [] });
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: false,
              modules_visited: []
            }]
          });

          const empty = await userPreferencesService.updateOnboardingPreferences(userId, {
            welcomeDismissed: false,
            modulesVisited: []
          });

          expect(empty.welcomeDismissed).toBe(false);
          expect(empty.modulesVisited).toEqual([]);

          // Test full preferences
          const allModules = ['dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'];
          
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: false,
              modules_visited: []
            }]
          });
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: true,
              modules_visited: allModules
            }]
          });

          const full = await userPreferencesService.updateOnboardingPreferences(userId, {
            welcomeDismissed: true,
            modulesVisited: allModules
          });

          expect(full.welcomeDismissed).toBe(true);
          expect(full.modulesVisited.sort()).toEqual(allModules.sort());

          // Assert: Property - Both empty and full states maintain integrity
          expect(empty.modulesVisited.length).toBe(0);
          expect(full.modulesVisited.length).toBe(7);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should deduplicate modules while maintaining data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fc.array(
          fc.constantFrom('dashboard', 'users', 'forms'),
          { minLength: 3, maxLength: 10 }
        ),
        async (userId, modulesWithDuplicates) => {
          jest.clearAllMocks();
          mockPool.query.mockClear();

          // Precondition: Ensure there are duplicates
          fc.pre(modulesWithDuplicates.length > new Set(modulesWithDuplicates).size);

          const uniqueModules = [...new Set(modulesWithDuplicates)];

          mockPool.query.mockResolvedValueOnce({ rows: [] });
          mockPool.query.mockResolvedValueOnce({
            rows: [{
              welcome_dismissed: false,
              modules_visited: uniqueModules
            }]
          });

          const result = await userPreferencesService.updateOnboardingPreferences(userId, {
            modulesVisited: modulesWithDuplicates
          });

          // Assert: Property - Duplicates are removed
          expect(result.modulesVisited.length).toBe(uniqueModules.length);
          expect(new Set(result.modulesVisited).size).toBe(result.modulesVisited.length);

          // Assert: Property - All unique modules are preserved
          for (const module of uniqueModules) {
            expect(result.modulesVisited).toContain(module);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
