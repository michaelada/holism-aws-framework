import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Submission types for different contexts
 */
export type SubmissionType = 
  | 'event_entry' 
  | 'membership_application' 
  | 'calendar_booking' 
  | 'merchandise_order' 
  | 'registration';

/**
 * FormSubmission interface matching database schema
 */
export interface FormSubmission {
  id: string;
  formId: string;
  organisationId: string;
  userId: string;
  submissionType: SubmissionType;
  contextId: string;
  submissionData: any;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * FormSubmissionFile interface matching database schema
 */
export interface FormSubmissionFile {
  id: string;
  submissionId: string;
  fieldId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  s3Key: string;
  s3Bucket: string;
  uploadedAt: Date;
}

/**
 * Complete submission with files
 */
export interface FormSubmissionWithFiles extends FormSubmission {
  files: FormSubmissionFile[];
}

/**
 * DTO for creating a form submission
 */
export interface CreateFormSubmissionDto {
  formId: string;
  organisationId: string;
  userId: string;
  submissionType: SubmissionType;
  contextId: string;
  submissionData: any;
  status?: 'pending' | 'approved' | 'rejected';
}

/**
 * DTO for updating a form submission
 */
export interface UpdateFormSubmissionDto {
  submissionData?: any;
  status?: 'pending' | 'approved' | 'rejected';
}

/**
 * DTO for creating a form submission file
 */
export interface CreateFormSubmissionFileDto {
  submissionId: string;
  fieldId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  s3Key: string;
  s3Bucket: string;
}

/**
 * Filter options for getting submissions
 */
export interface GetSubmissionsFilters {
  submissionType?: SubmissionType;
  contextId?: string;
  status?: 'pending' | 'approved' | 'rejected';
  userId?: string;
  formId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Service for managing form submissions (unified across all contexts)
 */
export class FormSubmissionService {
  /**
   * Convert database row to FormSubmission object
   */
  private rowToSubmission(row: any): FormSubmission {
    return {
      id: row.id,
      formId: row.form_id,
      organisationId: row.organisation_id,
      userId: row.user_id,
      submissionType: row.submission_type,
      contextId: row.context_id,
      submissionData: row.submission_data,
      status: row.status,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to FormSubmissionFile object
   */
  private rowToFile(row: any): FormSubmissionFile {
    return {
      id: row.id,
      submissionId: row.submission_id,
      fieldId: row.field_id,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileType: row.file_type,
      s3Key: row.s3_key,
      s3Bucket: row.s3_bucket,
      uploadedAt: row.uploaded_at,
    };
  }

  /**
   * Get all submissions for an organisation with optional filters
   */
  async getSubmissionsByOrganisation(
    organisationId: string,
    filters?: GetSubmissionsFilters
  ): Promise<FormSubmission[]> {
    try {
      const conditions: string[] = ['organisation_id = $1'];
      const values: any[] = [organisationId];
      let paramCount = 2;

      if (filters?.submissionType) {
        conditions.push(`submission_type = $${paramCount++}`);
        values.push(filters.submissionType);
      }

      if (filters?.contextId) {
        conditions.push(`context_id = $${paramCount++}`);
        values.push(filters.contextId);
      }

      if (filters?.status) {
        conditions.push(`status = $${paramCount++}`);
        values.push(filters.status);
      }

      if (filters?.userId) {
        conditions.push(`user_id = $${paramCount++}`);
        values.push(filters.userId);
      }

      if (filters?.formId) {
        conditions.push(`form_id = $${paramCount++}`);
        values.push(filters.formId);
      }

      if (filters?.startDate) {
        conditions.push(`submitted_at >= $${paramCount++}`);
        values.push(filters.startDate);
      }

      if (filters?.endDate) {
        conditions.push(`submitted_at <= $${paramCount++}`);
        values.push(filters.endDate);
      }

      const result = await db.query(
        `SELECT * FROM form_submissions 
         WHERE ${conditions.join(' AND ')}
         ORDER BY submitted_at DESC`,
        values
      );

      return result.rows.map(row => this.rowToSubmission(row));
    } catch (error) {
      logger.error('Error getting submissions by organisation:', error);
      throw error;
    }
  }

  /**
   * Get submission by ID
   */
  async getSubmissionById(id: string): Promise<FormSubmission | null> {
    try {
      const result = await db.query(
        'SELECT * FROM form_submissions WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToSubmission(result.rows[0]);
    } catch (error) {
      logger.error('Error getting submission by ID:', error);
      throw error;
    }
  }

  /**
   * Get submission with all files
   */
  async getSubmissionWithFiles(id: string): Promise<FormSubmissionWithFiles | null> {
    try {
      const submission = await this.getSubmissionById(id);
      if (!submission) {
        return null;
      }

      const filesResult = await db.query(
        `SELECT * FROM form_submission_files 
         WHERE submission_id = $1
         ORDER BY uploaded_at`,
        [id]
      );

      const files = filesResult.rows.map(row => this.rowToFile(row));

      return {
        ...submission,
        files,
      };
    } catch (error) {
      logger.error('Error getting submission with files:', error);
      throw error;
    }
  }

  /**
   * Get submissions by context (e.g., all submissions for a specific event)
   */
  async getSubmissionsByContext(
    submissionType: SubmissionType,
    contextId: string
  ): Promise<FormSubmission[]> {
    try {
      const result = await db.query(
        `SELECT * FROM form_submissions 
         WHERE submission_type = $1 AND context_id = $2
         ORDER BY submitted_at DESC`,
        [submissionType, contextId]
      );

      return result.rows.map(row => this.rowToSubmission(row));
    } catch (error) {
      logger.error('Error getting submissions by context:', error);
      throw error;
    }
  }

  /**
   * Create a new form submission
   */
  async createSubmission(data: CreateFormSubmissionDto): Promise<FormSubmission> {
    try {
      // Validate submission type
      const validTypes: SubmissionType[] = [
        'event_entry',
        'membership_application',
        'calendar_booking',
        'merchandise_order',
        'registration',
      ];

      if (!validTypes.includes(data.submissionType)) {
        throw new Error(`Invalid submission type: ${data.submissionType}`);
      }

      const result = await db.query(
        `INSERT INTO form_submissions 
         (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.formId,
          data.organisationId,
          data.userId,
          data.submissionType,
          data.contextId,
          JSON.stringify(data.submissionData),
          data.status || 'pending',
        ]
      );

      logger.info(
        `Form submission created: ${data.submissionType} for context ${data.contextId} (${result.rows[0].id})`
      );
      return this.rowToSubmission(result.rows[0]);
    } catch (error) {
      logger.error('Error creating form submission:', error);
      throw error;
    }
  }

  /**
   * Update a form submission
   */
  async updateSubmission(id: string, data: UpdateFormSubmissionDto): Promise<FormSubmission> {
    try {
      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.submissionData !== undefined) {
        updates.push(`submission_data = $${paramCount++}`);
        values.push(JSON.stringify(data.submissionData));
      }

      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE form_submissions 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Form submission not found');
      }

      logger.info(`Form submission updated: ${id}`);
      return this.rowToSubmission(result.rows[0]);
    } catch (error) {
      logger.error('Error updating form submission:', error);
      throw error;
    }
  }

  /**
   * Delete a form submission
   */
  async deleteSubmission(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM form_submissions WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Form submission not found');
      }

      logger.info(`Form submission deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting form submission:', error);
      throw error;
    }
  }

  /**
   * Create a form submission file record
   */
  async createSubmissionFile(data: CreateFormSubmissionFileDto): Promise<FormSubmissionFile> {
    try {
      const result = await db.query(
        `INSERT INTO form_submission_files 
         (submission_id, field_id, file_name, file_size, file_type, s3_key, s3_bucket)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.submissionId,
          data.fieldId,
          data.fileName,
          data.fileSize,
          data.fileType,
          data.s3Key,
          data.s3Bucket,
        ]
      );

      logger.info(
        `Form submission file created: ${data.fileName} for submission ${data.submissionId} (${result.rows[0].id})`
      );
      return this.rowToFile(result.rows[0]);
    } catch (error) {
      logger.error('Error creating form submission file:', error);
      throw error;
    }
  }

  /**
   * Get files for a submission
   */
  async getFilesBySubmission(submissionId: string): Promise<FormSubmissionFile[]> {
    try {
      const result = await db.query(
        `SELECT * FROM form_submission_files 
         WHERE submission_id = $1
         ORDER BY uploaded_at`,
        [submissionId]
      );

      return result.rows.map(row => this.rowToFile(row));
    } catch (error) {
      logger.error('Error getting files by submission:', error);
      throw error;
    }
  }

  /**
   * Get file by ID
   */
  async getFileById(id: string): Promise<FormSubmissionFile | null> {
    try {
      const result = await db.query(
        'SELECT * FROM form_submission_files WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToFile(result.rows[0]);
    } catch (error) {
      logger.error('Error getting file by ID:', error);
      throw error;
    }
  }

  /**
   * Delete a form submission file
   */
  async deleteSubmissionFile(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM form_submission_files WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Form submission file not found');
      }

      logger.info(`Form submission file deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting form submission file:', error);
      throw error;
    }
  }

  /**
   * Get submission count by type for an organisation
   */
  async getSubmissionCountByType(
    organisationId: string,
    submissionType: SubmissionType
  ): Promise<number> {
    try {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM form_submissions 
         WHERE organisation_id = $1 AND submission_type = $2`,
        [organisationId, submissionType]
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error getting submission count by type:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const formSubmissionService = new FormSubmissionService();
