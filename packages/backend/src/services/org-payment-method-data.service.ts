import { db } from '../database/pool';
import { logger } from '../config/logger';
import { 
  OrgPaymentMethodData, 
  CreateOrgPaymentMethodDataDto, 
  UpdateOrgPaymentMethodDataDto,
  PaymentMethodStatus
} from '../types/payment-method.types';
import { paymentMethodService } from './payment-method.service';

export class OrgPaymentMethodDataService {
  /**
   * Convert database row to OrgPaymentMethodData object
   */
  private rowToOrgPaymentMethodData(row: any): OrgPaymentMethodData {
    return {
      id: row.id,
      organizationId: row.organization_id,
      paymentMethodId: row.payment_method_id,
      status: row.status as PaymentMethodStatus,
      paymentData: row.payment_data || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // paymentMethod will be populated separately if needed
    };
  }

  /**
   * Get all payment method data for an organization
   */
  async getOrgPaymentMethods(organizationId: string): Promise<OrgPaymentMethodData[]> {
    try {
      const result = await db.query(
        `SELECT opmd.*, pm.name, pm.display_name, pm.description, 
                pm.requires_activation, pm.is_active, pm.created_at as pm_created_at, 
                pm.updated_at as pm_updated_at
         FROM org_payment_method_data opmd
         JOIN payment_methods pm ON opmd.payment_method_id = pm.id
         WHERE opmd.organization_id = $1
         ORDER BY pm.display_name`,
        [organizationId]
      );

      return result.rows.map((row: any) => {
        const orgPaymentMethodData = this.rowToOrgPaymentMethodData(row);
        // Populate payment method details
        orgPaymentMethodData.paymentMethod = {
          id: row.payment_method_id,
          name: row.name,
          displayName: row.display_name,
          description: row.description,
          requiresActivation: row.requires_activation,
          isActive: row.is_active,
          createdAt: row.pm_created_at,
          updatedAt: row.pm_updated_at
        };
        return orgPaymentMethodData;
      });
    } catch (error) {
      logger.error('Error getting organization payment methods:', error);
      throw error;
    }
  }

  /**
   * Get specific payment method data for an organization
   */
  async getOrgPaymentMethod(
    organizationId: string, 
    paymentMethodId: string
  ): Promise<OrgPaymentMethodData | null> {
    try {
      const result = await db.query(
        `SELECT opmd.*, pm.name, pm.display_name, pm.description, 
                pm.requires_activation, pm.is_active, pm.created_at as pm_created_at, 
                pm.updated_at as pm_updated_at
         FROM org_payment_method_data opmd
         JOIN payment_methods pm ON opmd.payment_method_id = pm.id
         WHERE opmd.organization_id = $1 AND opmd.payment_method_id = $2`,
        [organizationId, paymentMethodId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const orgPaymentMethodData = this.rowToOrgPaymentMethodData(row);
      // Populate payment method details
      orgPaymentMethodData.paymentMethod = {
        id: row.payment_method_id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        requiresActivation: row.requires_activation,
        isActive: row.is_active,
        createdAt: row.pm_created_at,
        updatedAt: row.pm_updated_at
      };
      return orgPaymentMethodData;
    } catch (error) {
      logger.error('Error getting organization payment method:', error);
      throw error;
    }
  }

  /**
   * Associate payment method with organization
   * Creates association with proper status initialization based on activation requirements
   */
  async createOrgPaymentMethod(
    data: CreateOrgPaymentMethodDataDto
  ): Promise<OrgPaymentMethodData> {
    try {
      // Get payment method to determine initial status
      const paymentMethod = await paymentMethodService.getPaymentMethodById(data.paymentMethodId);
      
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Determine initial status based on activation requirements
      let initialStatus: PaymentMethodStatus = data.status || 
        (paymentMethod.requiresActivation ? 'inactive' : 'active');

      const paymentData = data.paymentData || {};

      const result = await db.query(
        `INSERT INTO org_payment_method_data 
         (organization_id, payment_method_id, status, payment_data)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.organizationId, data.paymentMethodId, initialStatus, JSON.stringify(paymentData)]
      );

      logger.info(`Payment method ${data.paymentMethodId} associated with organization ${data.organizationId}`);
      
      return this.rowToOrgPaymentMethodData(result.rows[0]);
    } catch (error: any) {
      // Handle duplicate association error
      if (error.code === '23505') {
        logger.error(`Duplicate payment method association: org=${data.organizationId}, method=${data.paymentMethodId}`);
        throw new Error('Payment method already associated with organization');
      }
      // Handle foreign key violations
      if (error.code === '23503') {
        if (error.constraint?.includes('organization_id')) {
          logger.error(`Invalid organization ID: ${data.organizationId}`);
          throw new Error('Organization not found');
        }
        if (error.constraint?.includes('payment_method_id')) {
          logger.error(`Invalid payment method ID: ${data.paymentMethodId}`);
          throw new Error('Payment method not found');
        }
      }
      logger.error('Error creating organization payment method association:', error);
      throw error;
    }
  }

  /**
   * Update organization payment method data
   */
  async updateOrgPaymentMethod(
    organizationId: string,
    paymentMethodId: string,
    data: UpdateOrgPaymentMethodDataDto
  ): Promise<OrgPaymentMethodData> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.paymentData !== undefined) {
        updates.push(`payment_data = $${paramCount++}`);
        values.push(JSON.stringify(data.paymentData));
      }

      // Always update updated_at
      updates.push(`updated_at = NOW()`);

      values.push(organizationId, paymentMethodId);

      const result = await db.query(
        `UPDATE org_payment_method_data 
         SET ${updates.join(', ')}
         WHERE organization_id = $${paramCount++} AND payment_method_id = $${paramCount++}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Organization payment method association not found');
      }

      logger.info(`Payment method ${paymentMethodId} updated for organization ${organizationId}`);
      
      return this.rowToOrgPaymentMethodData(result.rows[0]);
    } catch (error) {
      logger.error('Error updating organization payment method:', error);
      throw error;
    }
  }

  /**
   * Remove payment method from organization
   */
  async deleteOrgPaymentMethod(
    organizationId: string, 
    paymentMethodId: string
  ): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM org_payment_method_data WHERE organization_id = $1 AND payment_method_id = $2 RETURNING id',
        [organizationId, paymentMethodId]
      );

      if (result.rows.length === 0) {
        throw new Error('Organization payment method association not found');
      }

      logger.info(`Payment method ${paymentMethodId} removed from organization ${organizationId}`);
    } catch (error) {
      logger.error('Error deleting organization payment method:', error);
      throw error;
    }
  }

  /**
   * Sync organization payment methods based on selected names
   * - Adds new associations for selected methods not currently associated
   * - Removes associations for methods no longer selected
   * - Preserves existing associations that remain selected
   * Uses database transaction for atomicity
   */
  async syncOrgPaymentMethods(
    organizationId: string,
    paymentMethodNames: string[]
  ): Promise<void> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Get payment methods by names
      const methodsResult = await client.query(
        'SELECT id, name, requires_activation FROM payment_methods WHERE name = ANY($1) AND is_active = true',
        [paymentMethodNames]
      );

      const selectedMethods = methodsResult.rows;
      const selectedMethodIds = selectedMethods.map((m: any) => m.id);

      // Get existing associations
      const existingResult = await client.query(
        'SELECT payment_method_id FROM org_payment_method_data WHERE organization_id = $1',
        [organizationId]
      );

      const existingMethodIds = existingResult.rows.map((r: any) => r.payment_method_id);

      // Determine which methods to add and remove
      const methodsToAdd = selectedMethods.filter((m: any) => !existingMethodIds.includes(m.id));
      const methodIdsToRemove = existingMethodIds.filter((id: string) => !selectedMethodIds.includes(id));

      // Add new associations
      for (const method of methodsToAdd) {
        const initialStatus = method.requires_activation ? 'inactive' : 'active';
        await client.query(
          `INSERT INTO org_payment_method_data 
           (organization_id, payment_method_id, status, payment_data)
           VALUES ($1, $2, $3, $4)`,
          [organizationId, method.id, initialStatus, JSON.stringify({})]
        );
        logger.info(`Added payment method ${method.name} to organization ${organizationId}`);
      }

      // Remove deselected associations
      if (methodIdsToRemove.length > 0) {
        await client.query(
          'DELETE FROM org_payment_method_data WHERE organization_id = $1 AND payment_method_id = ANY($2)',
          [organizationId, methodIdsToRemove]
        );
        logger.info(`Removed ${methodIdsToRemove.length} payment methods from organization ${organizationId}`);
      }

      await client.query('COMMIT');
      logger.info(`Synced payment methods for organization ${organizationId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error syncing organization payment methods:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize default payment methods for new organization
   * - Adds "pay-offline" with status='active' and empty payment_data
   * - Handles case where pay-offline doesn't exist (log warning)
   */
  async initializeDefaultPaymentMethods(organizationId: string): Promise<void> {
    try {
      // Query "pay-offline" payment method by name
      const payOfflineMethod = await paymentMethodService.getPaymentMethodByName('pay-offline');
      
      if (!payOfflineMethod) {
        logger.warn('pay-offline payment method not found, skipping default initialization');
        return;
      }

      // Create association with status='active' and payment_data={}
      await db.query(
        `INSERT INTO org_payment_method_data 
         (organization_id, payment_method_id, status, payment_data)
         VALUES ($1, $2, $3, $4)`,
        [organizationId, payOfflineMethod.id, 'active', JSON.stringify({})]
      );

      logger.info(`Initialized default payment method (pay-offline) for organization ${organizationId}`);
    } catch (error: any) {
      // If duplicate, it's okay - method already exists
      if (error.code === '23505') {
        logger.debug(`pay-offline already associated with organization ${organizationId}`);
        return;
      }
      logger.error('Error initializing default payment methods:', error);
      throw error;
    }
  }
}

export const orgPaymentMethodDataService = new OrgPaymentMethodDataService();
