import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Event Activity interface
 */
export interface EventActivity {
  id: string;
  eventId: string;
  name: string;
  description: string;
  showPublicly: boolean;
  applicationFormId?: string;
  limitApplicants: boolean;
  applicantsLimit?: number;
  allowSpecifyQuantity: boolean;
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  fee: number;
  supportedPaymentMethods: string[];
  handlingFeeIncluded: boolean;
  chequePaymentInstructions?: string;
  discountIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating an event activity
 */
export interface CreateEventActivityDto {
  eventId: string;
  name: string;
  description: string;
  showPublicly?: boolean;
  applicationFormId?: string;
  limitApplicants?: boolean;
  applicantsLimit?: number;
  allowSpecifyQuantity?: boolean;
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  fee?: number;
  supportedPaymentMethods?: string[];
  handlingFeeIncluded?: boolean;
  chequePaymentInstructions?: string;
  discountIds?: string[];
}

/**
 * Service for managing event activities
 */
export class EventActivityService {
  /**
   * Convert database row to EventActivity object
   */
  private rowToActivity(row: any): EventActivity {
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
      supportedPaymentMethods: row.supported_payment_methods || [],
      handlingFeeIncluded: row.handling_fee_included,
      chequePaymentInstructions: row.cheque_payment_instructions,
      discountIds: row.discount_ids ? 
        (Array.isArray(row.discount_ids) ? row.discount_ids : JSON.parse(row.discount_ids)) 
        : [],
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

      return result.rows.map(row => this.rowToActivity(row));
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

      return this.rowToActivity(result.rows[0]);
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
      const result = await db.query(
        `INSERT INTO event_activities 
         (event_id, name, description, show_publicly, application_form_id,
          limit_applicants, applicants_limit, allow_specify_quantity,
          use_terms_and_conditions, terms_and_conditions, fee,
          supported_payment_methods, handling_fee_included, cheque_payment_instructions, discount_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          data.eventId,
          data.name,
          data.description,
          data.showPublicly !== undefined ? data.showPublicly : true,
          data.applicationFormId || null,
          data.limitApplicants || false,
          data.applicantsLimit || null,
          data.allowSpecifyQuantity || false,
          data.useTermsAndConditions || false,
          data.termsAndConditions || null,
          data.fee || 0,
          JSON.stringify(data.supportedPaymentMethods || []),
          data.handlingFeeIncluded || false,
          data.chequePaymentInstructions || null,
          JSON.stringify(data.discountIds || []),
        ]
      );

      logger.info(`Event activity created: ${data.name} for event ${data.eventId}`);
      return this.rowToActivity(result.rows[0]);
    } catch (error) {
      logger.error('Error creating event activity:', error);
      throw error;
    }
  }

  /**
   * Update an event activity
   */
  async updateActivity(id: string, data: Partial<CreateEventActivityDto>): Promise<EventActivity> {
      try {
        const updates: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let paramCount = 1;

        if (data.name !== undefined) {
          updates.push(`name = $${paramCount++}`);
          values.push(data.name);
        }
        if (data.description !== undefined) {
          updates.push(`description = $${paramCount++}`);
          values.push(data.description);
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
        if (data.supportedPaymentMethods !== undefined) {
          updates.push(`supported_payment_methods = $${paramCount++}`);
          values.push(JSON.stringify(data.supportedPaymentMethods));
        }
        if (data.handlingFeeIncluded !== undefined) {
          updates.push(`handling_fee_included = $${paramCount++}`);
          values.push(data.handlingFeeIncluded);
        }
        if (data.chequePaymentInstructions !== undefined) {
          updates.push(`cheque_payment_instructions = $${paramCount++}`);
          values.push(data.chequePaymentInstructions || null);
        }
        if (data.discountIds !== undefined) {
          updates.push(`discount_ids = $${paramCount++}`);
          values.push(JSON.stringify(data.discountIds));
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
        return this.rowToActivity(result.rows[0]);
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

  /**
   * Delete all activities for an event
   */
  async deleteActivitiesByEvent(eventId: string): Promise<void> {
    try {
      await db.query(
        'DELETE FROM event_activities WHERE event_id = $1',
        [eventId]
      );

      logger.info(`All activities deleted for event: ${eventId}`);
    } catch (error) {
      logger.error('Error deleting activities by event:', error);
      throw error;
    }
  }

  /**
   * Replace all activities for an event (used during event update)
   */
  async replaceActivitiesForEvent(eventId: string, activities: CreateEventActivityDto[]): Promise<EventActivity[]> {
    try {
      // Delete existing activities
      await this.deleteActivitiesByEvent(eventId);

      // Create new activities
      const createdActivities: EventActivity[] = [];
      for (const activity of activities) {
        const created = await this.createActivity({ ...activity, eventId });
        createdActivities.push(created);
      }

      return createdActivities;
    } catch (error) {
      logger.error('Error replacing activities for event:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const eventActivityService = new EventActivityService();
