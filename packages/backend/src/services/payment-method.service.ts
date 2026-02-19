import { db } from '../database/pool';
import { logger } from '../config/logger';
import { 
  PaymentMethod, 
  CreatePaymentMethodDto, 
  UpdatePaymentMethodDto 
} from '../types/payment-method.types';
import cacheService from './cache.service';

export class PaymentMethodService {
  private readonly CACHE_TTL = 600000; // 10 minutes (payment methods change rarely)
  
  /**
   * Convert database row to PaymentMethod object
   */
  private rowToPaymentMethod(row: any): PaymentMethod {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      requiresActivation: row.requires_activation,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get all active payment methods
   */
  async getAllPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      // Check cache first
      const cacheKey = 'payment_methods:all:active';
      const cached = cacheService.get<PaymentMethod[]>(cacheKey);
      if (cached) {
        logger.debug('Cache hit for active payment methods');
        return cached;
      }

      const result = await db.query(
        'SELECT * FROM payment_methods WHERE is_active = true ORDER BY display_name',
        []
      );

      const paymentMethods = result.rows.map((row: any) => this.rowToPaymentMethod(row));

      // Cache the result
      cacheService.set(cacheKey, paymentMethods, this.CACHE_TTL);

      return paymentMethods;
    } catch (error) {
      logger.error('Error getting payment methods:', error);
      throw error;
    }
  }

  /**
   * Get payment method by ID
   */
  async getPaymentMethodById(id: string): Promise<PaymentMethod | null> {
    try {
      const result = await db.query(
        'SELECT * FROM payment_methods WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToPaymentMethod(result.rows[0]);
    } catch (error) {
      logger.error('Error getting payment method by ID:', error);
      throw error;
    }
  }

  /**
   * Get payment method by name
   */
  async getPaymentMethodByName(name: string): Promise<PaymentMethod | null> {
    try {
      const result = await db.query(
        'SELECT * FROM payment_methods WHERE name = $1',
        [name]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToPaymentMethod(result.rows[0]);
    } catch (error) {
      logger.error('Error getting payment method by name:', error);
      throw error;
    }
  }

  /**
   * Create payment method (super admin only)
   */
  async createPaymentMethod(data: CreatePaymentMethodDto): Promise<PaymentMethod> {
    try {
      const result = await db.query(
        `INSERT INTO payment_methods (name, display_name, description, requires_activation)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.name, data.displayName, data.description, data.requiresActivation]
      );

      logger.info(`Payment method created: ${data.name}`);
      
      // Invalidate cache
      cacheService.delete('payment_methods:all:active');
      
      return this.rowToPaymentMethod(result.rows[0]);
    } catch (error: any) {
      // Handle duplicate name error
      if (error.code === '23505') {
        logger.error(`Duplicate payment method name: ${data.name}`);
        throw new Error('Payment method with this name already exists');
      }
      logger.error('Error creating payment method:', error);
      throw error;
    }
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(id: string, data: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.displayName !== undefined) {
        updates.push(`display_name = $${paramCount++}`);
        values.push(data.displayName);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }
      if (data.requiresActivation !== undefined) {
        updates.push(`requires_activation = $${paramCount++}`);
        values.push(data.requiresActivation);
      }
      if (data.isActive !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(data.isActive);
      }

      // Always update updated_at
      updates.push(`updated_at = NOW()`);

      values.push(id);

      const result = await db.query(
        `UPDATE payment_methods 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Payment method not found');
      }

      logger.info(`Payment method updated: ${id}`);
      
      // Invalidate cache
      cacheService.delete('payment_methods:all:active');
      
      return this.rowToPaymentMethod(result.rows[0]);
    } catch (error) {
      logger.error('Error updating payment method:', error);
      throw error;
    }
  }

  /**
   * Deactivate payment method
   */
  async deactivatePaymentMethod(id: string): Promise<void> {
    try {
      const result = await db.query(
        'UPDATE payment_methods SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Payment method not found');
      }

      logger.info(`Payment method deactivated: ${id}`);
      
      // Invalidate cache
      cacheService.delete('payment_methods:all:active');
    } catch (error) {
      logger.error('Error deactivating payment method:', error);
      throw error;
    }
  }

  /**
   * Validate payment method names exist and are active
   */
  async validatePaymentMethods(names: string[]): Promise<boolean> {
    try {
      if (names.length === 0) {
        return true;
      }

      const result = await db.query(
        'SELECT COUNT(*) as count FROM payment_methods WHERE name = ANY($1) AND is_active = true',
        [names]
      );

      return parseInt(result.rows[0].count) === names.length;
    } catch (error) {
      logger.error('Error validating payment methods:', error);
      throw error;
    }
  }
}

export const paymentMethodService = new PaymentMethodService();
