import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * ApplicationForm interface matching database schema
 */
export interface ApplicationForm {
  id: string;
  organisationId: string;
  name: string;
  description?: string;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ApplicationField interface matching database schema
 */
export interface ApplicationField {
  id: string;
  organisationId: string;
  name: string;
  label: string;
  description?: string;
  datatype: string;
  validation?: any;
  options?: any;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ApplicationFormField interface (join table)
 */
export interface ApplicationFormField {
  id: string;
  formId: string;
  fieldId: string;
  order: number;
  groupName?: string;
  groupOrder?: number;
  wizardStep?: number;
  wizardStepTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Complete form with fields
 */
export interface ApplicationFormWithFields extends ApplicationForm {
  fields: Array<ApplicationField & {
    order: number;
    groupName?: string;
    groupOrder?: number;
    wizardStep?: number;
    wizardStepTitle?: string;
  }>;
}

/**
 * DTO for creating an application form
 */
export interface CreateApplicationFormDto {
  organisationId: string;
  name: string;
  description?: string;
  status?: 'draft' | 'published';
}

/**
 * DTO for updating an application form
 */
export interface UpdateApplicationFormDto {
  name?: string;
  description?: string;
  status?: 'draft' | 'published';
}

/**
 * DTO for creating an application field
 */
export interface CreateApplicationFieldDto {
  organisationId: string;
  name: string;
  label: string;
  description?: string;
  datatype: string;
  validation?: any;
  options?: any;
  allowedFileTypes?: string[];
  maxFileSize?: number;
}

/**
 * DTO for updating an application field
 */
export interface UpdateApplicationFieldDto {
  name?: string;
  label?: string;
  description?: string;
  datatype?: string;
  validation?: any;
  options?: any;
  allowedFileTypes?: string[];
  maxFileSize?: number;
}

/**
 * DTO for adding a field to a form
 */
export interface AddFieldToFormDto {
  formId: string;
  fieldId: string;
  order: number;
  groupName?: string;
  groupOrder?: number;
  wizardStep?: number;
  wizardStepTitle?: string;
}

/**
 * Service for managing application forms (separate from metadata)
 */
export class ApplicationFormService {
  /**
   * Convert database row to ApplicationForm object
   */
  private rowToForm(row: any): ApplicationForm {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to ApplicationField object
   */
  private rowToField(row: any): ApplicationField {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      label: row.label,
      description: row.description,
      datatype: row.datatype,
      validation: row.validation,
      options: row.options,
      allowedFileTypes: row.allowed_file_types,
      maxFileSize: row.max_file_size,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all application forms for an organisation
   */
  async getApplicationFormsByOrganisation(organisationId: string): Promise<ApplicationForm[]> {
    try {
      const result = await db.query(
        `SELECT * FROM application_forms 
         WHERE organisation_id = $1 
         ORDER BY created_at DESC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToForm(row));
    } catch (error) {
      logger.error('Error getting application forms by organisation:', error);
      throw error;
    }
  }

  /**
   * Get application form by ID
   */
  async getApplicationFormById(id: string): Promise<ApplicationForm | null> {
    try {
      const result = await db.query(
        'SELECT * FROM application_forms WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToForm(result.rows[0]);
    } catch (error) {
      logger.error('Error getting application form by ID:', error);
      throw error;
    }
  }

  /**
   * Get application form with all fields
   */
  async getApplicationFormWithFields(id: string): Promise<ApplicationFormWithFields | null> {
    try {
      const form = await this.getApplicationFormById(id);
      if (!form) {
        return null;
      }

      const fieldsResult = await db.query(
        `SELECT 
          af.*,
          aff.order,
          aff.group_name,
          aff.group_order,
          aff.wizard_step,
          aff.wizard_step_title
         FROM application_fields af
         INNER JOIN application_form_fields aff ON af.id = aff.field_id
         WHERE aff.form_id = $1
         ORDER BY aff.order`,
        [id]
      );

      const fields = fieldsResult.rows.map(row => ({
        ...this.rowToField(row),
        order: row.order,
        groupName: row.group_name,
        groupOrder: row.group_order,
        wizardStep: row.wizard_step,
        wizardStepTitle: row.wizard_step_title,
      }));

      return {
        ...form,
        fields,
      };
    } catch (error) {
      logger.error('Error getting application form with fields:', error);
      throw error;
    }
  }

  /**
   * Create a new application form
   */
  async createApplicationForm(data: CreateApplicationFormDto): Promise<ApplicationForm> {
    try {
      const result = await db.query(
        `INSERT INTO application_forms 
         (organisation_id, name, description, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          data.organisationId,
          data.name,
          data.description || null,
          data.status || 'draft',
        ]
      );

      logger.info(`Application form created: ${data.name} (${result.rows[0].id})`);
      return this.rowToForm(result.rows[0]);
    } catch (error) {
      logger.error('Error creating application form:', error);
      throw error;
    }
  }

  /**
   * Update an application form
   */
  async updateApplicationForm(id: string, data: UpdateApplicationFormDto): Promise<ApplicationForm> {
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
        values.push(data.description || null);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE application_forms 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Application form not found');
      }

      logger.info(`Application form updated: ${id}`);
      return this.rowToForm(result.rows[0]);
    } catch (error) {
      logger.error('Error updating application form:', error);
      throw error;
    }
  }

  /**
   * Delete an application form
   */
  async deleteApplicationForm(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM application_forms WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Application form not found');
      }

      logger.info(`Application form deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting application form:', error);
      throw error;
    }
  }

  /**
   * Create a new application field
   */
  async createApplicationField(data: CreateApplicationFieldDto): Promise<ApplicationField> {
    try {
      // Validate document_upload field has required attributes
      if (data.datatype === 'document_upload') {
        if (!data.allowedFileTypes || data.allowedFileTypes.length === 0) {
          throw new Error('document_upload field must have allowedFileTypes');
        }
        if (!data.maxFileSize || data.maxFileSize <= 0) {
          throw new Error('document_upload field must have maxFileSize');
        }
      }

      const result = await db.query(
        `INSERT INTO application_fields 
         (organisation_id, name, label, description, datatype, validation, options, allowed_file_types, max_file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          data.organisationId,
          data.name,
          data.label,
          data.description || null,
          data.datatype,
          data.validation ? JSON.stringify(data.validation) : null,
          data.options ? JSON.stringify(data.options) : null,
          data.allowedFileTypes ? JSON.stringify(data.allowedFileTypes) : null,
          data.maxFileSize || null,
        ]
      );

      logger.info(`Application field created: ${data.name} (${result.rows[0].id})`);
      return this.rowToField(result.rows[0]);
    } catch (error) {
      logger.error('Error creating application field:', error);
      throw error;
    }
  }

  /**
   * Update an application field
   */
  async updateApplicationField(id: string, data: UpdateApplicationFieldDto): Promise<ApplicationField> {
    try {
      // Get existing field
      const existing = await this.getApplicationFieldById(id);
      if (!existing) {
        throw new Error('Application field not found');
      }

      // Validate document_upload field
      const datatype = data.datatype || existing.datatype;
      if (datatype === 'document_upload') {
        const allowedFileTypes = data.allowedFileTypes !== undefined ? data.allowedFileTypes : existing.allowedFileTypes;
        const maxFileSize = data.maxFileSize !== undefined ? data.maxFileSize : existing.maxFileSize;
        
        if (!allowedFileTypes || allowedFileTypes.length === 0) {
          throw new Error('document_upload field must have allowedFileTypes');
        }
        if (!maxFileSize || maxFileSize <= 0) {
          throw new Error('document_upload field must have maxFileSize');
        }
      }

      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.label !== undefined) {
        updates.push(`label = $${paramCount++}`);
        values.push(data.label);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description || null);
      }
      if (data.datatype !== undefined) {
        updates.push(`datatype = $${paramCount++}`);
        values.push(data.datatype);
      }
      if (data.validation !== undefined) {
        updates.push(`validation = $${paramCount++}`);
        values.push(data.validation ? JSON.stringify(data.validation) : null);
      }
      if (data.options !== undefined) {
        updates.push(`options = $${paramCount++}`);
        values.push(data.options ? JSON.stringify(data.options) : null);
      }
      if (data.allowedFileTypes !== undefined) {
        updates.push(`allowed_file_types = $${paramCount++}`);
        values.push(data.allowedFileTypes ? JSON.stringify(data.allowedFileTypes) : null);
      }
      if (data.maxFileSize !== undefined) {
        updates.push(`max_file_size = $${paramCount++}`);
        values.push(data.maxFileSize || null);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE application_fields 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Application field not found');
      }

      logger.info(`Application field updated: ${id}`);
      return this.rowToField(result.rows[0]);
    } catch (error) {
      logger.error('Error updating application field:', error);
      throw error;
    }
  }

  /**
   * Get application field by ID
   */
  async getApplicationFieldById(id: string): Promise<ApplicationField | null> {
    try {
      const result = await db.query(
        'SELECT * FROM application_fields WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToField(result.rows[0]);
    } catch (error) {
      logger.error('Error getting application field by ID:', error);
      throw error;
    }
  }

  /**
   * Get all application fields for an organisation
   */
  async getAllApplicationFields(organisationId?: string): Promise<ApplicationField[]> {
    try {
      let query = 'SELECT * FROM application_fields';
      const params: any[] = [];

      if (organisationId) {
        query += ' WHERE organisation_id = $1';
        params.push(organisationId);
      }

      query += ' ORDER BY created_at DESC';

      const result = await db.query(query, params);
      return result.rows.map(row => this.rowToField(row));
    } catch (error) {
      logger.error('Error getting all application fields:', error);
      throw error;
    }
  }

  /**
   * Delete an application field
   */
  async deleteApplicationField(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM application_fields WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Application field not found');
      }

      logger.info(`Application field deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting application field:', error);
      throw error;
    }
  }

  /**
   * Add a field to a form
   */
  async addFieldToForm(data: AddFieldToFormDto): Promise<ApplicationFormField> {
    try {
      const result = await db.query(
        `INSERT INTO application_form_fields 
         (form_id, field_id, "order", group_name, group_order, wizard_step, wizard_step_title)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.formId,
          data.fieldId,
          data.order,
          data.groupName || null,
          data.groupOrder || null,
          data.wizardStep || null,
          data.wizardStepTitle || null,
        ]
      );

      logger.info(`Field ${data.fieldId} added to form ${data.formId}`);
      return {
        id: result.rows[0].id,
        formId: result.rows[0].form_id,
        fieldId: result.rows[0].field_id,
        order: result.rows[0].order,
        groupName: result.rows[0].group_name,
        groupOrder: result.rows[0].group_order,
        wizardStep: result.rows[0].wizard_step,
        wizardStepTitle: result.rows[0].wizard_step_title,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };
    } catch (error) {
      logger.error('Error adding field to form:', error);
      throw error;
    }
  }

  /**
   * Remove a field from a form
   */
  async removeFieldFromForm(formId: string, fieldId: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM application_form_fields WHERE form_id = $1 AND field_id = $2',
        [formId, fieldId]
      );

      if (result.rowCount === 0) {
        throw new Error('Field not found in form');
      }

      logger.info(`Field ${fieldId} removed from form ${formId}`);
    } catch (error) {
      logger.error('Error removing field from form:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const applicationFormService = new ApplicationFormService();
