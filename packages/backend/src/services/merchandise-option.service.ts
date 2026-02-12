import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Merchandise Option Type interface
 */
export interface MerchandiseOptionType {
  id: string;
  merchandiseTypeId: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Merchandise Option Value interface
 */
export interface MerchandiseOptionValue {
  id: string;
  optionTypeId: string;
  name: string;
  price: number;
  sku?: string;
  stockQuantity?: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating option type
 */
export interface CreateOptionTypeDto {
  merchandiseTypeId: string;
  name: string;
  order: number;
}

/**
 * DTO for creating option value
 */
export interface CreateOptionValueDto {
  optionTypeId: string;
  name: string;
  price: number;
  sku?: string;
  stockQuantity?: number;
  order: number;
}

/**
 * Option combination interface
 */
export interface OptionCombination {
  options: Record<string, { id: string; name: string }>;
  totalPrice: number;
}

/**
 * Service for managing merchandise options
 */
export class MerchandiseOptionService {
  /**
   * Convert database row to OptionType object
   */
  private rowToOptionType(row: any): MerchandiseOptionType {
    return {
      id: row.id,
      merchandiseTypeId: row.merchandise_type_id,
      name: row.name,
      order: row.order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to OptionValue object
   */
  private rowToOptionValue(row: any): MerchandiseOptionValue {
    return {
      id: row.id,
      optionTypeId: row.option_type_id,
      name: row.name,
      price: parseFloat(row.price),
      sku: row.sku,
      stockQuantity: row.stock_quantity,
      order: row.order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Create option type
   */
  async createOptionType(data: CreateOptionTypeDto): Promise<MerchandiseOptionType> {
    try {
      const result = await db.query(
        `INSERT INTO merchandise_option_types 
         (merchandise_type_id, name, "order")
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.merchandiseTypeId, data.name, data.order]
      );

      logger.info(`Option type created: ${data.name} (${result.rows[0].id})`);
      return this.rowToOptionType(result.rows[0]);
    } catch (error) {
      logger.error('Error creating option type:', error);
      throw error;
    }
  }

  /**
   * Update option type
   */
  async updateOptionType(
    id: string,
    data: { name?: string; order?: number }
  ): Promise<MerchandiseOptionType> {
    try {
      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.order !== undefined) {
        updates.push(`"order" = $${paramCount++}`);
        values.push(data.order);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE merchandise_option_types 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Option type not found');
      }

      logger.info(`Option type updated: ${id}`);
      return this.rowToOptionType(result.rows[0]);
    } catch (error) {
      logger.error('Error updating option type:', error);
      throw error;
    }
  }

  /**
   * Delete option type
   */
  async deleteOptionType(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM merchandise_option_types WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Option type not found');
      }

      logger.info(`Option type deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting option type:', error);
      throw error;
    }
  }

  /**
   * Create option value
   */
  async createOptionValue(data: CreateOptionValueDto): Promise<MerchandiseOptionValue> {
    try {
      const result = await db.query(
        `INSERT INTO merchandise_option_values 
         (option_type_id, name, price, sku, stock_quantity, "order")
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.optionTypeId,
          data.name,
          data.price,
          data.sku || null,
          data.stockQuantity || null,
          data.order,
        ]
      );

      logger.info(`Option value created: ${data.name} (${result.rows[0].id})`);
      return this.rowToOptionValue(result.rows[0]);
    } catch (error) {
      logger.error('Error creating option value:', error);
      throw error;
    }
  }

  /**
   * Update option value
   */
  async updateOptionValue(
    id: string,
    data: {
      name?: string;
      price?: number;
      sku?: string;
      stockQuantity?: number;
      order?: number;
    }
  ): Promise<MerchandiseOptionValue> {
    try {
      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.price !== undefined) {
        updates.push(`price = $${paramCount++}`);
        values.push(data.price);
      }
      if (data.sku !== undefined) {
        updates.push(`sku = $${paramCount++}`);
        values.push(data.sku || null);
      }
      if (data.stockQuantity !== undefined) {
        updates.push(`stock_quantity = $${paramCount++}`);
        values.push(data.stockQuantity || null);
      }
      if (data.order !== undefined) {
        updates.push(`"order" = $${paramCount++}`);
        values.push(data.order);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE merchandise_option_values 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Option value not found');
      }

      logger.info(`Option value updated: ${id}`);
      return this.rowToOptionValue(result.rows[0]);
    } catch (error) {
      logger.error('Error updating option value:', error);
      throw error;
    }
  }

  /**
   * Delete option value
   */
  async deleteOptionValue(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM merchandise_option_values WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Option value not found');
      }

      logger.info(`Option value deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting option value:', error);
      throw error;
    }
  }

  /**
   * Reorder option types
   */
  async reorderOptionTypes(merchandiseTypeId: string, orderedIds: string[]): Promise<void> {
    try {
      // Update order for each option type
      for (let i = 0; i < orderedIds.length; i++) {
        await db.query(
          `UPDATE merchandise_option_types 
           SET "order" = $1, updated_at = NOW()
           WHERE id = $2 AND merchandise_type_id = $3`,
          [i, orderedIds[i], merchandiseTypeId]
        );
      }

      logger.info(`Option types reordered for merchandise type: ${merchandiseTypeId}`);
    } catch (error) {
      logger.error('Error reordering option types:', error);
      throw error;
    }
  }

  /**
   * Reorder option values
   */
  async reorderOptionValues(optionTypeId: string, orderedIds: string[]): Promise<void> {
    try {
      // Update order for each option value
      for (let i = 0; i < orderedIds.length; i++) {
        await db.query(
          `UPDATE merchandise_option_values 
           SET "order" = $1, updated_at = NOW()
           WHERE id = $2 AND option_type_id = $3`,
          [i, orderedIds[i], optionTypeId]
        );
      }

      logger.info(`Option values reordered for option type: ${optionTypeId}`);
    } catch (error) {
      logger.error('Error reordering option values:', error);
      throw error;
    }
  }

  /**
   * Get all option combinations for a merchandise type
   */
  async getAllCombinations(merchandiseTypeId: string): Promise<OptionCombination[]> {
    try {
      // Get all option types and their values
      const optionTypesResult = await db.query(
        `SELECT * FROM merchandise_option_types 
         WHERE merchandise_type_id = $1 
         ORDER BY "order"`,
        [merchandiseTypeId]
      );

      if (optionTypesResult.rows.length === 0) {
        return [];
      }

      const optionTypes = optionTypesResult.rows.map(row => this.rowToOptionType(row));

      // Get all option values for each type
      const optionTypeIds = optionTypes.map(ot => ot.id);
      const optionValuesResult = await db.query(
        `SELECT * FROM merchandise_option_values 
         WHERE option_type_id = ANY($1) 
         ORDER BY option_type_id, "order"`,
        [optionTypeIds]
      );

      const optionValues = optionValuesResult.rows.map(row => this.rowToOptionValue(row));

      // Group values by option type
      const valuesByType = new Map<string, MerchandiseOptionValue[]>();
      optionValues.forEach(value => {
        if (!valuesByType.has(value.optionTypeId)) {
          valuesByType.set(value.optionTypeId, []);
        }
        valuesByType.get(value.optionTypeId)!.push(value);
      });

      // Generate all combinations
      const combinations: OptionCombination[] = [];

      const generateCombinations = (
        typeIndex: number,
        currentCombination: Record<string, { id: string; name: string }>,
        currentPrice: number
      ) => {
        if (typeIndex >= optionTypes.length) {
          combinations.push({
            options: { ...currentCombination },
            totalPrice: currentPrice,
          });
          return;
        }

        const currentType = optionTypes[typeIndex];
        const values = valuesByType.get(currentType.id) || [];

        for (const value of values) {
          generateCombinations(
            typeIndex + 1,
            {
              ...currentCombination,
              [currentType.name]: { id: value.id, name: value.name },
            },
            currentPrice + value.price
          );
        }
      };

      generateCombinations(0, {}, 0);

      logger.info(`Generated ${combinations.length} combinations for merchandise type: ${merchandiseTypeId}`);
      return combinations;
    } catch (error) {
      logger.error('Error getting all combinations:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const merchandiseOptionService = new MerchandiseOptionService();
