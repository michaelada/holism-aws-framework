import { db } from '../database/pool';
import { logger } from '../config/logger';
import { Workbook } from 'exceljs';
import { formatAnswer } from '../utils/form-summary';
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
  fee: number;
  handlingFeeIncluded: boolean;
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
  membershipTypeName?: string; // Optional: membership type name for display
  userId: string;
  membershipNumber: string;
  name?: string; // Optional: member name from form submission
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
  fee?: number;
  handlingFeeIncluded?: boolean;
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
  fee?: number;
  handlingFeeIncluded?: boolean;
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
  membershipNumber?: string; // Optional: provided only in external mode
}

/**
 * Internal configuration for membership numbering
 */
interface MembershipNumberConfig {
  mode: 'internal' | 'external';
  uniqueness: 'organization_type' | 'organization';
  initialNumber: number;
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
      fee: parseFloat(row.fee) || 0,
      handlingFeeIncluded: row.handling_fee_included || false,
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
      membershipTypeName: row.membership_type_name, // Add membership type name
      userId: row.user_id,
      membershipNumber: row.membership_number,
      name: row.member_name, // Add member name from form submission
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
         WHERE organisation_id = $1 AND deleted = FALSE
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
        'SELECT * FROM membership_types WHERE id = $1 AND deleted = FALSE',
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
          person_titles, person_labels, field_configuration, discount_ids,
          fee, handling_fee_included)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
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
          data.fee ?? 0,
          data.handlingFeeIncluded ?? false,
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
        updates.push(`discount_ids = $${paramCount++}`);
        values.push(JSON.stringify(data.discountIds));
      }
      if (data.fee !== undefined) {
        updates.push(`fee = $${paramCount++}`);
        values.push(data.fee);
      }
      if (data.handlingFeeIncluded !== undefined) {
        updates.push(`handling_fee_included = $${paramCount++}`);
        values.push(data.handlingFeeIncluded);
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
  /**
   * Withdraw a membership type.
   *
   * Soft delete: `members` reference these rows: a type an organisation stops offering is still the type last season's members hold.
   */
  async deleteMembershipType(id: string, deletedBy?: string): Promise<void> {
    try {
      const result = await db.query(
        `UPDATE membership_types
         SET deleted = TRUE, deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
         WHERE id = $1 AND deleted = FALSE`,
        [id, deletedBy ?? null]
      );

      if (result.rowCount === 0) {
        throw new Error('Membership type not found or already deleted');
      }

      logger.info(`Membership type withdrawn: ${id}`);
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
        `SELECT m.*, mt.name as membership_type_name, fs.submission_data->>'name' as member_name
         FROM members m
         LEFT JOIN membership_types mt ON m.membership_type_id = mt.id
         LEFT JOIN form_submissions fs ON m.form_submission_id = fs.id
         WHERE m.organisation_id = $1 
         ORDER BY m.date_last_renewed DESC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToMember(row));
    } catch (error) {
      logger.error('Error getting members by organisation:', error);
      throw error;
    }
  }

  /**
   * A date-only value, as `yyyy-mm-dd`, from its **local** parts.
   *
   * `date_last_renewed` and `valid_until` are Postgres `date` columns, which
   * node-postgres hands back as a Date at **local midnight** — so a renewal on
   * 12 July in Ireland arrives as `2026-07-11T23:00:00.000Z`. Written into a
   * cell as a Date, exceljs keeps that instant and Excel displays **11 July**:
   * every renewal and expiry in the workbook a day early through the summer,
   * and correct in the winter, which is the worst kind of wrong because it
   * looks fine when you check it in January.
   *
   * A string of the local parts cannot shift, and `yyyy-mm-dd` still sorts
   * chronologically as text. It is the same rule the audit viewer follows:
   * render a date-only value without an invented midnight.
   */
  private static dateOnly(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  /** The fields of each membership type's form, in the form's own order. */
  private async formFieldsByMembershipType(
    organisationId: string
  ): Promise<Map<string, Array<{ name: string; label: string }>>> {
    const result = await db.query(
      `SELECT mt.id AS membership_type_id, af.name AS field_name, af.label
         FROM membership_types mt
         JOIN application_form_fields aff ON aff.form_id = mt.membership_form_id
         JOIN application_fields af ON af.id = aff.field_id
        WHERE mt.organisation_id = $1
        ORDER BY mt.id, aff."order"`,
      [organisationId]
    );

    const fields = new Map<string, Array<{ name: string; label: string }>>();
    for (const row of result.rows) {
      const forType = fields.get(row.membership_type_id) ?? [];
      forType.push({ name: row.field_name, label: row.label || row.field_name });
      fields.set(row.membership_type_id, forType);
    }
    return fields;
  }

  /** What each member's application holds, by submission id. */
  private async membershipSubmissions(
    submissionIds: Array<string | null | undefined>
  ): Promise<Map<string, Record<string, unknown>>> {
    const ids = [...new Set(submissionIds.filter(Boolean))] as string[];
    if (ids.length === 0) return new Map();

    const result = await db.query(
      `SELECT id, submission_data FROM form_submissions WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    return new Map(result.rows.map((row: any) => [row.id, row.submission_data ?? {}]));
  }

  /**
   * The member database as a workbook, **one sheet per membership type**.
   *
   * ## Why it is not one table
   *
   * Each sheet carries a column for **every field of that type's membership
   * form**, and a row per member with what they answered. A club exporting its
   * roster is nearly always after those answers — the dietary requirement, the
   * emergency contact, the boat class — and the export used to carry twelve
   * fixed columns and none of them.
   *
   * The columns therefore belong to the **form**, and two membership types may
   * ask entirely different questions. One flat table could only hold the union
   * of every form's fields, which gives every member a row of blanks under
   * questions their own application never asked. So the workbook splits, on the
   * same principle as the entries export
   * (`eventEntryService.exportEntriesToExcel`, one sheet per activity).
   *
   * **Per type rather than per form.** Two types that share a form still get a
   * sheet each. A membership type is the thing a club recognises and filters
   * by; a sheet named after a form would be a name most administrators have
   * never seen, and merging Adult with Family because they happen to share
   * questions produces a table neither of them is.
   *
   * ## It exports what the administrator is looking at
   *
   * `memberIds` is the list the screen is showing — after its status filter,
   * its search box and whichever saved filter is applied. Those are all
   * evaluated **in the browser** over the members already loaded, so there is
   * no server-side query that could reproduce them; re-deriving them here would
   * mean a second implementation of every filter rule, and two implementations
   * of one rule is how the two quietly stop agreeing.
   *
   * Absent or empty, every member of the organisation is exported — which is
   * what an unfiltered screen is showing anyway.
   *
   * ## The ids are not trusted
   *
   * `organisation_id = $1` is in the statement, so an id belonging to another
   * club selects nothing rather than exporting somebody else's member. The
   * caller's right to this organisation is established before we get here; this
   * is the second lock.
   */
  async exportMembersToExcel(organisationId: string, memberIds?: string[]): Promise<Buffer> {
    try {
      const narrowed = Array.isArray(memberIds) && memberIds.length > 0;

      const result = await db.query(
        `SELECT m.*, mt.name AS membership_type_name,
                fs.submission_data->>'name' AS member_name
           FROM members m
           LEFT JOIN membership_types mt ON m.membership_type_id = mt.id
           LEFT JOIN form_submissions fs ON m.form_submission_id = fs.id
          WHERE m.organisation_id = $1
            ${narrowed ? 'AND m.id = ANY($2::uuid[])' : ''}
          ORDER BY m.date_last_renewed DESC`,
        narrowed ? [organisationId, memberIds] : [organisationId]
      );

      const members = result.rows.map((row) => this.rowToMember(row));
      const fieldsByType = await this.formFieldsByMembershipType(organisationId);
      const submissions = await this.membershipSubmissions(
        members.map((member) => member.formSubmissionId)
      );

      /*
       * Grouped by membership type **id**, not name. Two types may share a
       * name across a rename, and the columns come from the form — merging
       * them would produce a sheet whose columns belong to neither.
       */
      const byType = new Map<string, { name: string; members: Member[] }>();
      for (const member of members) {
        const group = byType.get(member.membershipTypeId) ?? {
          name: member.membershipTypeName || 'Unknown membership type',
          members: [],
        };
        group.members.push(member);
        byType.set(member.membershipTypeId, group);
      }

      const workbook = new Workbook();
      workbook.creator = 'ItsPlainSailing';
      workbook.created = new Date();

      /*
       * A workbook with no sheets cannot be opened. A club with no members yet,
       * or a filter that matches none, is an ordinary thing to export — so it
       * gets a sheet saying so rather than a file that will not open.
       */
      if (byType.size === 0) {
        const empty = workbook.addWorksheet('Members');
        empty.addRow(['Members']).font = { bold: true, size: 14 };
        empty.addRow([]);
        empty.addRow(['No members match the current filters.']);
      }

      /*
       * Sheet names have to be unique and Excel caps them at 31 characters.
       * Two types can share a name, and exceljs *throws* on the second — losing
       * the whole export rather than a sheet.
       */
      const usedNames = new Set<string>();

      for (const [membershipTypeId, group] of byType) {
        // Excel forbids : \ / ? * [ ] in a sheet name, and caps it at 31.
        const base = group.name.substring(0, 31).replace(/[:\\/?*[\]]/g, '_');
        let sheetName = base || 'Members';
        for (let suffix = 2; usedNames.has(sheetName); suffix += 1) {
          const tail = ` (${suffix})`;
          sheetName = `${base.substring(0, 31 - tail.length)}${tail}`;
        }
        usedNames.add(sheetName);

        const worksheet = workbook.addWorksheet(sheetName);
        const formFields = fieldsByType.get(membershipTypeId) ?? [];

        /*
         * What the sheet is *about* on the left, the administration on the
         * right — the same order the entries export settled on. A club reading
         * a roster wants the number, the name and the answers to its own
         * questions; payment status and method are there to be looked up
         * rather than scanned.
         */
        const headers = [
          'Membership Number',
          'Name',
          'First Name',
          'Last Name',
          ...formFields.map((field) => field.label),
          'Date Last Renewed',
          'Status',
          'Valid Until',
          'Labels',
          'Processed',
          'Payment Status',
          'Payment Method',
        ];

        const titleRow = worksheet.addRow([group.name]);
        titleRow.font = { bold: true, size: 14 };
        worksheet.mergeCells(1, 1, 1, Math.max(headers.length, 1));
        titleRow.alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };

        for (const member of group.members) {
          const answers = member.formSubmissionId
            ? (submissions.get(member.formSubmissionId) ?? {})
            : {};

          worksheet.addRow([
            member.membershipNumber,
            // What the table's Name column shows: the name on the application,
            // falling back to the two parts where a membership predates it.
            member.name || `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim(),
            member.firstName,
            member.lastName,
            /*
             * Blank where a question was not answered — the same helper the
             * member's own screens format answers with, so a "Yes" here and a
             * "Yes" there mean the same thing rather than being `true` in one
             * place and "Yes" in the other.
             */
            ...formFields.map((field) => formatAnswer(answers[field.name])),
            MembershipService.dateOnly(member.dateLastRenewed),
            member.status,
            MembershipService.dateOnly(member.validUntil),
            (member.labels ?? []).join(', '),
            member.processed ? 'Yes' : 'No',
            member.paymentStatus,
            member.paymentMethod || 'N/A',
          ]);
        }

        worksheet.columns = [
          { width: 20 },
          { width: 28 },
          { width: 18 },
          { width: 18 },
          ...formFields.map(() => ({ width: 22 })),
          { width: 18 },
          { width: 12 },
          { width: 15 },
          { width: 30 },
          { width: 12 },
          { width: 15 },
          { width: 15 },
        ];
      }

      const buffer = await workbook.xlsx.writeBuffer();
      logger.info(
        `Exported ${members.length} members to Excel across ${Math.max(byType.size, 1)} sheet(s)`,
        { organisationId }
      );
      // `Buffer.from`, not a cast: `writeBuffer` answers exceljs's own `Buffer`
      // interface, which is not Node's.
      return Buffer.from(buffer as ArrayBuffer);
    } catch (error) {
      logger.error('Error exporting members to Excel:', error);
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

      // Fetch organization to get organization type ID
      const orgResult = await db.query(
        'SELECT organization_type_id FROM organizations WHERE id = $1',
        [data.organisationId]
      );
      
      if (orgResult.rows.length === 0) {
        throw new Error('Organization not found');
      }
      
      const organizationTypeId = orgResult.rows[0].organization_type_id;

      // Fetch organization type configuration
      const orgTypeResult = await db.query(
        `SELECT membership_numbering, membership_number_uniqueness, initial_membership_number
         FROM organization_types WHERE id = $1`,
        [organizationTypeId]
      );

      if (orgTypeResult.rows.length === 0) {
        throw new Error('Organization type not found');
      }

      const orgTypeConfig = orgTypeResult.rows[0];
      const numberingMode = orgTypeConfig.membership_numbering || 'internal';

      // Determine status based on automaticallyApprove flag
      const status = membershipType.automaticallyApprove ? 'active' : 'pending';

      // Calculate valid until date
      const validUntil = this.calculateValidUntil(membershipType);

      let membershipNumber: string;

      // Generate or validate membership number based on mode
      if (numberingMode === 'internal') {
        // Internal mode: Generate membership number using MembershipNumberGenerator
        const { membershipNumberGenerator } = await import('./membership-number-generator.service');
        
        const config: MembershipNumberConfig = {
          mode: 'internal',
          uniqueness: orgTypeConfig.membership_number_uniqueness || 'organization',
          initialNumber: orgTypeConfig.initial_membership_number || 1000000
        };

        membershipNumber = await membershipNumberGenerator.generateWithRetry(
          data.organisationId,
          organizationTypeId,
          config
        );
      } else {
        // External mode: Validate and use provided membership number
        if (!data.membershipNumber || data.membershipNumber.trim() === '') {
          throw new Error('Membership number is required for external numbering mode');
        }
        
        membershipNumber = data.membershipNumber.trim();
        
        // Validate uniqueness using MembershipNumberValidator
        const { membershipNumberValidator } = await import('./membership-number-validator.service');
        
        const uniquenessScope = orgTypeConfig.membership_number_uniqueness || 'organization';
        const validationResult = await membershipNumberValidator.validateUniqueness(
          membershipNumber,
          data.organisationId,
          organizationTypeId,
          uniquenessScope
        );
        
        if (!validationResult.valid) {
          throw new Error(validationResult.error || 'Membership number validation failed');
        }
      }

      // Create member record
      const dateLastRenewed = new Date(); // Set to current date for new members
      
      const result = await db.query(
        `INSERT INTO members
         (organisation_id, membership_type_id, user_id, membership_number,
          first_name, last_name, form_submission_id, status, valid_until, payment_status, date_last_renewed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
          dateLastRenewed,
        ]
      );

      logger.info(`Member created: ${result.rows[0].id} (${membershipNumber})`);
      return this.rowToMember(result.rows[0]);
    } catch (error) {
      logger.error('Error creating member:', error);
      throw error;
    }
  }

  /**
   * Update member details
   */
  async updateMember(id: string, data: { status?: string; processed?: boolean; labels?: string[]; membershipNumber?: string }): Promise<Member> {
    try {
      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }

      if (data.processed !== undefined) {
        updates.push(`processed = $${paramIndex++}`);
        values.push(data.processed);
      }

      if (data.labels !== undefined) {
        updates.push(`labels = $${paramIndex++}`);
        values.push(JSON.stringify(data.labels));
      }

      if (data.membershipNumber !== undefined) {
        // Validate membership number uniqueness before updating
        const existingMember = await db.query(
          `SELECT id FROM members WHERE membership_number = $1 AND id != $2`,
          [data.membershipNumber, id]
        );

        if (existingMember.rows.length > 0) {
          throw new Error(`Membership number ${data.membershipNumber} already exists`);
        }

        updates.push(`membership_number = $${paramIndex++}`);
        values.push(data.membershipNumber);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      // Add updated_at timestamp
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add member ID as last parameter
      values.push(id);

      const result = await db.query(
        `UPDATE members 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Member not found');
      }

      logger.info(`Member updated: ${id}`);
      return this.rowToMember(result.rows[0]);
    } catch (error) {
      logger.error('Error updating member:', error);
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
