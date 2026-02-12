import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Delivery Rule interface
 */
export interface DeliveryRule {
  id: string;
  merchandiseTypeId: string;
  minQuantity: number;
  maxQuantity?: number;
  deliveryFee: number;
  order: number;
}

/**
 * DTO for creating delivery rule
 */
export interface CreateDeliveryRuleDto {
  merchandiseTypeId: string;
  minQuantity: number;
  maxQuantity?: number;
  deliveryFee: number;
  order: number;
}

/**
 * Service for managing delivery rules
 */
export class DeliveryRuleService {
  /**
   * Convert database row to DeliveryRule object
   */
  private rowToDeliveryRule(row: any): DeliveryRule {
    return {
      id: row.id,
      merchandiseTypeId: row.merchandise_type_id,
      minQuantity: row.min_quantity,
      maxQuantity: row.max_quantity,
      deliveryFee: parseFloat(row.delivery_fee),
      order: row.order,
    };
  }

  /**
   * Create delivery rule
   */
  async createDeliveryRule(data: CreateDeliveryRuleDto): Promise<DeliveryRule> {
    try {
      // Validate rule
      if (data.maxQuantity && data.minQuantity > data.maxQuantity) {
        throw new Error('Minimum quantity cannot be greater than maximum quantity');
      }

      // Check for overlapping rules
      await this.validateRules(data.merchandiseTypeId, data.minQuantity, data.maxQuantity);

      const result = await db.query(
        `INSERT INTO delivery_rules 
         (merchandise_type_id, min_quantity, max_quantity, delivery_fee, "order")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          data.merchandiseTypeId,
          data.minQuantity,
          data.maxQuantity || null,
          data.deliveryFee,
          data.order,
        ]
      );

      logger.info(`Delivery rule created: ${result.rows[0].id}`);
      return this.rowToDeliveryRule(result.rows[0]);
    } catch (error) {
      logger.error('Error creating delivery rule:', error);
      throw error;
    }
  }

  /**
   * Update delivery rule
   */
  async updateDeliveryRule(
    id: string,
    data: {
      minQuantity?: number;
      maxQuantity?: number;
      deliveryFee?: number;
      order?: number;
    }
  ): Promise<DeliveryRule> {
    try {
      // Get existing rule
      const existingResult = await db.query(
        'SELECT * FROM delivery_rules WHERE id = $1',
        [id]
      );

      if (existingResult.rows.length === 0) {
        throw new Error('Delivery rule not found');
      }

      const existing = this.rowToDeliveryRule(existingResult.rows[0]);

      // Validate updated rule
      const minQuantity = data.minQuantity !== undefined ? data.minQuantity : existing.minQuantity;
      const maxQuantity = data.maxQuantity !== undefined ? data.maxQuantity : existing.maxQuantity;

      if (maxQuantity && minQuantity > maxQuantity) {
        throw new Error('Minimum quantity cannot be greater than maximum quantity');
      }

      // Check for overlapping rules (excluding current rule)
      await this.validateRules(existing.merchandiseTypeId, minQuantity, maxQuantity, id);

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.minQuantity !== undefined) {
        updates.push(`min_quantity = $${paramCount++}`);
        values.push(data.minQuantity);
      }
      if (data.maxQuantity !== undefined) {
        updates.push(`max_quantity = $${paramCount++}`);
        values.push(data.maxQuantity || null);
      }
      if (data.deliveryFee !== undefined) {
        updates.push(`delivery_fee = $${paramCount++}`);
        values.push(data.deliveryFee);
      }
      if (data.order !== undefined) {
        updates.push(`"order" = $${paramCount++}`);
        values.push(data.order);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE delivery_rules 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      logger.info(`Delivery rule updated: ${id}`);
      return this.rowToDeliveryRule(result.rows[0]);
    } catch (error) {
      logger.error('Error updating delivery rule:', error);
      throw error;
    }
  }

  /**
   * Delete delivery rule
   */
  async deleteDeliveryRule(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM delivery_rules WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Delivery rule not found');
      }

      logger.info(`Delivery rule deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting delivery rule:', error);
      throw error;
    }
  }

  /**
   * Calculate delivery fee based on quantity
   */
  async calculateDeliveryFee(merchandiseTypeId: string, quantity: number): Promise<number> {
    try {
      const result = await db.query(
        `SELECT * FROM delivery_rules 
         WHERE merchandise_type_id = $1 
         ORDER BY "order"`,
        [merchandiseTypeId]
      );

      // Find applicable rule
      for (const row of result.rows) {
        const rule = this.rowToDeliveryRule(row);
        if (quantity >= rule.minQuantity && (!rule.maxQuantity || quantity <= rule.maxQuantity)) {
          return rule.deliveryFee;
        }
      }

      // No matching rule found
      return 0;
    } catch (error) {
      logger.error('Error calculating delivery fee:', error);
      throw error;
    }
  }

  /**
   * Validate rules for overlapping ranges
   */
  async validateRules(
    merchandiseTypeId: string,
    minQuantity: number,
    maxQuantity: number | undefined,
    excludeRuleId?: string
  ): Promise<void> {
    try {
      let query = `
        SELECT * FROM delivery_rules 
        WHERE merchandise_type_id = $1
      `;
      const values: any[] = [merchandiseTypeId];
      let paramCount = 2;

      if (excludeRuleId) {
        query += ` AND id != $${paramCount++}`;
        values.push(excludeRuleId);
      }

      const result = await db.query(query, values);

      for (const row of result.rows) {
        const existingRule = this.rowToDeliveryRule(row);

        // Check for overlap
        const newMin = minQuantity;
        const newMax = maxQuantity || Number.MAX_SAFE_INTEGER;
        const existingMin = existingRule.minQuantity;
        const existingMax = existingRule.maxQuantity || Number.MAX_SAFE_INTEGER;

        // Ranges overlap if:
        // - new range starts within existing range, OR
        // - new range ends within existing range, OR
        // - new range completely contains existing range
        const overlaps =
          (newMin >= existingMin && newMin <= existingMax) ||
          (newMax >= existingMin && newMax <= existingMax) ||
          (newMin <= existingMin && newMax >= existingMax);

        if (overlaps) {
          throw new Error(
            `Delivery rule overlaps with existing rule (${existingMin}-${
              existingRule.maxQuantity || '∞'
            })`
          );
        }
      }
    } catch (error) {
      logger.error('Error validating delivery rules:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const deliveryRuleService = new DeliveryRuleService();
