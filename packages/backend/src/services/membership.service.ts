import { db } from '../database/pool';
import { logger } from '../config/logger';
import { FormSubmissionService } from './form-submission.service';

/**
 * MembershipType interface matching database schema
 */
export interface MembershipType {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  membershipFormId: string;
  membershipStatus: 'open' | 'closed';
  isRollingMembership: boolean;
  validUntil?: Date;
  numberOfMonths?: number;
  automaticallyApprove: boolean;
  memberLabels: string[];
  supportedPaymentMethods: string[];
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  membershipTypeCategory: 'single' | 'group';
  maxPeopleInApplication?: number;
  minPeopleInApplication?: number;
  personTitles?: string[];
  personLabels?: string[][];
  fieldConfiguration?: Record<string, 'common' | 'unique'>;
  discountIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Member interface matching database schema
 */
export interface Member {
  id: string;
  organisationId: string;
  membershipTypeId: string;
  userId: string;
  membershipNumber: string;
  firstName: string;
  lastName: string;
  formSubmissionId: string;
  dateLastRenewed: Date;
  status: 'active' | 'pending' | 'elapsed';
  validUntil: Date;
  labels: string[];
  processed: boolean;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  groupMembershipId?: string;
  personSlot?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating a membership type
 */
export interface CreateMembershipTypeDto {
  organisationId: string;
  name: string;
  description: string;
  membershipFormId: string;
  membershipStatus?: 'open' | 'closed';
  isRollingMembership?: boolean;
  validUntil?: Date;
  numberOfMonths?: number;
  automaticallyApprove?: boolean;
  memberLabels?: string[];
  supportedPaymentMethods: string[];
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  membershipTypeCategory?: 'single' | 'group';
  maxPeopleInApplication?: number;
  minPeopleInApplication?: number;
  personTitles?: string[];
  personLabels?: string[][];
  fieldConfiguration?: Record<string, 'common' | 'unique'>;
  discountIds?: string[];
}

/**
 * DTO for updating a membership type
 */
export interface UpdateMembershipTypeDto {
  name?: string;
  description?: string;
  membershipFormId?: string;
  membershipStatus?: 'open' | 'closed';
  isRollingMembership?: boolean;
  validUntil?: Date;
  numberOfMonths?: number;
  automaticallyApprove?: boolean;
  memberLabels?: string[];
  supportedPaymentMethods?: string[];
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  membershipTypeCategory?: 'single' | 'group';
  maxPeopleInApplication?: number;
  minPeopleInApplication?: number;
  personTitles?: string[];
  personLabels?: string[][];
  fieldConfiguration?: Record<string, 'common' | 'unique'>;
  discountIds?: string[];
}

/**
 * DTO for creating a member
 */
export interface CreateMemberDto {
  organisationId: string;
  membershipTypeId: string;
  userId: string;
  firstName: string;
  lastName: string;
  formSubmissionId: string;
}

/**
 * Discount validation result interface
 */
export interface DiscountValidationResult {
  valid: boolean;
  errors: Array<{
    discountId: string;
    reason: 'not_found' | 'wrong_organisation' | 'wrong_module_type' | 'inactive';
    message: string;
  }>;
}

/**
 * Service for managing membership types and members
 */
export class MembershipService {
  private formSubmissionService: FormSubmissionService;

  constructor(formSubmissionService?: FormSubmissionService) {
    // Allow dependency injection for testing, but use singleton by default
    this.formSubmissionService = formSubmissionService || new FormSubmissionService();
  }

  /**
   * Convert database row to MembershipType object
   */
  private rowToMembershipType(row: any): MembershipType {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      description: row.description,
      membershipFormId: row.membership_form_id,
      membershipStatus: row.membership_status,
      isRollingMembership: row.is_rolling_membership,
      validUntil: row.valid_until,
      numberOfMonths: row.number_of_months,
      automaticallyApprove: row.automatically_approve,
      memberLabels: row.member_labels || [],
      supportedPaymentMethods: row.supported_payment_methods || [],
      useTermsAndConditions: row.use_terms_and_conditions,
      termsAndConditions: row.terms_and_conditions,
      membershipTypeCategory: row.membership_type_category,
      maxPeopleInApplication: row.max_people_in_application,
      minPeopleInApplication: row.min_people_in_application,
      personTitles: row.person_titles,
      personLabels: row.person_labels,
      fieldConfiguration: row.field_configuration,
      discountIds: row.discount_ids ? 
        (Array.isArray(row.discount_ids) ? row.discount_ids : JSON.parse(row.discount_ids)) 
        : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to Member object
   */
  private rowToMember(row: any): Member {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      membershipTypeId: row.membership_type_id,
      userId: row.user_id,
      membershipNumber: row.membership_number,
      firstName: row.first_name,
      lastName: row.last_name,
      formSubmissionId: row.form_submission_id,
      dateLastRenewed: row.date_last_renewed,
      status: row.status,
      validUntil: row.valid_until,
      labels: row.labels || [],
      processed: row.processed,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      groupMembershipId: row.group_membership_id,
      personSlot: row.person_slot,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all membership types for an organisation
   */
  async getMembershipTypesByOrganisation(organisationId: string): Promise<MembershipType[]> {
    try {
      const result = await db.query(
        `SELECT * FROM membership_types 
         WHERE organisation_id = $1 
         ORDER BY name ASC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToMembershipType(row));
    } catch (error) {
      logger.error('Error getting membership types by organisation:', error);
      throw error;
    }
  }

  /**
   * Get membership type by ID
   */
  async getMembershipTypeById(id: string): Promise<MembershipType | null> {
    try {
      const result = await db.query(
        'SELECT * FROM membership_types WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToMembershipType(result.rows[0]);
    } catch (error) {
      logger.error('Error getting membership type by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new membership type
   */
  async createMembershipType(data: CreateMembershipTypeDto): Promise<MembershipType> {
    try {
      // Validate rolling membership configuration
      if (data.isRollingMembership && !data.numberOfMonths) {
        throw new Error('Number of months is required for rolling memberships');
      }
      if (!data.isRollingMembership && !data.validUntil) {
        throw new Error('Valid until date is required for fixed-period memberships');
      }

      // Validate group membership configuration
      if (data.membershipTypeCategory === 'group') {
        if (!data.maxPeopleInApplication || data.maxPeopleInApplication < 1) {
          throw new Error('Max people in application must be at least 1 for group memberships');
        }
        if (!data.minPeopleInApplication || data.minPeopleInApplication < 1) {
          throw new Error('Min people in application must be at least 1 for group memberships');
        }
        if (data.minPeopleInApplication > data.maxPeopleInApplication) {
          throw new Error('Min people cannot be greater than max people');
        }
      }

      // Validate terms and conditions
      if (data.useTermsAndConditions && !data.termsAndConditions) {
        throw new Error('Terms and conditions text is required when use terms and conditions is enabled');
      }

      // Validate discount IDs if provided
      if (data.discountIds && data.discountIds.length > 0) {
        const validationResult = await this.validateDiscountIds(data.discountIds, data.organisationId);
        if (!validationResult.valid) {
          const error = new Error('Discount validation failed') as any;
          error.validationErrors = validationResult.errors;
          throw error;
        }
      }

      const result = await db.query(
        `INSERT INTO membership_types 
         (organisation_id, name, description, membership_form_id, membership_status,
          is_rolling_membership, valid_until, number_of_months, automatically_approve,
          member_labels, supported_payment_methods, use_terms_and_conditions, terms_and_conditions,
          membership_type_category, max_people_in_application, min_people_in_application,
          person_titles, person_labels, field_configuration, discount_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         RETURNING *`,
        [
          data.organisationId,
          data.name,
          data.description,
          data.membershipFormId,
          data.membershipStatus || 'open',
          data.isRollingMembership || false,
          data.validUntil || null,
          data.numberOfMonths || null,
          data.automaticallyApprove || false,
          JSON.stringify(data.memberLabels || []),
          JSON.stringify(data.supportedPaymentMethods),
          data.useTermsAndConditions || false,
          data.termsAndConditions || null,
          data.membershipTypeCategory || 'single',
          data.maxPeopleInApplication || null,
          data.minPeopleInApplication || null,
          data.personTitles ? JSON.stringify(data.personTitles) : null,
          data.personLabels ? JSON.stringify(data.personLabels) : null,
          data.fieldConfiguration ? JSON.stringify(data.fieldConfiguration) : null,
          JSON.stringify(data.discountIds || []),
        ]
      );

      logger.info(`Membership type created: ${data.name} (${result.rows[0].id})`);
      return this.rowToMembershipType(result.rows[0]);
    } catch (error) {
      logger.error('Error creating membership type:', error);
      throw error;
    }
  }

  /**
   * Update a membership type
   */
  async updateMembershipType(id: string, data: UpdateMembershipTypeDto): Promise<MembershipType> {
    try {
      // Get existing membership type
      const existing = await this.getMembershipTypeById(id);
      if (!existing) {
        throw new Error('Membership type not found');
      }

      // Validate rolling membership configuration
      const isRolling = data.isRollingMembership !== undefined ? data.isRollingMembership : existing.isRollingMembership;
      const numberOfMonths = data.numberOfMonths !== undefined ? data.numberOfMonths : existing.numberOfMonths;
      const validUntil = data.validUntil !== undefined ? data.validUntil : existing.validUntil;

      if (isRolling && !numberOfMonths) {
        throw new Error('Number of months is required for rolling memberships');
      }
      if (!isRolling && !validUntil) {
        throw new Error('Valid until date is required for fixed-period memberships');
      }

      // Validate group membership configuration
      const category = data.membershipTypeCategory || existing.membershipTypeCategory;
      if (category === 'group') {
        const maxPeople = data.maxPeopleInApplication !== undefined ? data.maxPeopleInApplication : existing.maxPeopleInApplication;
        const minPeople = data.minPeopleInApplication !== undefined ? data.minPeopleInApplication : existing.minPeopleInApplication;

        if (!maxPeople || maxPeople < 1) {
          throw new Error('Max people in application must be at least 1 for group memberships');
        }
        if (!minPeople || minPeople < 1) {
          throw new Error('Min people in application must be at least 1 for group memberships');
        }
        if (minPeople > maxPeople) {
          throw new Error('Min people cannot be greater than max people');
        }
      }

      // Validate terms and conditions
      const useTerms = data.useTermsAndConditions !== undefined ? data.useTermsAndConditions : existing.useTermsAndConditions;
      const termsText = data.termsAndConditions !== undefined ? data.termsAndConditions : existing.termsAndConditions;
      if (useTerms && !termsText) {
        throw new Error('Terms and conditions text is required when use terms and conditions is enabled');
      }

      // Validate discount IDs if provided
      if (data.discountIds && data.discountIds.length > 0) {
        const validationResult = await this.validateDiscountIds(data.discountIds, existing.organisationId);
        if (!validationResult.valid) {
          const error = new Error('Discount validation failed') as any;
          error.validationErrors = validationResult.errors;
          throw error;
        }
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
      if (data.membershipFormId !== undefined) {
        updates.push(`membership_form_id = $${paramCount++}`);
        values.push(data.membershipFormId);
      }
      if (data.membershipStatus !== undefined) {
        updates.push(`membership_status = $${paramCount++}`);
        values.push(data.membershipStatus);
      }
      if (data.isRollingMembership !== undefined) {
        updates.push(`is_rolling_membership = $${paramCount++}`);
        values.push(data.isRollingMembership);
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
      if (data.memberLabels !== undefined) {
        updates.push(`member_labels = $${paramCount++}`);
        values.push(JSON.stringify(data.memberLabels));
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
      if (data.membershipTypeCategory !== undefined) {
        updates.push(`membership_type_category = $${paramCount++}`);
        values.push(data.membershipTypeCategory);
      }
      if (data.maxPeopleInApplication !== undefined) {
        updates.push(`max_people_in_application = $${paramCount++}`);
        values.push(data.maxPeopleInApplication || null);
      }
      if (data.minPeopleInApplication !== undefined) {
        updates.push(`min_people_in_application = $${paramCount++}`);
        values.push(data.minPeopleInApplication || null);
      }
      if (data.personTitles !== undefined) {
        updates.push(`person_titles = $${paramCount++}`);
        values.push(data.personTitles ? JSON.stringify(data.personTitles) : null);
      }
      if (data.personLabels !== undefined) {
        updates.push(`person_labels = $${paramCount++}`);
        values.push(data.personLabels ? JSON.stringify(data.personLabels) : null);
      }
      if (data.fieldConfiguration !== undefined) {
        updates.push(`field_configuration = $${paramCount++}`);
        values.push(data.fieldConfiguration ? JSON.stringify(data.fieldConfiguration) : null);
      }

      if (data.discountIds !== undefined) {
        updates.push(`discount_ids = ${paramCount++}`);
        values.push(JSON.stringify(data.discountIds));
      }

      values.push(id);

      const result = await db.query(
        `UPDATE membership_types 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Membership type not found');
      }

      logger.info(`Membership type updated: ${id}`);
      return this.rowToMembershipType(result.rows[0]);
    } catch (error) {
      logger.error('Error updating membership type:', error);
      throw error;
    }
  }

  /**
   * Delete a membership type
   */
  async deleteMembershipType(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM membership_types WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Membership type not found');
      }

      logger.info(`Membership type deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting membership type:', error);
      throw error;
    }
  }

  /**
   * Get all members for an organisation
   */
  async getMembersByOrganisation(organisationId: string): Promise<Member[]> {
    try {
      const result = await db.query(
        `SELECT * FROM members 
         WHERE organisation_id = $1 
         ORDER BY date_last_renewed DESC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToMember(row));
    } catch (error) {
      logger.error('Error getting members by organisation:', error);
      throw error;
    }
  }

  /**
   * Get member by ID
   */
  async getMemberById(id: string): Promise<Member | null> {
    try {
      const result = await db.query(
        'SELECT * FROM members WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToMember(result.rows[0]);
    } catch (error) {
      logger.error('Error getting member by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new member
   */
  async createMember(data: CreateMemberDto): Promise<Member> {
    try {
      // Validate membership type exists
      const membershipType = await this.getMembershipTypeById(data.membershipTypeId);
      if (!membershipType) {
        throw new Error('Membership type not found');
      }

      // Validate form submission exists
      const formSubmission = await this.formSubmissionService.getSubmissionById(data.formSubmissionId);
      if (!formSubmission) {
        throw new Error('Form submission not found');
      }

      // Validate required fields
      if (!data.firstName || data.firstName.trim() === '') {
        throw new Error('First name is required');
      }
      if (!data.lastName || data.lastName.trim() === '') {
        throw new Error('Last name is required');
      }

      // Determine status based on automaticallyApprove flag
      const status = membershipType.automaticallyApprove ? 'active' : 'pending';

      // Calculate valid until date
      const validUntil = this.calculateValidUntil(membershipType);

      // Retry logic for handling unique constraint violations on membership_number
      const maxRetries = 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Generate membership number
          const membershipNumber = await this.generateMembershipNumber(data.organisationId);

          // Create member record
          const result = await db.query(
            `INSERT INTO members
             (organisation_id, membership_type_id, user_id, membership_number,
              first_name, last_name, form_submission_id, status, valid_until, payment_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              data.organisationId,
              data.membershipTypeId,
              data.userId,
              membershipNumber,
              data.firstName.trim(),
              data.lastName.trim(),
              data.formSubmissionId,
              status,
              validUntil,
              'pending',
            ]
          );

          logger.info(`Member created: ${result.rows[0].id} (${membershipNumber})`);
          return this.rowToMember(result.rows[0]);
        } catch (error: any) {
          // Check if it's a unique constraint violation on membership_number
          if (error.code === '23505' && error.constraint === 'members_membership_number_key') {
            logger.warn(`Membership number collision detected, retrying (attempt ${attempt + 1}/${maxRetries})`);
            // Wait a small random amount before retrying to reduce collision probability
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            continue;
          }
          // If it's a different error, throw immediately
          throw error;
        }
      }

      // If we exhausted all retries, throw an error
      throw new Error(`Failed to create member after ${maxRetries} attempts due to membership number collision`);
    } catch (error) {
      logger.error('Error creating member:', error);
      throw error;
    }
  }

  /**
   * Generate a unique membership number
   * Format: {ORG_PREFIX}-{YEAR}-{SEQUENCE}
   */
  private async generateMembershipNumber(organisationId: string): Promise<string> {
    try {
      // Get organization name and create prefix from it
      const orgResult = await db.query(
        'SELECT name FROM organizations WHERE id = $1',
        [organisationId]
      );
      
      // Create prefix from organization name (first 3-4 uppercase letters)
      const orgName = orgResult.rows[0]?.name || 'ORG';
      const prefix = orgName
        .toUpperCase()
        .replace(/[^A-Z]/g, '') // Remove non-letters
        .substring(0, 4) // Take first 4 letters
        || 'ORG'; // Fallback if no letters found

      // Get current year
      const year = new Date().getFullYear();

      // Get next sequence number for this year
      const countResult = await db.query(
        `SELECT COUNT(*) as count FROM members
         WHERE organisation_id = $1
         AND EXTRACT(YEAR FROM created_at) = $2`,
        [organisationId, year]
      );
      const sequence = (parseInt(countResult.rows[0].count) + 1)
        .toString()
        .padStart(5, '0');

      return `${prefix}-${year}-${sequence}`;
    } catch (error) {
      logger.error('Error generating membership number:', error);
      throw error;
    }
  }

  /**
   * Calculate valid until date based on membership type configuration
   */
  private calculateValidUntil(membershipType: MembershipType): Date {
    if (membershipType.isRollingMembership && membershipType.numberOfMonths) {
      // Rolling membership: add months from today
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + membershipType.numberOfMonths);
      return validUntil;
    } else if (membershipType.validUntil) {
      // Fixed date membership
      return new Date(membershipType.validUntil);
    } else {
      // Default: 1 year from today
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      return validUntil;
    }
  }


  /**
   * Validate discount IDs for membership type association
   * Checks existence, organization ownership, and moduleType
   */
  async validateDiscountIds(
    discountIds: string[],
    organisationId: string
  ): Promise<DiscountValidationResult> {
    const errors: Array<{
      discountId: string;
      reason: 'not_found' | 'wrong_organisation' | 'wrong_module_type' | 'inactive';
      message: string;
    }> = [];

    // If empty array, return valid
    if (!discountIds || discountIds.length === 0) {
      return { valid: true, errors: [] };
    }

    try {
      // Batch query all discounts using WHERE id = ANY($1)
      const result = await db.query(
        `SELECT id, organisation_id, module_type, status
         FROM discounts
         WHERE id = ANY($1)`,
        [discountIds]
      );

      // Create a map of found discounts for quick lookup
      const foundDiscounts = new Map(
        result.rows.map(row => [row.id, row])
      );

      // Validate each discount ID
      for (const discountId of discountIds) {
        const discount = foundDiscounts.get(discountId);

        if (!discount) {
          // Discount does not exist
          errors.push({
            discountId,
            reason: 'not_found',
            message: `Discount with ID '${discountId}' does not exist`
          });
        } else if (discount.organisation_id !== organisationId) {
          // Discount belongs to different organization
          errors.push({
            discountId,
            reason: 'wrong_organisation',
            message: `Discount with ID '${discountId}' belongs to a different organisation`
          });
        } else if (discount.module_type !== 'memberships') {
          // Discount has wrong moduleType
          errors.push({
            discountId,
            reason: 'wrong_module_type',
            message: `Discount with ID '${discountId}' has moduleType '${discount.module_type}', expected 'memberships'`
          });
        } else if (discount.status === 'inactive') {
          // Discount is inactive
          errors.push({
            discountId,
            reason: 'inactive',
            message: `Discount with ID '${discountId}' is inactive`
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error('Error validating discount IDs:', error);
      throw error;
    }
  }

}

// Create singleton instance
export const membershipService = new MembershipService();
