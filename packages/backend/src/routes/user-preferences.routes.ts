import { Router, Response } from 'express';
import { userPreferencesService } from '../services/user-preferences.service';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken());

/**
 * User Preferences Routes
 * Base path: /api/user-preferences
 */

/**
 * GET /api/user-preferences/onboarding
 * Get onboarding preferences for the authenticated user
 * 
 * Returns user's preferences or default empty state if none exist
 * 
 * Requirements: 4.2, 4.4, 9.2, 9.3, 9.4
 */
router.get('/onboarding', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Validate authentication
    if (!req.user || !req.user.userId) {
      logger.warn('Unauthenticated request to get onboarding preferences');
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const userId = req.user.userId;
    logger.info('Getting onboarding preferences', { userId });

    const preferences = await userPreferencesService.getOnboardingPreferences(userId);

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    logger.error('Error getting onboarding preferences:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get onboarding preferences'
      }
    });
  }
});

/**
 * PUT /api/user-preferences/onboarding
 * Update onboarding preferences for the authenticated user
 * 
 * Request body:
 * - welcomeDismissed (optional): boolean
 * - modulesVisited (optional): array of valid module IDs
 * 
 * Merges new preferences with existing (additive for modulesVisited)
 * 
 * Requirements: 4.1, 4.3, 9.1, 9.3
 */
router.put('/onboarding', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Validate authentication
    if (!req.user || !req.user.userId) {
      logger.warn('Unauthenticated request to update onboarding preferences');
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const userId = req.user.userId;
    const { welcomeDismissed, modulesVisited } = req.body;

    // Validate request body
    if (welcomeDismissed !== undefined && typeof welcomeDismissed !== 'boolean') {
      logger.warn('Invalid welcomeDismissed value', { userId, welcomeDismissed });
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'welcomeDismissed must be a boolean'
        }
      });
      return;
    }

    // Valid module IDs as per design document
    const validModuleIds = ['dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'];

    if (modulesVisited !== undefined) {
      if (!Array.isArray(modulesVisited)) {
        logger.warn('Invalid modulesVisited value - not an array', { userId, modulesVisited });
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'modulesVisited must be an array'
          }
        });
        return;
      }

      // Validate all module IDs
      const invalidModules = modulesVisited.filter(id => !validModuleIds.includes(id));
      if (invalidModules.length > 0) {
        logger.warn('Invalid module IDs provided', { userId, invalidModules });
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: `Invalid module IDs: ${invalidModules.join(', ')}. Valid modules are: ${validModuleIds.join(', ')}`
          }
        });
        return;
      }
    }

    // Ensure at least one preference is provided
    if (welcomeDismissed === undefined && modulesVisited === undefined) {
      logger.warn('No preferences provided in request', { userId });
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'At least one preference (welcomeDismissed or modulesVisited) must be provided'
        }
      });
      return;
    }

    logger.info('Updating onboarding preferences', { userId, welcomeDismissed, modulesVisited });

    const preferences: Partial<{ welcomeDismissed: boolean; modulesVisited: string[] }> = {};
    if (welcomeDismissed !== undefined) {
      preferences.welcomeDismissed = welcomeDismissed;
    }
    if (modulesVisited !== undefined) {
      preferences.modulesVisited = modulesVisited;
    }

    const updatedPreferences = await userPreferencesService.updateOnboardingPreferences(userId, preferences);

    res.json({
      success: true,
      data: updatedPreferences
    });
  } catch (error) {
    logger.error('Error updating onboarding preferences:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update onboarding preferences'
      }
    });
  }
});

export default router;
