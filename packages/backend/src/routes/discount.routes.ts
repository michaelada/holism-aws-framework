import { Router, Request, Response } from 'express';
import { discountService } from '../services/discount.service';
import { discountValidatorService } from '../services/discount-validator.service';
import { discountCalculatorService } from '../services/discount-calculator.service';
import { authenticateToken, requireOrgAdminCapability } from '../middleware';
import { logger } from '../config/logger';
import { ModuleType } from '../types/discount.types';

const router = Router();

// Helper function to get capability based on module type
function getCapabilityForModule(moduleType: ModuleType): string {
  const capabilityMap: Record<ModuleType, string> = {
    events: 'entry-discounts',
    memberships: 'membership-discounts',
    calendar: 'calendar-discounts',
    merchandise: 'merchandise-discounts',
    registrations: 'registration-discounts',
  };
  return capabilityMap[moduleType];
}

/**
 * Get all discounts for an organisation (optionally filtered by module)
 */
router.get(
  '/organisations/:organisationId/discounts',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { moduleType, page, pageSize } = req.query;

      const result = await discountService.getByOrganisation(
        organisationId,
        moduleType as ModuleType | undefined,
        page ? parseInt(page as string, 10) : 1,
        pageSize ? parseInt(pageSize as string, 10) : 50
      );

      res.json(result);
    } catch (error) {
      logger.error('Error in GET /discounts:', error);
      res.status(500).json({ error: 'Failed to fetch discounts' });
    }
  }
);

/**
 * Get discounts for a specific module type
 */
router.get(
  '/organisations/:organisationId/discounts/:moduleType',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId, moduleType } = req.params;
      const { page, pageSize } = req.query;

      // Check capability for this module
      const capability = getCapabilityForModule(moduleType as ModuleType);
      const capabilityMiddleware = requireOrgAdminCapability(capability);
      
      // Execute capability check
      for (const middleware of capabilityMiddleware) {
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err?: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const result = await discountService.getByOrganisation(
        organisationId,
        moduleType as ModuleType,
        page ? parseInt(page as string, 10) : 1,
        pageSize ? parseInt(pageSize as string, 10) : 50
      );

      res.json(result);
    } catch (error) {
      logger.error('Error in GET /discounts/:moduleType:', error);
      res.status(500).json({ error: 'Failed to fetch discounts' });
    }
  }
);

/**
 * Create a new discount
 */
router.post(
  '/discounts',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { moduleType } = req.body;

      if (!moduleType) {
        return res.status(400).json({ error: 'Module type is required' });
      }

      // Check capability for this module
      const capability = getCapabilityForModule(moduleType as ModuleType);
      const capabilityMiddleware = requireOrgAdminCapability(capability);
      
      // Execute capability check
      for (const middleware of capabilityMiddleware) {
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err?: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const discount = await discountService.create(req.body);
      return res.status(201).json(discount);
    } catch (error) {
      logger.error('Error in POST /discounts:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to create discount' });
    }
  }
);

/**
 * Get discount by ID
 */
router.get(
  '/discounts/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { organisationId } = req.query;

      if (!organisationId) {
        return res.status(400).json({ error: 'Organisation ID is required' });
      }

      const discount = await discountService.getById(id, organisationId as string);

      if (!discount) {
        return res.status(404).json({ error: 'Discount not found' });
      }

      // Check capability for this module
      const capability = getCapabilityForModule(discount.moduleType);
      const capabilityMiddleware = requireOrgAdminCapability(capability);
      
      // Execute capability check
      for (const middleware of capabilityMiddleware) {
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err?: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      return res.json(discount);
    } catch (error) {
      logger.error('Error in GET /discounts/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch discount' });
    }
  }
);

/**
 * Update a discount
 */
router.put(
  '/discounts/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { organisationId } = req.body;

      if (!organisationId) {
        return res.status(400).json({ error: 'Organisation ID is required' });
      }

      // Get existing discount to check module type
      const existing = await discountService.getById(id, organisationId);
      if (!existing) {
        return res.status(404).json({ error: 'Discount not found' });
      }

      // Check capability for this module
      const capability = getCapabilityForModule(existing.moduleType);
      const capabilityMiddleware = requireOrgAdminCapability(capability);
      
      // Execute capability check
      for (const middleware of capabilityMiddleware) {
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err?: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const discount = await discountService.update(id, organisationId, req.body);
      return res.json(discount);
    } catch (error) {
      logger.error('Error in PUT /discounts/:id:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to update discount' });
    }
  }
);

/**
 * Delete a discount
 */
router.delete(
  '/discounts/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { organisationId } = req.query;

      if (!organisationId) {
        return res.status(400).json({ error: 'Organisation ID is required' });
      }

      // Get existing discount to check module type
      const existing = await discountService.getById(id, organisationId as string);
      if (!existing) {
        return res.status(404).json({ error: 'Discount not found' });
      }

      // Check capability for this module
      const capability = getCapabilityForModule(existing.moduleType);
      const capabilityMiddleware = requireOrgAdminCapability(capability);
      
      // Execute capability check
      for (const middleware of capabilityMiddleware) {
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err?: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const deleted = await discountService.delete(id, organisationId as string);
      if (!deleted) {
        return res.status(404).json({ error: 'Discount not found' });
      }

      return res.status(204).send();
    } catch (error: any) {
      logger.error('Error in DELETE /discounts/:id:', error);
      
      // Handle 409 conflict for in-use discounts
      if (error.statusCode === 409) {
        return res.status(409).json({
          error: 'Discount is in use',
          message: `Cannot delete discount. It is associated with ${error.affectedCount} membership type(s).`,
          affectedCount: error.affectedCount,
          discountId: error.discountId,
        });
      }
      
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to delete discount' });
    }
  }
);

/**
 * Force delete a discount (removes from all associated membership types)
 */
router.delete(
  '/discounts/:id/force',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { organisationId } = req.query;

      if (!organisationId) {
        return res.status(400).json({ error: 'Organisation ID is required' });
      }

      // Get existing discount to check module type
      const existing = await discountService.getById(id, organisationId as string);
      if (!existing) {
        return res.status(404).json({ error: 'Discount not found' });
      }

      // Check capability for this module
      const capability = getCapabilityForModule(existing.moduleType);
      const capabilityMiddleware = requireOrgAdminCapability(capability);
      
      // Execute capability check
      for (const middleware of capabilityMiddleware) {
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err?: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      await discountService.forceDelete(id, organisationId as string);
      return res.status(204).send();
    } catch (error: any) {
      logger.error('Error in DELETE /discounts/:id/force:', error);
      
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to force delete discount' });
    }
  }
);

/**
 * Get membership types using a discount
 */
router.get(
  '/discounts/:id/membership-types',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { organisationId } = req.query;

      if (!organisationId) {
        return res.status(400).json({ error: 'Organisation ID is required' });
      }

      // Get existing discount to check module type
      const existing = await discountService.getById(id, organisationId as string);
      if (!existing) {
        return res.status(404).json({ error: 'Discount not found' });
      }

      // Check capability for this module
      const capability = getCapabilityForModule(existing.moduleType);
      const capabilityMiddleware = requireOrgAdminCapability(capability);
      
      // Execute capability check
      for (const middleware of capabilityMiddleware) {
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err?: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const membershipTypeIds = await discountService.getMembershipTypesUsingDiscount(
        id,
        organisationId as string
      );

      return res.json({
        membershipTypeIds,
        count: membershipTypeIds.length,
      });
    } catch (error) {
      logger.error('Error in GET /discounts/:id/membership-types:', error);
      return res.status(500).json({ error: 'Failed to fetch membership types' });
    }
  }
);

/**
 * Apply discount to a target entity
 */
router.post(
  '/discounts/:id/apply',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { targetType, targetId, appliedBy } = req.body;

      if (!targetType || !targetId) {
        return res.status(400).json({ error: 'Target type and ID are required' });
      }

      await discountService.applyToTarget(id, targetType, targetId, appliedBy);
      return res.status(200).json({ message: 'Discount applied successfully' });
    } catch (error) {
      logger.error('Error in POST /discounts/:id/apply:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to apply discount' });
    }
  }
);

/**
 * Remove discount from a target entity
 */
router.delete(
  '/discounts/:id/apply/:targetType/:targetId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id, targetType, targetId } = req.params;

      const removed = await discountService.removeFromTarget(id, targetType, targetId);
      if (!removed) {
        return res.status(404).json({ error: 'Discount application not found' });
      }

      return res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /discounts/:id/apply:', error);
      return res.status(500).json({ error: 'Failed to remove discount' });
    }
  }
);

/**
 * Get discounts for a target entity
 */
router.get(
  '/discounts/target/:targetType/:targetId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { targetType, targetId } = req.params;

      const discounts = await discountService.getForTarget(targetType, targetId);
      return res.json(discounts);
    } catch (error) {
      logger.error('Error in GET /discounts/target:', error);
      return res.status(500).json({ error: 'Failed to fetch discounts for target' });
    }
  }
);

/**
 * Validate a discount
 */
router.post(
  '/discounts/validate',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { discountId, userId, amount, quantity } = req.body;

      if (!discountId || !userId || amount === undefined || quantity === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get discount
      const discount = await discountService.getById(discountId, req.body.organisationId);
      if (!discount) {
        return res.status(404).json({ error: 'Discount not found' });
      }

      const result = await discountValidatorService.validateDiscount(
        discount,
        userId,
        amount,
        quantity
      );

      return res.json(result);
    } catch (error) {
      logger.error('Error in POST /discounts/validate:', error);
      return res.status(500).json({ error: 'Failed to validate discount' });
    }
  }
);

/**
 * Validate a discount code
 */
router.post(
  '/discounts/validate-code',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { code, organisationId } = req.body;

      if (!code || !organisationId) {
        return res.status(400).json({ error: 'Code and organisation ID are required' });
      }

      const discount = await discountValidatorService.validateCode(code, organisationId);
      if (!discount) {
        return res.status(404).json({ error: 'Discount code not found' });
      }

      return res.json(discount);
    } catch (error) {
      logger.error('Error in POST /discounts/validate-code:', error);
      return res.status(500).json({ error: 'Failed to validate discount code' });
    }
  }
);

/**
 * Calculate discount for an item
 */
router.post(
  '/discounts/calculate',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { discountId, itemPrice, quantity, organisationId } = req.body;

      if (!discountId || itemPrice === undefined || quantity === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get discount
      const discount = await discountService.getById(discountId, organisationId);
      if (!discount) {
        return res.status(404).json({ error: 'Discount not found' });
      }

      const result =
        discount.applicationScope === 'quantity-based'
          ? discountCalculatorService.calculateQuantityDiscount(discount, itemPrice, quantity)
          : discountCalculatorService.calculateItemDiscount(discount, itemPrice, quantity);

      return res.json(result);
    } catch (error) {
      logger.error('Error in POST /discounts/calculate:', error);
      return res.status(500).json({ error: 'Failed to calculate discount' });
    }
  }
);

/**
 * Calculate cart discounts
 */
router.post(
  '/discounts/calculate-cart',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { cartItems, discountIds, userId, organisationId } = req.body;

      if (!cartItems || !discountIds || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get all discounts
      const discounts = await Promise.all(
        discountIds.map((id: string) => discountService.getById(id, organisationId))
      );

      const validDiscounts = discounts.filter((d) => d !== null);

      const result = discountCalculatorService.calculateCartDiscounts(
        cartItems,
        validDiscounts as any[]
      );

      return res.json(result);
    } catch (error) {
      logger.error('Error in POST /discounts/calculate-cart:', error);
      return res.status(500).json({ error: 'Failed to calculate cart discounts' });
    }
  }
);

/**
 * Get usage history for a discount
 */
router.get(
  '/discounts/:id/usage',
  authenticateToken(),
  async (_req: Request, res: Response) => {
    try {
      // TODO: Implement pagination for usage history
      // For now, return empty array
      return res.json({ usage: [], total: 0 });
    } catch (error) {
      logger.error('Error in GET /discounts/:id/usage:', error);
      return res.status(500).json({ error: 'Failed to fetch usage history' });
    }
  }
);

/**
 * Get usage statistics for a discount
 */
router.get(
  '/discounts/:id/stats',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const stats = await discountService.getUsageStats(id);
      return res.json(stats);
    } catch (error) {
      logger.error('Error in GET /discounts/:id/stats:', error);
      return res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }
  }
);

export default router;
