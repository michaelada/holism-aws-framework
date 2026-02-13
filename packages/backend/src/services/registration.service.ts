import { db } from '../database/pool';
import { logger } from '../config/logger';
import ExcelJS from 'exceljs';

/**
 * RegistrationType interface matching database schema
 */
export interface RegistrationType {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  entityName: string;
  registrationFormId: string;
  registrationStatus: 'open' | 'closed';
  isRollingRegistration: boolean;
  validUntil?: Date;
  numberOfMonths?: number;
  automaticallyApprove: boolean;
  registrationLabels: string[];
  supportedPaymentMethods: string[];
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Registration interface matching database schema
 */
export interface Registration {
  id: string;
  organisationId: string;
  registrationTypeId: string;
  userId: string;
  registrationNumber: string;
  entityName: string;
  ownerName: string;
  formSubmissionId: string;
  dateLastRenewed: Date;
  status: 'active' | 'pending' | 'elapsed';
  validUntil: Date;
  labels: string[];
  processed: boolean;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RegistrationFilter interface matching database schema
 */
export interface RegistrationFilter {
  id: string;
  organisationId: string;
  userId: string;
  name: string;
  registrationStatus: ('active' | 'pending' | 'elapsed')[];
  dateLastRenewedBefore?: Date;
  dateLastRenewedAfter?: Date;
  validUntilBefore?: Date;
  validUntilAfter?: Date;
  registrationLabels: string[];
  registrationTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating a registration type
 */
export interface CreateRegistrationTypeDto {
  organisationId: string;
  name: string;
  description: string;
  entityName: string;
  registrationFormId: string;
  registrationStatus?: 'open' | 'closed';
  isRollingRegistration?: boolean;
  validUntil?: Date;
  numberOfMonths?: number;
  automaticallyApprove?: boolean;
  registrationLabels?: string[];
  supportedPaymentMethods: string[];
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
}

/**
 * DTO for updating a registration type
 */
export interface UpdateRegistrationTypeDto {
  name?: string;
  description?: string;
  entityName?: string;
  registrationFormId?: string;
  registrationStatus?: 'open' | 'closed';
  isRollingRegistration?: boolean;
  validUntil?: Date;
  numberOfMonths?: number;
  automaticallyApprove?: boolean;
  registrationLabels?: string[];
  supportedPaymentMethods?: string[];
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
}

/**
 * DTO for filtering registrations
 */
export interface RegistrationFilterDto {
  organisationId: string;
  status?: ('active' | 'pending' | 'elapsed')[];
  registrationTypeId?: string;
  dateLastRenewedBefore?: Date;
  dateLastRenewedAfter?: Date;
  validUntilBefore?: Date;
  validUntilAfter?: Date;
  labels?: string[];
  processed?: boolean;
  searchTerm?: string; // For entity name or owner name search
}

/**
 * DTO for creating a custom filter
 */
export interface CreateFilterDto {
  organisationId: string;
  userId: string;
  name: string;
  registrationStatus?: ('active' | 'pending' | 'elapsed')[];
  dateLastRenewedBefore?: Date;
  dateLastRenewedAfter?: Date;
  validUntilBefore?: Date;
  validUntilAfter?: Date;
  registrationLabels?: string[];
  registrationTypes?: string[];
}

/**
 * Service for managing registration types and registrations
 */
export class RegistrationService {
  /**
   * Convert database row to RegistrationType object
   */
  private rowToRegistrationType(row: any): RegistrationType {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      description: row.description,
      entityName: row.entity_name,
      registrationFormId: row.registration_form_id,
      registrationStatus: row.registration_status,
      isRollingRegistration: row.is_rolling_registration,
      validUntil: row.valid_until,
      numberOfMonths: row.number_of_months,
      automaticallyApprove: row.automatically_approve,
      registrationLabels: row.registration_labels || [],
      supportedPaymentMethods: row.supported_payment_methods || [],
      useTermsAndConditions: row.use_terms_and_conditions,
      termsAndConditions: row.terms_and_conditions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to Registration object
   */
  private rowToRegistration(row: any): Registration {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      registrationTypeId: row.registration_type_id,
      userId: row.user_id,
      registrationNumber: row.registration_number,
      entityName: row.entity_name,
      ownerName: row.owner_name,
      formSubmissionId: row.form_submission_id,
      dateLastRenewed: row.date_last_renewed,
      status: row.status,
      validUntil: row.valid_until,
      labels: row.labels || [],
      processed: row.processed,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to RegistrationFilter object
   */
  private rowToRegistrationFilter(row: any): RegistrationFilter {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      userId: row.user_id,
      name: row.name,
      registrationStatus: row.registration_status || [],
      dateLastRenewedBefore: row.date_last_renewed_before,
      dateLastRenewedAfter: row.date_last_renewed_after,
      validUntilBefore: row.valid_until_before,
      validUntilAfter: row.valid_until_after,
      registrationLabels: row.registration_labels || [],
      registrationTypes: row.registration_types || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all registration types for an organisation
   */
  async getRegistrationTypesByOrganisation(organisationId: string): Promise<RegistrationType[]> {
    try {
      const result = await db.query(
        `SELECT * FROM registration_types 
         WHERE organisation_id = $1 
         ORDER BY name ASC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToRegistrationType(row));
    } catch (error) {
      logger.error('Error getting registration types by organisation:', error);
      throw error;
    }
  }

  /**
   * Get registration type by ID
   */
  async getRegistrationTypeById(id: string): Promise<RegistrationType | null> {
    try {
      const result = await db.query(
        'SELECT * FROM registration_types WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToRegistrationType(result.rows[0]);
    } catch (error) {
      logger.error('Error getting registration type by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new registration type
   */
  async createRegistrationType(data: CreateRegistrationTypeDto): Promise<RegistrationType> {
    try {
      // Validate rolling registration configuration
      if (data.isRollingRegistration && !data.numberOfMonths) {
        throw new Error('Number of months is required for rolling registrations');
      }
      if (!data.isRollingRegistration && !data.validUntil) {
        throw new Error('Valid until date is required for fixed-period registrations');
      }

      // Validate entity name
      if (!data.entityName || data.entityName.trim().length === 0) {
        throw new Error('Entity name is required');
      }

      // Validate terms and conditions
      if (data.useTermsAndConditions && !data.termsAndConditions) {
        throw new Error('Terms and conditions text is required when use terms and conditions is enabled');
      }

      const result = await db.query(
        `INSERT INTO registration_types 
         (organisation_id, name, description, entity_name, registration_form_id, registration_status,
          is_rolling_registration, valid_until, number_of_months, automatically_approve,
          registration_labels, supported_payment_methods, use_terms_and_conditions, terms_and_conditions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          data.organisationId,
          data.name,
          data.description,
          data.entityName,
          data.registrationFormId,
          data.registrationStatus || 'open',
          data.isRollingRegistration || false,
          data.validUntil || null,
          data.numberOfMonths || null,
          data.automaticallyApprove || false,
          JSON.stringify(data.registrationLabels || []),
          JSON.stringify(data.supportedPaymentMethods),
          data.useTermsAndConditions || false,
          data.termsAndConditions || null,
        ]
      );

      logger.info(`Registration type created: ${data.name} (${result.rows[0].id})`);
      return this.rowToRegistrationType(result.rows[0]);
    } catch (error) {
      logger.error('Error creating registration type:', error);
      throw error;
    }
  }

  /**
   * Update a registration type
   */
  async updateRegistrationType(id: string, data: UpdateRegistrationTypeDto): Promise<RegistrationType> {
    try {
      // Get existing registration type
      const existing = await this.getRegistrationTypeById(id);
      if (!existing) {
        throw new Error('Registration type not found');
      }

      // Validate rolling registration configuration
      const isRolling = data.isRollingRegistration !== undefined ? data.isRollingRegistration : existing.isRollingRegistration;
      const numberOfMonths = data.numberOfMonths !== undefined ? data.numberOfMonths : existing.numberOfMonths;
      const validUntil = data.validUntil !== undefined ? data.validUntil : existing.validUntil;

      if (isRolling && !numberOfMonths) {
        throw new Error('Number of months is required for rolling registrations');
      }
      if (!isRolling && !validUntil) {
        throw new Error('Valid until date is required for fixed-period registrations');
      }

      // Validate entity name
      const entityName = data.entityName !== undefined ? data.entityName : existing.entityName;
      if (!entityName || entityName.trim().length === 0) {
        throw new Error('Entity name is required');
      }

      // Validate terms and conditions
      const useTerms = data.useTermsAndConditions !== undefined ? data.useTermsAndConditions : existing.useTermsAndConditions;
      const termsText = data.termsAndConditions !== undefined ? data.termsAndConditions : existing.termsAndConditions;
      if (useTerms && !termsText) {
        throw new Error('Terms and conditions text is required when use terms and conditions is enabled');
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
        values.push(data.description);
      }
      if (data.entityName !== undefined) {
        updates.push(`entity_name = $${paramCount++}`);
        values.push(data.entityName);
      }
      if (data.registrationFormId !== undefined) {
        updates.push(`registration_form_id = $${paramCount++}`);
        values.push(data.registrationFormId);
      }
      if (data.registrationStatus !== undefined) {
        updates.push(`registration_status = $${paramCount++}`);
        values.push(data.registrationStatus);
      }
      if (data.isRollingRegistration !== undefined) {
        updates.push(`is_rolling_registration = $${paramCount++}`);
        values.push(data.isRollingRegistration);
      }
      if (data.validUntil !== undefined) {
        updates.push(`valid_until = $${paramCount++}`);
        values.push(data.validUntil || null);
      }
      if (data.numberOfMonths !== undefined) {
        updates.push(`number_of_months = $${paramCount++}`);
        values.push(data.numberOfMonths || null);
      }
      if (data.automaticallyApprove !== undefined) {
        updates.push(`automatically_approve = $${paramCount++}`);
        values.push(data.automaticallyApprove);
      }
      if (data.registrationLabels !== undefined) {
        updates.push(`registration_labels = $${paramCount++}`);
        values.push(JSON.stringify(data.registrationLabels));
      }
      if (data.supportedPaymentMethods !== undefined) {
        updates.push(`supported_payment_methods = $${paramCount++}`);
        values.push(JSON.stringify(data.supportedPaymentMethods));
      }
      if (data.useTermsAndConditions !== undefined) {
        updates.push(`use_terms_and_conditions = $${paramCount++}`);
        values.push(data.useTermsAndConditions);
      }
      if (data.termsAndConditions !== undefined) {
        updates.push(`terms_and_conditions = $${paramCount++}`);
        values.push(data.termsAndConditions || null);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE registration_types 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Registration type not found');
      }

      logger.info(`Registration type updated: ${id}`);
      return this.rowToRegistrationType(result.rows[0]);
    } catch (error) {
      logger.error('Error updating registration type:', error);
      throw error;
    }
  }

  /**
   * Delete a registration type
   */
  async deleteRegistrationType(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM registration_types WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Registration type not found');
      }

      logger.info(`Registration type deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting registration type:', error);
      throw error;
    }
  }

  /**
   * Get all registrations for an organisation with optional filtering
   */
  async getRegistrationsByOrganisation(filter: RegistrationFilterDto): Promise<Registration[]> {
    try {
      const conditions: string[] = ['organisation_id = $1'];
      const values: any[] = [filter.organisationId];
      let paramCount = 2;

      // Apply status filter
      if (filter.status && filter.status.length > 0) {
        conditions.push(`status = ANY($${paramCount++})`);
        values.push(filter.status);
      }

      // Apply registration type filter
      if (filter.registrationTypeId) {
        conditions.push(`registration_type_id = $${paramCount++}`);
        values.push(filter.registrationTypeId);
      }

      // Apply date last renewed filters
      if (filter.dateLastRenewedBefore) {
        conditions.push(`date_last_renewed < $${paramCount++}`);
        values.push(filter.dateLastRenewedBefore);
      }
      if (filter.dateLastRenewedAfter) {
        conditions.push(`date_last_renewed > $${paramCount++}`);
        values.push(filter.dateLastRenewedAfter);
      }

      // Apply valid until filters
      if (filter.validUntilBefore) {
        conditions.push(`valid_until < $${paramCount++}`);
        values.push(filter.validUntilBefore);
      }
      if (filter.validUntilAfter) {
        conditions.push(`valid_until > $${paramCount++}`);
        values.push(filter.validUntilAfter);
      }

      // Apply labels filter (registrations must have at least one of the specified labels)
      if (filter.labels && filter.labels.length > 0) {
        conditions.push(`labels ?| $${paramCount++}`);
        values.push(filter.labels);
      }

      // Apply processed filter
      if (filter.processed !== undefined) {
        conditions.push(`processed = $${paramCount++}`);
        values.push(filter.processed);
      }

      // Apply search term (entity name or owner name)
      if (filter.searchTerm) {
        conditions.push(`(entity_name ILIKE $${paramCount} OR owner_name ILIKE $${paramCount})`);
        values.push(`%${filter.searchTerm}%`);
        paramCount++;
      }

      const result = await db.query(
        `SELECT * FROM registrations 
         WHERE ${conditions.join(' AND ')}
         ORDER BY date_last_renewed DESC`,
        values
      );

      return result.rows.map(row => this.rowToRegistration(row));
    } catch (error) {
      logger.error('Error getting registrations by organisation:', error);
      throw error;
    }
  }

  /**
   * Get registration by ID
   */
  async getRegistrationById(id: string): Promise<Registration | null> {
    try {
      const result = await db.query(
        'SELECT * FROM registrations WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToRegistration(result.rows[0]);
    } catch (error) {
      logger.error('Error getting registration by ID:', error);
      throw error;
    }
  }

  /**
   * Update registration status
   */
  async updateRegistrationStatus(id: string, status: 'active' | 'pending' | 'elapsed'): Promise<Registration> {
    try {
      const result = await db.query(
        `UPDATE registrations 
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Registration not found');
      }

      logger.info(`Registration status updated: ${id} -> ${status}`);
      return this.rowToRegistration(result.rows[0]);
    } catch (error) {
      logger.error('Error updating registration status:', error);
      throw error;
    }
  }

  /**
   * Add labels to multiple registrations (batch operation)
   */
  async addLabelsToRegistrations(registrationIds: string[], labels: string[]): Promise<number> {
    try {
      if (registrationIds.length === 0 || labels.length === 0) {
        return 0;
      }

      const result = await db.query(
        `UPDATE registrations 
         SET labels = (
           SELECT jsonb_agg(DISTINCT elem)
           FROM (
             SELECT jsonb_array_elements_text(labels) AS elem
             UNION
             SELECT unnest($2::text[]) AS elem
           ) combined
         ),
         updated_at = NOW()
         WHERE id = ANY($1)`,
        [registrationIds, labels]
      );

      logger.info(`Added labels to ${result.rowCount} registrations`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error adding labels to registrations:', error);
      throw error;
    }
  }

  /**
   * Remove labels from multiple registrations (batch operation)
   */
  async removeLabelsFromRegistrations(registrationIds: string[], labels: string[]): Promise<number> {
    try {
      if (registrationIds.length === 0 || labels.length === 0) {
        return 0;
      }

      const result = await db.query(
        `UPDATE registrations 
         SET labels = (
           SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
           FROM (
             SELECT jsonb_array_elements_text(labels) AS elem
           ) existing
           WHERE elem NOT IN (SELECT unnest($2::text[]))
         ),
         updated_at = NOW()
         WHERE id = ANY($1)`,
        [registrationIds, labels]
      );

      logger.info(`Removed labels from ${result.rowCount} registrations`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error removing labels from registrations:', error);
      throw error;
    }
  }

  /**
   * Mark multiple registrations as processed (batch operation)
   */
  async markRegistrationsProcessed(registrationIds: string[]): Promise<number> {
    try {
      if (registrationIds.length === 0) {
        return 0;
      }

      const result = await db.query(
        `UPDATE registrations 
         SET processed = true, updated_at = NOW()
         WHERE id = ANY($1)`,
        [registrationIds]
      );

      logger.info(`Marked ${result.rowCount} registrations as processed`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error marking registrations as processed:', error);
      throw error;
    }
  }

  /**
   * Mark multiple registrations as unprocessed (batch operation)
   */
  async markRegistrationsUnprocessed(registrationIds: string[]): Promise<number> {
    try {
      if (registrationIds.length === 0) {
        return 0;
      }

      const result = await db.query(
        `UPDATE registrations 
         SET processed = false, updated_at = NOW()
         WHERE id = ANY($1)`,
        [registrationIds]
      );

      logger.info(`Marked ${result.rowCount} registrations as unprocessed`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error marking registrations as unprocessed:', error);
      throw error;
    }
  }

  /**
   * Export registrations to Excel with filtering
   */
  async exportRegistrationsToExcel(filter: RegistrationFilterDto): Promise<Buffer> {
    try {
      // Get filtered registrations
      const registrations = await this.getRegistrationsByOrganisation(filter);

      // Create workbook
      const workbook = new ExcelJS();
      workbook.creator = 'ItsPlainSailing';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('Registrations');

      // Add headers
      const headerRow = worksheet.addRow([
        'Registration Number',
        'Registration Type',
        'Entity Name',
        'Owner Name',
        'Date Last Renewed',
        'Status',
        'Valid Until',
        'Labels',
        'Processed',
        'Payment Status',
        'Payment Method',
      ]);

      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Get registration types for lookup
      const registrationTypes = await this.getRegistrationTypesByOrganisation(filter.organisationId);
      const typeMap = new Map(registrationTypes.map(t => [t.id, t.name]));

      // Add data rows
      for (const registration of registrations) {
        worksheet.addRow([
          registration.registrationNumber,
          typeMap.get(registration.registrationTypeId) || 'Unknown',
          registration.entityName,
          registration.ownerName,
          registration.dateLastRenewed,
          registration.status,
          registration.validUntil,
          registration.labels.join(', '),
          registration.processed ? 'Yes' : 'No',
          registration.paymentStatus,
          registration.paymentMethod || 'N/A',
        ]);
      }

      // Format columns
      worksheet.columns = [
        { key: 'registrationNumber', width: 20 },
        { key: 'registrationType', width: 25 },
        { key: 'entityName', width: 25 },
        { key: 'ownerName', width: 25 },
        { key: 'dateLastRenewed', width: 18 },
        { key: 'status', width: 12 },
        { key: 'validUntil', width: 15 },
        { key: 'labels', width: 30 },
        { key: 'processed', width: 12 },
        { key: 'paymentStatus', width: 15 },
        { key: 'paymentMethod', width: 15 },
      ];

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      logger.info(`Exported ${registrations.length} registrations to Excel`);
      return buffer as Buffer;
    } catch (error) {
      logger.error('Error exporting registrations to Excel:', error);
      throw error;
    }
  }

  /**
   * Get custom filters for a user
   */
  async getCustomFilters(organisationId: string, userId: string): Promise<RegistrationFilter[]> {
    try {
      const result = await db.query(
        `SELECT * FROM registration_filters 
         WHERE organisation_id = $1 AND user_id = $2
         ORDER BY name ASC`,
        [organisationId, userId]
      );

      return result.rows.map(row => this.rowToRegistrationFilter(row));
    } catch (error) {
      logger.error('Error getting custom filters:', error);
      throw error;
    }
  }

  /**
   * Save a custom filter
   */
  async saveCustomFilter(data: CreateFilterDto): Promise<RegistrationFilter> {
    try {
      const result = await db.query(
        `INSERT INTO registration_filters 
         (organisation_id, user_id, name, registration_status, date_last_renewed_before,
          date_last_renewed_after, valid_until_before, valid_until_after,
          registration_labels, registration_types)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          data.organisationId,
          data.userId,
          data.name,
          JSON.stringify(data.registrationStatus || []),
          data.dateLastRenewedBefore || null,
          data.dateLastRenewedAfter || null,
          data.validUntilBefore || null,
          data.validUntilAfter || null,
          JSON.stringify(data.registrationLabels || []),
          JSON.stringify(data.registrationTypes || []),
        ]
      );

      logger.info(`Custom filter created: ${data.name} (${result.rows[0].id})`);
      return this.rowToRegistrationFilter(result.rows[0]);
    } catch (error) {
      logger.error('Error saving custom filter:', error);
      throw error;
    }
  }

  /**
   * Automatic status update - changes Active registrations to Elapsed if valid_until has passed
   * This should be run as a nightly job
   */
  async automaticStatusUpdate(): Promise<number> {
    try {
      const result = await db.query(
        `UPDATE registrations 
         SET status = 'elapsed', updated_at = NOW()
         WHERE status = 'active' 
         AND valid_until < CURRENT_DATE`
      );

      const count = result.rowCount || 0;
      logger.info(`Automatic status update: ${count} registrations changed from active to elapsed`);
      return count;
    } catch (error) {
      logger.error('Error in automatic status update:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const registrationService = new RegistrationService();
