import { Pool } from 'pg';
import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * User onboarding preferences interface
 */
export interface OnboardingPreferences {
  welcomeDismissed: boolean;
  modulesVisited: string[];
}

/**
 * Service for managing user onboarding preferences
 * 
 * This service handles:
 * - Retrieving user preferences from the database
 * - Storing and updating user preferences
 * - Providing default preferences for new users
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 9.1, 9.2, 9.4, 9.5
 */
class UserPreferencesService {
  private pool: Pool | null = null;

  /**
   * Initialize the service with a database pool
   * This is called lazily on first use
   */
  private getPool(): Pool {
    if (!this.pool) {
      this.pool = db.getPool();
    }
    return this.pool;
  }

  /**
   * Set a custom pool (for testing)
   */
  setPool(pool: Pool): void {
    this.pool = pool;
  }

  /**
   * Get onboarding preferences for a user
   * Returns default empty preferences if none exist
   * 
   * @param userId - The user's ID from JWT token
   * @returns User's onboarding preferences
   * 
   * Requirements: 4.2, 4.4, 9.2, 9.4
   */
  async getOnboardingPreferences(userId: string): Promise<OnboardingPreferences> {
    try {
      logger.info('Getting onboarding preferences', { userId });

      const pool = this.getPool();
      const result = await pool.query(
        `SELECT welcome_dismissed, modules_visited 
         FROM user_onboarding_preferences 
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Return default preferences if none exist
        logger.info('No preferences found, returning defaults', { userId });
        return {
          welcomeDismissed: false,
          modulesVisited: []
        };
      }

      const row = result.rows[0];
      return {
        welcomeDismissed: row.welcome_dismissed,
        modulesVisited: Array.isArray(row.modules_visited) ? row.modules_visited : []
      };
    } catch (error) {
      logger.error('Error getting onboarding preferences', { userId, error });
      throw error;
    }
  }

  /**
   * Update onboarding preferences for a user
   * Creates new record if none exists, otherwise updates existing
   * 
   * @param userId - The user's ID from JWT token
   * @param preferences - Partial preferences to update
   * @returns Updated preferences
   * 
   * Requirements: 4.1, 4.3, 9.1, 9.3
   */
  async updateOnboardingPreferences(
    userId: string,
    preferences: Partial<OnboardingPreferences>
  ): Promise<OnboardingPreferences> {
    try {
      logger.info('Updating onboarding preferences', { userId, preferences });

      // Get current preferences
      const current = await this.getOnboardingPreferences(userId);

      // Merge preferences (additive for modulesVisited)
      const welcomeDismissed = preferences.welcomeDismissed ?? current.welcomeDismissed;
      const modulesVisited = preferences.modulesVisited
        ? [...new Set([...current.modulesVisited, ...preferences.modulesVisited])]
        : current.modulesVisited;

      // Upsert preferences
      const pool = this.getPool();
      const result = await pool.query(
        `INSERT INTO user_onboarding_preferences (user_id, welcome_dismissed, modules_visited, last_updated)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           welcome_dismissed = $2,
           modules_visited = $3,
           last_updated = CURRENT_TIMESTAMP
         RETURNING welcome_dismissed, modules_visited`,
        [userId, welcomeDismissed, JSON.stringify(modulesVisited)]
      );

      const row = result.rows[0];
      return {
        welcomeDismissed: row.welcome_dismissed,
        modulesVisited: Array.isArray(row.modules_visited) ? row.modules_visited : []
      };
    } catch (error) {
      logger.error('Error updating onboarding preferences', { userId, error });
      throw error;
    }
  }
}

export const userPreferencesService = new UserPreferencesService();
