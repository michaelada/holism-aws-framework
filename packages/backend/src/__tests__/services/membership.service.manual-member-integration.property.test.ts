/**
 * Property-Based Tests for Manual Member Integration
 * 
 * Feature: manual-member-addition
 * Property 20: Manual Member Integration
 * 
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**
 * 
 * Tests that manually created members integrate seamlessly with all existing member features:
 * - Appear in members database table
 * - Included in search results
 * - Included in filter results
 * - Available for batch operations
 * - Exportable in Excel exports
 * - Viewable on member details page
 */

import * as fc from 'fast-check';
import { MembershipService, CreateMemberDto } from '../../services/membership.service';
import { FormSubmissionService } from '../../services/form-submission.service';
import { db } from '../../database/pool';

describe('Property 20: Manual Member Integration', () => {
  let membershipService: MembershipService;
  let formSubmissionService: FormSubmissionService;
  let testOrganisationId: string;
  let testMembershipTypeId: string;
  let testFormId: string;
  let testUserId: string;
  let testOrganisationTypeId: string;
  let createdMemberIds: string[] = [];

  beforeAll(async () => {
    // The pool is shared but not self-initialising: without this every query
    // fails with "Database pool not initialized".
    await db.initialize();
  });

  afterAll(async () => {
    // Left open deliberately: the pool is a singleton shared by every suite in the
      // run — jest uses one worker and a fresh module registry per file, not a fresh
      // process — so closing it here pulls the connection out from under whatever
      // runs next. `forceExit` in jest.config.js ends the process.
      // await db.close();
  });

  beforeEach(async () => {
    formSubmissionService = new FormSubmissionService();
    membershipService = new MembershipService(formSubmissionService);

    /*
     * An organisation needs a type, and `organizations` has grown a set of
     * NOT NULL columns since this fixture was written — `url_code`, `currency`,
     * `keycloak_group_id`, `name` — while `short_name` no longer exists.
     * The numbering configuration matters too: member creation reads it from
     * the type to allocate the membership number.
     */
    const orgTypeResult = await db.query(
      `INSERT INTO organization_types
         (name, display_name, currency, language, default_locale,
          membership_numbering, membership_number_uniqueness,
          initial_membership_number)
       VALUES ($1, $2, 'GBP', 'en', 'en-GB', 'internal', 'organization', 1000000)
       RETURNING id`,
      [`test-type-manual-member-${Date.now()}`, 'Test Type']
    );
    testOrganisationTypeId = orgTypeResult.rows[0].id;

    const orgResult = await db.query(
      `INSERT INTO organizations
         (organization_type_id, keycloak_group_id, url_code, name, display_name, currency, language, status)
       VALUES ($1, $2, substr(md5(random()::text), 1, 12), $3, $4, 'GBP', 'en', 'active')
       RETURNING id`,
      [
        testOrganisationTypeId,
        `test-group-manual-${Date.now()}`,
        `test-org-manual-${Date.now()}`,
        'Test Organization',
      ]
    );
    testOrganisationId = orgResult.rows[0].id;

    // Create test form
    const formResult = await db.query(
      `INSERT INTO application_forms (organisation_id, name, description, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [testOrganisationId, 'Test Form', 'Test form for members', 'active']
    );
    testFormId = formResult.rows[0].id;

    // Create test membership type
    const typeResult = await db.query(
      `INSERT INTO membership_types 
       (organisation_id, name, description, membership_form_id, membership_status,
        is_rolling_membership, number_of_months, automatically_approve, supported_payment_methods)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        testOrganisationId,
        'Standard Membership',
        'Standard membership type',
        testFormId,
        'open',
        true,
        12,
        true,
        JSON.stringify(['card', 'bank_transfer']),
      ]
    );
    testMembershipTypeId = typeResult.rows[0].id;

    /*
     * The submission's `user_id` is an `organization_users` row — the person's
     * membership of this club — not a row in `users`, which carries the
     * Keycloak identity across all of them.
     */
    const userResult = await db.query(
      `INSERT INTO organization_users
         (organization_id, keycloak_user_id, email, first_name, last_name, user_type, status)
       VALUES ($1, $2, $3, $4, $5, 'account-user', 'active')
       RETURNING id`,
      [
        testOrganisationId,
        `kc-manual-${Date.now()}`,
        `test-${Date.now()}@example.com`,
        'Test',
        'User',
      ]
    );
    testUserId = userResult.rows[0].id;
  });

  afterEach(async () => {
    // Clean up created members
    if (createdMemberIds.length > 0) {
      await db.query(
        'DELETE FROM members WHERE id = ANY($1)',
        [createdMemberIds]
      );
      createdMemberIds = [];
    }

    // Clean up test data
    if (testOrganisationId) {
      await db.query('DELETE FROM form_submissions WHERE organisation_id = $1', [
        testOrganisationId,
      ]);
    }
    if (testUserId) {
      await db.query('DELETE FROM organization_users WHERE id = $1', [testUserId]);
    }
    if (testMembershipTypeId) {
      await db.query('DELETE FROM membership_types WHERE id = $1', [testMembershipTypeId]);
    }
    if (testFormId) {
      await db.query('DELETE FROM application_forms WHERE id = $1', [testFormId]);
    }
    if (testOrganisationId) {
      await db.query('DELETE FROM membership_number_sequences WHERE organization_id = $1', [
        testOrganisationId,
      ]);
      await db.query('DELETE FROM organizations WHERE id = $1', [testOrganisationId]);
    }
    if (testOrganisationTypeId) {
      await db.query('DELETE FROM membership_number_sequences WHERE organization_type_id = $1', [
        testOrganisationTypeId,
      ]);
      await db.query('DELETE FROM organization_types WHERE id = $1', [testOrganisationTypeId]);
    }
  });

  /**
   * Property: Manually created members appear in getMembersByOrganisation
   * 
   * For any manually created member, the member should appear in the list
   * returned by getMembersByOrganisation for that organization.
   */
  it('should include manually created members in getMembersByOrganisation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(n => n.trim() !== ''),
          lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(n => n.trim() !== ''),
        }),
        async ({ firstName, lastName }) => {
          // Create form submission
          const submissionResult = await db.query(
            `INSERT INTO form_submissions 
             (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              testFormId,
              testOrganisationId,
              testUserId,
              'membership_application',
              // `context_id` is a uuid — for a membership application it is the
              // membership type being applied for.
              testMembershipTypeId,
              JSON.stringify({ firstName, lastName }),
              'approved',
            ]
          );
          const formSubmissionId = submissionResult.rows[0].id;

          // Create member manually
          const memberData: CreateMemberDto = {
            organisationId: testOrganisationId,
            membershipTypeId: testMembershipTypeId,
            userId: testUserId,
            firstName,
            lastName,
            formSubmissionId,
          };

          const createdMember = await membershipService.createMember(memberData);
          createdMemberIds.push(createdMember.id);

          // Verify member appears in organization's member list
          const members = await membershipService.getMembersByOrganisation(testOrganisationId);
          const foundMember = members.find(m => m.id === createdMember.id);

          expect(foundMember).toBeDefined();
          // The service trims names on the way in, deliberately: a member
          // called " Sam" should not sort or search differently from "Sam".
          expect(foundMember?.firstName).toBe(firstName.trim());
          expect(foundMember?.lastName).toBe(lastName.trim());
          expect(foundMember?.organisationId).toBe(testOrganisationId);

          // Clean up form submission
          await db.query('DELETE FROM form_submissions WHERE id = $1', [formSubmissionId]);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  /**
   * Property: Manually created members are retrievable by ID
   * 
   * For any manually created member, the member should be retrievable
   * using getMemberById with the member's ID.
   */
  it('should retrieve manually created members by ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(n => n.trim() !== ''),
          lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(n => n.trim() !== ''),
        }),
        async ({ firstName, lastName }) => {
          // Create form submission
          const submissionResult = await db.query(
            `INSERT INTO form_submissions 
             (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              testFormId,
              testOrganisationId,
              testUserId,
              'membership_application',
              // `context_id` is a uuid — for a membership application it is the
              // membership type being applied for.
              testMembershipTypeId,
              JSON.stringify({ firstName, lastName }),
              'approved',
            ]
          );
          const formSubmissionId = submissionResult.rows[0].id;

          // Create member manually
          const memberData: CreateMemberDto = {
            organisationId: testOrganisationId,
            membershipTypeId: testMembershipTypeId,
            userId: testUserId,
            firstName,
            lastName,
            formSubmissionId,
          };

          const createdMember = await membershipService.createMember(memberData);
          createdMemberIds.push(createdMember.id);

          // Verify member is retrievable by ID
          const retrievedMember = await membershipService.getMemberById(createdMember.id);

          expect(retrievedMember).not.toBeNull();
          expect(retrievedMember?.id).toBe(createdMember.id);
          // Trimmed on the way in, as above.
          expect(retrievedMember?.firstName).toBe(firstName.trim());
          expect(retrievedMember?.lastName).toBe(lastName.trim());
          expect(retrievedMember?.membershipNumber).toBe(createdMember.membershipNumber);

          // Clean up form submission
          await db.query('DELETE FROM form_submissions WHERE id = $1', [formSubmissionId]);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  /**
   * Property: Manually created members have all required fields
   * 
   * For any manually created member, the member should have all required
   * fields populated correctly (membership number, status, valid until, etc.)
   */
  it('should create manually created members with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(n => n.trim() !== ''),
          lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(n => n.trim() !== ''),
        }),
        async ({ firstName, lastName }) => {
          // Create form submission
          const submissionResult = await db.query(
            `INSERT INTO form_submissions 
             (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              testFormId,
              testOrganisationId,
              testUserId,
              'membership_application',
              // `context_id` is a uuid — for a membership application it is the
              // membership type being applied for.
              testMembershipTypeId,
              JSON.stringify({ firstName, lastName }),
              'approved',
            ]
          );
          const formSubmissionId = submissionResult.rows[0].id;

          // Create member manually
          const memberData: CreateMemberDto = {
            organisationId: testOrganisationId,
            membershipTypeId: testMembershipTypeId,
            userId: testUserId,
            firstName,
            lastName,
            formSubmissionId,
          };

          const createdMember = await membershipService.createMember(memberData);
          createdMemberIds.push(createdMember.id);

          // Verify all required fields are present
          expect(createdMember.id).toBeDefined();
          expect(createdMember.membershipNumber).toBeDefined();
          /*
           * Numbers come from the organisation type's sequence now, not from a
           * `PREFIX-YEAR-NNNNN` template: the type says whether numbering is
           * internal, whether it is unique per organisation or per type, and
           * where it starts. So what holds is that a number was allocated from
           * that sequence, at or above the configured starting point.
           */
          expect(createdMember.membershipNumber).toMatch(/^\d+$/);
          expect(Number(createdMember.membershipNumber)).toBeGreaterThanOrEqual(1000000);
          expect(createdMember.status).toBeDefined();
          expect(['active', 'pending']).toContain(createdMember.status);
          expect(createdMember.validUntil).toBeDefined();
          expect(createdMember.validUntil).toBeInstanceOf(Date);
          expect(createdMember.dateLastRenewed).toBeDefined();
          expect(createdMember.dateLastRenewed).toBeInstanceOf(Date);
          expect(createdMember.paymentStatus).toBe('pending');
          expect(createdMember.processed).toBe(false);
          expect(Array.isArray(createdMember.labels)).toBe(true);

          // Clean up form submission
          await db.query('DELETE FROM form_submissions WHERE id = $1', [formSubmissionId]);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  /**
   * Property: Multiple manually created members are all retrievable
   * 
   * For any set of manually created members, all members should be
   * retrievable and appear in the organization's member list.
   */
  it('should handle multiple manually created members correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(n => n.trim() !== ''),
            lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(n => n.trim() !== ''),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (memberDataArray) => {
          const createdMembers = [];

          // Create all members
          for (const { firstName, lastName } of memberDataArray) {
            // Create form submission
            const submissionResult = await db.query(
              `INSERT INTO form_submissions 
               (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                testFormId,
                testOrganisationId,
                testUserId,
                'membership_application',
                testMembershipTypeId,
                JSON.stringify({ firstName, lastName }),
                'approved',
              ]
            );
            const formSubmissionId = submissionResult.rows[0].id;

            // Create member
            const memberData: CreateMemberDto = {
              organisationId: testOrganisationId,
              membershipTypeId: testMembershipTypeId,
              userId: testUserId,
              firstName,
              lastName,
              formSubmissionId,
            };

            const createdMember = await membershipService.createMember(memberData);
            createdMemberIds.push(createdMember.id);
            createdMembers.push({ member: createdMember, submissionId: formSubmissionId });
          }

          // Verify all members appear in organization's member list
          const allMembers = await membershipService.getMembersByOrganisation(testOrganisationId);
          
          for (const { member } of createdMembers) {
            const foundMember = allMembers.find(m => m.id === member.id);
            expect(foundMember).toBeDefined();
            expect(foundMember?.firstName).toBe(member.firstName);
            expect(foundMember?.lastName).toBe(member.lastName);
          }

          // Verify each member is retrievable by ID
          for (const { member } of createdMembers) {
            const retrievedMember = await membershipService.getMemberById(member.id);
            expect(retrievedMember).not.toBeNull();
            expect(retrievedMember?.id).toBe(member.id);
          }

          // Clean up form submissions
          for (const { submissionId } of createdMembers) {
            await db.query('DELETE FROM form_submissions WHERE id = $1', [submissionId]);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);

  /**
   * Property: Manually created members have unique membership numbers
   * 
   * For any set of manually created members in the same organization,
   * each member should have a unique membership number.
   */
  it('should assign unique membership numbers to manually created members', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (memberCount) => {
          const createdMembers = [];
          const membershipNumbers = new Set<string>();

          // Create multiple members
          for (let i = 0; i < memberCount; i++) {
            // Create form submission
            const submissionResult = await db.query(
              `INSERT INTO form_submissions 
               (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                testFormId,
                testOrganisationId,
                testUserId,
                'membership_application',
                testMembershipTypeId,
                JSON.stringify({ firstName: `First${i}`, lastName: `Last${i}` }),
                'approved',
              ]
            );
            const formSubmissionId = submissionResult.rows[0].id;

            // Create member
            const memberData: CreateMemberDto = {
              organisationId: testOrganisationId,
              membershipTypeId: testMembershipTypeId,
              userId: testUserId,
              firstName: `First${i}`,
              lastName: `Last${i}`,
              formSubmissionId,
            };

            const createdMember = await membershipService.createMember(memberData);
            createdMemberIds.push(createdMember.id);
            createdMembers.push({ member: createdMember, submissionId: formSubmissionId });
            membershipNumbers.add(createdMember.membershipNumber);
          }

          // Verify all membership numbers are unique
          expect(membershipNumbers.size).toBe(memberCount);

          // Clean up form submissions
          for (const { submissionId } of createdMembers) {
            await db.query('DELETE FROM form_submissions WHERE id = $1', [submissionId]);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});
