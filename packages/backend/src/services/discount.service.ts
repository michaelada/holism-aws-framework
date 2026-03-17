import { db } from '../database/pool';
import { logger } from '../config/logger';
import {
  Discount,
  CreateDiscountDto,
  UpdateDiscountDto,
  ModuleType,
} from '../types/discount.types';

/**
 * Discount Service
 * 
 * Handles CRUD operations for discounts including:
 * - Creating, reading, updating, and deleting discounts
 * - Organization-scoped queries
 * - Module-specific filtering
 * - Pagination support
 */
export class DiscountService {
  /**
   * Convert database row to Discount object
   */
  private mapRowToDiscount(row: any): Discount {
    return {
      id: row.id,
      organisationId: row.organisationId,
      moduleType: row.moduleType,
      name: row.name,
      description: row.description,
      code: row.code,
      discountType: row.discountType,
      discountValue: parseFloat(row.discountValue),
      applicationScope: row.applicationScope,
      quantityRules: row.quantityRules,
      eligibilityCriteria: row.eligibilityCriteria,
      validFrom: row.validFrom ? new Date(row.validFrom) : undefined,
      validUntil: row.validUntil ? new Date(row.validUntil) : undefined,
      usageLimits: row.usageLimits,
      combinable: row.combinable,
      priority: row.priority,
      status: row.status,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      createdBy: row.createdBy,
    };
  }

  /**
   * Get all discounts for an organization with optional module filter
   */
  async getByOrganisation(
    organisationId: string,
    moduleType?: ModuleType,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ discounts: Discount[]; total: number }> {
    try {
      const offset = (page - 1) * pageSize;
      let query = `
        SELECT 
          id, organisation_id as "organisationId", module_type as "moduleType",
          name, description, code,
          discount_type as "discountType", discount_value as "discountValue",
          application_scope as "applicationScope", quantity_rules as "quantityRules",
          eligibility_criteria as "eligibilityCriteria",
          valid_from as "validFrom", valid_until as "validUntil",
          usage_limits as "usageLimits",
          combinable, priority, status,
          created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"
        FROM discounts
        WHERE organisation_id = $1
      `;
      const params: any[] = [organisationId];

      if (moduleType) {
        query += ` AND module_type = $2`;
        params.push(moduleType);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(pageSize, offset);

      const result = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM discounts WHERE organisation_id = $1`;
      const countParams: any[] = [organisationId];
      if (moduleType) {
        countQuery += ` AND module_type = $2`;
        countParams.push(moduleType);
      }
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count, 10);

      return {
        discounts: result.rows.map(this.mapRowToDiscount),
        total,
      };
    } catch (error) {
      logger.error('Error getting discounts by organisation:', error);
      throw error;
    }
  }

  /**
   * Get discount by ID with organization ownership check
   */
  async getById(id: string, organisationId: string): Promise<Discount | null> {
    try {
      const result = await db.query(
        `SELECT 
          id, organisation_id as "organisationId", module_type as "moduleType",
          name, description, code,
          discount_type as "discountType", discount_value as "discountValue",
          application_scope as "applicationScope", quantity_rules as "quantityRules",
          eligibility_criteria as "eligibilityCriteria",
          valid_from as "validFrom", valid_until as "validUntil",
          usage_limits as "usageLimits",
          combinable, priority, status,
          created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"
        FROM discounts
        WHERE id = $1 AND organisation_id = $2`,
        [id, organisationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToDiscount(result.rows[0]);
    } catch (error) {
      logger.error('Error getting discount by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new discount
   */
  async create(data: CreateDiscountDto): Promise<Discount> {
    try {
      // Validate required fields
      if (!data.name || !data.discountType || !data.discountValue || !data.applicationScope) {
        throw new Error('Missing required fields');
      }

      // Validate discount value based on type
      if (data.discountType === 'percentage') {
        if (data.discountValue < 0 || data.discountValue > 100) {
          throw new Error('Percentage discount must be between 0 and 100');
        }
      } else {
        if (data.discountValue <= 0) {
          throw new Error('Fixed discount must be greater than 0');
        }
      }

      // Validate code length if provided
      if (data.code && (data.code.length < 3 || data.code.length > 50)) {
        throw new Error('Discount code must be between 3 and 50 characters');
      }

      // Validate date range if both dates provided
      if (data.validFrom && data.validUntil && data.validFrom >= data.validUntil) {
        throw new Error('Valid from date must be before valid until date');
      }

      // Initialize usage limits with currentUsageCount
      const usageLimits = data.usageLimits
        ? { ...data.usageLimits, currentUsageCount: 0 }
        : { currentUsageCount: 0 };

      const result = await db.query(
        `INSERT INTO discounts (
          organisation_id, module_type, name, description, code,
          discount_type, discount_value, application_scope, quantity_rules,
          eligibility_criteria, valid_from, valid_until, usage_limits,
          combinable, priority, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING 
          id, organisation_id as "organisationId", module_type as "moduleType",
          name, description, code,
          discount_type as "discountType", discount_value as "discountValue",
          application_scope as "applicationScope", quantity_rules as "quantityRules",
          eligibility_criteria as "eligibilityCriteria",
          valid_from as "validFrom", valid_until as "validUntil",
          usage_limits as "usageLimits",
          combinable, priority, status,
          created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"`,
        [
          data.organisationId,
          data.moduleType,
          data.name,
          data.description || null,
          data.code || null,
          data.discountType,
          data.discountValue,
          data.applicationScope,
          data.quantityRules ? JSON.stringify(data.quantityRules) : null,
          data.eligibilityCriteria ? JSON.stringify(data.eligibilityCriteria) : null,
          data.validFrom || null,
          data.validUntil || null,
          JSON.stringify(usageLimits),
          data.combinable !== undefined ? data.combinable : true,
          data.priority !== undefined ? data.priority : 0,
          data.status || 'active',
          data.createdBy || null,
        ]
      );

      logger.info(`Created discount: ${result.rows[0].id}`);
      return this.mapRowToDiscount(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation
        throw new Error('Discount code already exists in this organization');
      }
      logger.error('Error creating discount:', error);
      throw error;
    }
  }

  /**
   * Check if a discount is currently in use by any events or activities
   */
  async isDiscountInUse(discountId: string): Promise<boolean> {
    try {
      // Check if discount is referenced in events table
      const eventCheck = await db.query(
        `SELECT COUNT(*) as count FROM events 
         WHERE discount_ids @> $1::jsonb`,
        [JSON.stringify([discountId])]
      );

      if (parseInt(eventCheck.rows[0].count, 10) > 0) {
        return true;
      }

      // Check if discount is referenced in event_activities table
      const activityCheck = await db.query(
        `SELECT COUNT(*) as count FROM event_activities 
         WHERE discount_ids @> $1::jsonb`,
        [JSON.stringify([discountId])]
      );

      return parseInt(activityCheck.rows[0].count, 10) > 0;
    } catch (error) {
      logger.error('Error checking if discount is in use:', error);
      throw error;
    }
  }

  /**
   * Update an existing discount
   */
  async update(
    id: string,
    organisationId: string,
    data: UpdateDiscountDto
  ): Promise<Discount | null> {
    try {
      // First check if discount exists and belongs to organization
      const existing = await this.getById(id, organisationId);
      if (!existing) {
        return null;
      }

      // Validate discount value if being updated
      if (data.discountValue !== undefined) {
        if (existing.discountType === 'percentage') {
          if (data.discountValue < 0 || data.discountValue > 100) {
            throw new Error('Percentage discount must be between 0 and 100');
          }
        } else {
          if (data.discountValue <= 0) {
            throw new Error('Fixed discount must be greater than 0');
          }
        }
      }

      // Validate code length if provided
      if (data.code && (data.code.length < 3 || data.code.length > 50)) {
        throw new Error('Discount code must be between 3 and 50 characters');
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.code !== undefined) {
        updates.push(`code = $${paramIndex++}`);
        values.push(data.code);
      }
      if (data.discountValue !== undefined) {
        updates.push(`discount_value = $${paramIndex++}`);
        values.push(data.discountValue);
      }
      if (data.quantityRules !== undefined) {
        updates.push(`quantity_rules = $${paramIndex++}`);
        values.push(JSON.stringify(data.quantityRules));
      }
      if (data.eligibilityCriteria !== undefined) {
        updates.push(`eligibility_criteria = $${paramIndex++}`);
        values.push(JSON.stringify(data.eligibilityCriteria));
      }
      if (data.validFrom !== undefined) {
        updates.push(`valid_from = $${paramIndex++}`);
        values.push(data.validFrom);
      }
      if (data.validUntil !== undefined) {
        updates.push(`valid_until = $${paramIndex++}`);
        values.push(data.validUntil);
      }
      if (data.usageLimits !== undefined) {
        // Preserve currentUsageCount
        const updatedLimits = {
          ...existing.usageLimits,
          ...data.usageLimits,
        };
        updates.push(`usage_limits = $${paramIndex++}`);
        values.push(JSON.stringify(updatedLimits));
      }
      if (data.combinable !== undefined) {
        updates.push(`combinable = $${paramIndex++}`);
        values.push(data.combinable);
      }
      if (data.priority !== undefined) {
        updates.push(`priority = $${paramIndex++}`);
        values.push(data.priority);
      }
      if (data.status !== undefined) {
        // Check if trying to deactivate a discount that's in use
        if (data.status === 'inactive' && existing.status === 'active') {
          const isInUse = await this.isDiscountInUse(id);
          if (isInUse) {
            throw new Error('Cannot deactivate discount that is currently in use by events or activities');
          }
        }
        updates.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }

      if (updates.length === 0) {
        return existing;
      }

      updates.push(`updated_at = NOW()`);
      values.push(id, organisationId);

      const result = await db.query(
        `UPDATE discounts
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND organisation_id = $${paramIndex++}
        RETURNING 
          id, organisation_id as "organisationId", module_type as "moduleType",
          name, description, code,
          discount_type as "discountType", discount_value as "discountValue",
          application_scope as "applicationScope", quantity_rules as "quantityRules",
          eligibility_criteria as "eligibilityCriteria",
          valid_from as "validFrom", valid_until as "validUntil",
          usage_limits as "usageLimits",
          combinable, priority, status,
          created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"`,
        values
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Updated discount: ${id}`);
      return this.mapRowToDiscount(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error('Discount code already exists in this organization');
      }
      logger.error('Error updating discount:', error);
      throw error;
    }
  }

  /**
   * Delete a discount (cascades to discount_applications)
   */
  /**
     * Delete a discount (checks for associations first)
     */
    async delete(id: string, organisationId: string): Promise<boolean> {
      try {
        // Check if discount is in use by events/activities
        const isInUse = await this.isDiscountInUse(id);
        if (isInUse) {
          throw new Error('Cannot delete discount that is currently in use by events or activities');
        }

        // Check if discount is in use by membership types
        const membershipTypeIds = await this.getMembershipTypesUsingDiscount(id, organisationId);
        if (membershipTypeIds.length > 0) {
          const error: any = new Error('Discount is in use');
          error.statusCode = 409;
          error.affectedCount = membershipTypeIds.length;
          error.discountId = id;
          throw error;
        }

        const result = await db.query(
          `DELETE FROM discounts
          WHERE id = $1 AND organisation_id = $2`,
          [id, organisationId]
        );

        const deleted = result.rowCount !== null && result.rowCount > 0;
        if (deleted) {
          logger.info(`Deleted discount: ${id}`);
        }
        return deleted;
      } catch (error) {
        logger.error('Error deleting discount:', error);
        throw error;
      }
    }

    /**
     * Force delete a discount (removes from all membership types first)
     */
    async forceDelete(id: string, organisationId: string): Promise<void> {
      const client = await db.getClient();
      try {
        await client.query('BEGIN');

        // Remove discount from all membership types
        await client.query(
          `UPDATE membership_types
          SET discount_ids = (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(discount_ids) elem
            WHERE elem::text != $1
          )
          WHERE organisation_id = $2
          AND discount_ids @> $3::jsonb`,
          [JSON.stringify(id), organisationId, JSON.stringify([id])]
        );

        // Delete the discount
        const result = await client.query(
          `DELETE FROM discounts
          WHERE id = $1 AND organisation_id = $2`,
          [id, organisationId]
        );

        if (result.rowCount === 0) {
          throw new Error('Discount not found');
        }

        await client.query('COMMIT');
        logger.info(`Force deleted discount: ${id}`);
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error force deleting discount:', error);
        throw error;
      } finally {
        client.release();
      }
    }



  /**
   * Apply discount to a target entity (event, activity, etc.)
   */
  async applyToTarget(
    discountId: string,
    targetType: string,
    targetId: string,
    appliedBy?: string
  ): Promise<void> {
    try {
      // Check if discount is active
      const discount = await db.query(
        `SELECT status FROM discounts WHERE id = $1`,
        [discountId]
      );

      if (discount.rows.length === 0) {
        throw new Error('Discount not found');
      }

      if (discount.rows[0].status !== 'active') {
        throw new Error('Cannot apply inactive discount');
      }

      await db.query(
        `INSERT INTO discount_applications (discount_id, target_type, target_id, applied_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (discount_id, target_type, target_id) DO NOTHING`,
        [discountId, targetType, targetId, appliedBy || null]
      );

      logger.info(`Applied discount ${discountId} to ${targetType}:${targetId}`);
    } catch (error) {
      logger.error('Error applying discount to target:', error);
      throw error;
    }
  }

  /**
   * Remove discount from a target entity
   */
  async removeFromTarget(
    discountId: string,
    targetType: string,
    targetId: string
  ): Promise<boolean> {
    try {
      const result = await db.query(
        `DELETE FROM discount_applications
        WHERE discount_id = $1 AND target_type = $2 AND target_id = $3`,
        [discountId, targetType, targetId]
      );

      const removed = result.rowCount !== null && result.rowCount > 0;
      if (removed) {
        logger.info(`Removed discount ${discountId} from ${targetType}:${targetId}`);
      }
      return removed;
    } catch (error) {
      logger.error('Error removing discount from target:', error);
      throw error;
    }
  }

  /**
   * Get all discounts applied to a target entity
   */
  async getForTarget(targetType: string, targetId: string): Promise<Discount[]> {
    try {
      const result = await db.query(
        `SELECT 
          d.id, d.organisation_id as "organisationId", d.module_type as "moduleType",
          d.name, d.description, d.code,
          d.discount_type as "discountType", d.discount_value as "discountValue",
          d.application_scope as "applicationScope", d.quantity_rules as "quantityRules",
          d.eligibility_criteria as "eligibilityCriteria",
          d.valid_from as "validFrom", d.valid_until as "validUntil",
          d.usage_limits as "usageLimits",
          d.combinable, d.priority, d.status,
          d.created_at as "createdAt", d.updated_at as "updatedAt", d.created_by as "createdBy"
        FROM discounts d
        INNER JOIN discount_applications da ON d.id = da.discount_id
        WHERE da.target_type = $1 AND da.target_id = $2
        ORDER BY d.priority DESC`,
        [targetType, targetId]
      );

      return result.rows.map(this.mapRowToDiscount);
    } catch (error) {
      logger.error('Error getting discounts for target:', error);
      throw error;
    }
  }

  /**
   * Record discount usage (atomic operation)
   */
  async recordUsage(
    discountId: string,
    userId: string,
    transactionType: string,
    transactionId: string,
    originalAmount: number,
    discountAmount: number,
    finalAmount: number
  ): Promise<void> {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert usage record
      await client.query(
        `INSERT INTO discount_usage (
          discount_id, user_id, transaction_type, transaction_id,
          original_amount, discount_amount, final_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [discountId, userId, transactionType, transactionId, originalAmount, discountAmount, finalAmount]
      );

      // Atomically increment usage counter
      await client.query(
        `UPDATE discounts
        SET usage_limits = jsonb_set(
          COALESCE(usage_limits, '{}'::jsonb),
          '{currentUsageCount}',
          (COALESCE((usage_limits->>'currentUsageCount')::int, 0) + 1)::text::jsonb
        )
        WHERE id = $1`,
        [discountId]
      );

      await client.query('COMMIT');
      logger.info(`Recorded usage for discount ${discountId} by user ${userId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error recording discount usage:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get usage statistics for a discount
   */
  async getUsageStats(discountId: string): Promise<any> {
    try {
      const result = await db.query(
        `SELECT 
          COUNT(*) as "totalUses",
          SUM(discount_amount) as "totalDiscountGiven",
          AVG(discount_amount) as "averageDiscountAmount"
        FROM discount_usage
        WHERE discount_id = $1`,
        [discountId]
      );

      const topUsersResult = await db.query(
        `SELECT 
          user_id as "userId",
          COUNT(*) as "usageCount",
          SUM(discount_amount) as "totalDiscountReceived"
        FROM discount_usage
        WHERE discount_id = $1
        GROUP BY user_id
        ORDER BY "usageCount" DESC
        LIMIT 10`,
        [discountId]
      );

      // Get discount to check remaining uses
      const discountResult = await db.query(
        `SELECT usage_limits FROM discounts WHERE id = $1`,
        [discountId]
      );

      const usageLimits = discountResult.rows[0]?.usage_limits;
      const totalUses = parseInt(result.rows[0].totalUses, 10);
      let remainingUses: number | undefined;

      if (usageLimits?.totalUsageLimit) {
        remainingUses = Math.max(0, usageLimits.totalUsageLimit - totalUses);
      }

      return {
        totalUses,
        remainingUses,
        totalDiscountGiven: parseFloat(result.rows[0].totalDiscountGiven || 0),
        averageDiscountAmount: parseFloat(result.rows[0].averageDiscountAmount || 0),
        topUsers: topUsersResult.rows.map((row) => ({
          userId: row.userId,
          usageCount: parseInt(row.usageCount, 10),
          totalDiscountReceived: parseFloat(row.totalDiscountReceived),
        })),
      };
    } catch (error) {
      logger.error('Error getting usage stats:', error);
      throw error;
    }
  }

  /**
   * Get user's usage count for a discount
   */
  async getUserUsageCount(discountId: string, userId: string): Promise<number> {
    try {
      const result = await db.query(
        `SELECT COUNT(*) as count
        FROM discount_usage
        WHERE discount_id = $1 AND user_id = $2`,
        [discountId, userId]
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error getting user usage count:', error);
      throw error;
    }
  }

  /**
   * Get all membership types that use a specific discount
   */
  async getMembershipTypesUsingDiscount(
    discountId: string,
    organisationId: string
  ): Promise<string[]> {
    try {
      const result = await db.query(
        `SELECT id FROM membership_types
         WHERE organisation_id = $1
         AND discount_ids @> $2::jsonb`,
        [organisationId, JSON.stringify([discountId])]
      );

      return result.rows.map((row) => row.id);
    } catch (error) {
      logger.error('Error getting membership types using discount:', error);
      throw error;
    }
  }

  async getRegistrationTypesUsingDiscount(
    discountId: string,
    organisationId: string
  ): Promise<string[]> {
    try {
      const result = await db.query(
        `SELECT id FROM registration_types
         WHERE organisation_id = $1
         AND discount_ids @> $2::jsonb`,
        [organisationId, JSON.stringify([discountId])]
      );

      return result.rows.map((row) => row.id);
    } catch (error) {
      logger.error('Error getting registration types using discount:', error);
      throw error;
    }
  }


}

export const discountService = new DiscountService();
