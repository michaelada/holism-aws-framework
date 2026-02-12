import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * EventActivity interface matching database schema
 */
export interface EventActivity {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  showPublicly: boolean;
  applicationFormId?: string;
  limitApplicants: boolean;
  applicantsLimit?: number;
  allowSpecifyQuantity: boolean;
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  fee: number;
  allowedPaymentMethod?: 'card' | 'cheque' | 'both';
  handlingFeeIncluded: boolean;
  chequePaymentInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating an event activity
 */
export interface CreateEventActivityDto {
  eventId: string;
  name: string;
  description?: string;
  showPublicly?: boolean;
  applicationFormId?: string;
  limitApplicants?: boolean;
  applicantsLimit?: number;
  allowSpecifyQuantity?: boolean;
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  fee?: number;
  allowedPaymentMethod?: 'card' | 'cheque' | 'both';
  handlingFeeIncluded?: boolean;
  chequePaymentInstructions?: string;
}

/**
 * DTO for updating an event activity
 */
export interface UpdateEventActivityDto {
  name?: string;
  description?: string;
  showPublicly?: boolean;
  applicationFormId?: string;
  limitApplicants?: boolean;
  applicantsLimit?: number;
  allowSpecifyQuantity?: boolean;
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  fee?: number;
  allowedPaymentMethod?: 'card' | 'cheque' | 'both';
  handlingFeeIncluded?: boolean;
  chequePaymentInstructions?: string;
}

/**
 * Service for managing event activities
 */
export class EventActivityService {
  /**
   * Convert database row to EventActivity object
   */
  private rowToEventActivity(row: any): EventActivity {
    return {
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      description: row.description,
      showPublicly: row.show_publicly,
      applicationFormId: row.application_form_id,
      limitApplicants: row.limit_applicants,
      applicantsLimit: row.applicants_limit,
      allowSpecifyQuantity: row.allow_specify_quantity,
      useTermsAndConditions: row.use_terms_and_conditions,
      termsAndConditions: row.terms_and_conditions,
      fee: parseFloat(row.fee),
      allowedPaymentMethod: row.allowed_payment_method,
      handlingFeeIncluded: row.handling_fee_included,
      chequePaymentInstructions: row.cheque_payment_instructions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all activities for an event
   */
  async getActivitiesByEvent(eventId: string): Promise<EventActivity[]> {
    try {
      const result = await db.query(
        `SELECT * FROM event_activities 
         WHERE event_id = $1 
         ORDER BY created_at ASC`,
        [eventId]
      );

      return result.rows.map(row => this.rowToEventActivity(row));
    } catch (error) {
      logger.error('Error getting activities by event:', error);
      throw error;
    }
  }

  /**
   * Get activity by ID
   */
  async getActivityById(id: string): Promise<EventActivity | null> {
    try {
      const result = await db.query(
        'SELECT * FROM event_activities WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToEventActivity(result.rows[0]);
    } catch (error) {
      logger.error('Error getting activity by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new event activity
   */
  async createActivity(data: CreateEventActivityDto): Promise<EventActivity> {
    try {
      // Validate applicants limit
      if (data.limitApplicants && (!data.applicantsLimit || data.applicantsLimit <= 0)) {
        throw new Error('Applicants limit must be greater than 0 when limit is enabled');
      }

      // Validate terms and conditions
      if (data.useTermsAndConditions && !data.termsAndConditions) {
        throw new Error('Terms and conditions are required when use terms and conditions is enabled');
      }

      // Validate payment method for paid activities
      const fee = data.fee || 0;
      if (fee > 0 && !data.allowedPaymentMethod) {
        throw new Error('Payment method is required for paid activities');
      }

      // Validate cheque instructions
      if (data.allowedPaymentMethod && 
          (data.allowedPaymentMethod === 'cheque' || data.allowedPaymentMethod === 'both') &&
          !data.chequePaymentInstructions) {
        throw new Error('Cheque payment instructions are required when cheque payment is allowed');
      }

      const result = await db.query(
        `INSERT INTO event_activities 
         (event_id, name, description, show_publicly, application_form_id,
          limit_applicants, applicants_limit, allow_specify_quantity,
          use_terms_and_conditions, terms_and_conditions, fee,
          allowed_payment_method, handling_fee_included, cheque_payment_instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          data.eventId,
          data.name,
          data.description || null,
          data.showPublicly !== undefined ? data.showPublicly : true,
          data.applicationFormId || null,
          data.limitApplicants || false,
          data.applicantsLimit || null,
          data.allowSpecifyQuantity || false,
          data.useTermsAndConditions || false,
          data.termsAndConditions || null,
          fee,
          data.allowedPaymentMethod || null,
          data.handlingFeeIncluded || false,
          data.chequePaymentInstructions || null,
        ]
      );

      logger.info(`Event activity created: ${data.name} (${result.rows[0].id})`);
      return this.rowToEventActivity(result.rows[0]);
    } catch (error) {
      logger.error('Error creating event activity:', error);
      throw error;
    }
  }

  /**
   * Update an event activity
   */
  async updateActivity(id: string, data: UpdateEventActivityDto): Promise<EventActivity> {
    try {
      // Get existing activity
      const existing = await this.getActivityById(id);
      if (!existing) {
        throw new Error('Event activity not found');
      }

      // Validate applicants limit
      const limitApplicants = data.limitApplicants !== undefined ? data.limitApplicants : existing.limitApplicants;
      const applicantsLimit = data.applicantsLimit !== undefined ? data.applicantsLimit : existing.applicantsLimit;
      if (limitApplicants && (!applicantsLimit || applicantsLimit <= 0)) {
        throw new Error('Applicants limit must be greater than 0 when limit is enabled');
      }

      // Validate terms and conditions
      const useTermsAndConditions = data.useTermsAndConditions !== undefined 
        ? data.useTermsAndConditions 
        : existing.useTermsAndConditions;
      const termsAndConditions = data.termsAndConditions !== undefined 
        ? data.termsAndConditions 
        : existing.termsAndConditions;
      if (useTermsAndConditions && !termsAndConditions) {
        throw new Error('Terms and conditions are required when use terms and conditions is enabled');
      }

      // Validate payment method for paid activities
      const fee = data.fee !== undefined ? data.fee : existing.fee;
      const allowedPaymentMethod = data.allowedPaymentMethod !== undefined 
        ? data.allowedPaymentMethod 
        : existing.allowedPaymentMethod;
      if (fee > 0 && !allowedPaymentMethod) {
        throw new Error('Payment method is required for paid activities');
      }

      // Validate cheque instructions
      const chequePaymentInstructions = data.chequePaymentInstructions !== undefined 
        ? data.chequePaymentInstructions 
        : existing.chequePaymentInstructions;
      if (allowedPaymentMethod && 
          (allowedPaymentMethod === 'cheque' || allowedPaymentMethod === 'both') &&
          !chequePaymentInstructions) {
        throw new Error('Cheque payment instructions are required when cheque payment is allowed');
      }

      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description || null);
      }
      if (data.showPublicly !== undefined) {
        updates.push(`show_publicly = $${paramCount++}`);
        values.push(data.showPublicly);
      }
      if (data.applicationFormId !== undefined) {
        updates.push(`application_form_id = $${paramCount++}`);
        values.push(data.applicationFormId || null);
      }
      if (data.limitApplicants !== undefined) {
        updates.push(`limit_applicants = $${paramCount++}`);
        values.push(data.limitApplicants);
      }
      if (data.applicantsLimit !== undefined) {
        updates.push(`applicants_limit = $${paramCount++}`);
        values.push(data.applicantsLimit || null);
      }
      if (data.allowSpecifyQuantity !== undefined) {
        updates.push(`allow_specify_quantity = $${paramCount++}`);
        values.push(data.allowSpecifyQuantity);
      }
      if (data.useTermsAndConditions !== undefined) {
        updates.push(`use_terms_and_conditions = $${paramCount++}`);
        values.push(data.useTermsAndConditions);
      }
      if (data.termsAndConditions !== undefined) {
        updates.push(`terms_and_conditions = $${paramCount++}`);
        values.push(data.termsAndConditions || null);
      }
      if (data.fee !== undefined) {
        updates.push(`fee = $${paramCount++}`);
        values.push(data.fee);
      }
      if (data.allowedPaymentMethod !== undefined) {
        updates.push(`allowed_payment_method = $${paramCount++}`);
        values.push(data.allowedPaymentMethod || null);
      }
      if (data.handlingFeeIncluded !== undefined) {
        updates.push(`handling_fee_included = $${paramCount++}`);
        values.push(data.handlingFeeIncluded);
      }
      if (data.chequePaymentInstructions !== undefined) {
        updates.push(`cheque_payment_instructions = $${paramCount++}`);
        values.push(data.chequePaymentInstructions || null);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE event_activities 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Event activity not found');
      }

      logger.info(`Event activity updated: ${id}`);
      return this.rowToEventActivity(result.rows[0]);
    } catch (error) {
      logger.error('Error updating event activity:', error);
      throw error;
    }
  }

  /**
   * Delete an event activity
   */
  async deleteActivity(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM event_activities WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Event activity not found');
      }

      logger.info(`Event activity deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting event activity:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const eventActivityService = new EventActivityService();
