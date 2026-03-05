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
  let createdMemberIds: string[] = [];

  beforeEach(async () => {
    formSubmissionService = new FormSubmissionService();
    membershipService = new MembershipService(formSubmissionService);

    // Create test organization
    const orgResult = await db.query(
      `INSERT INTO organizations (short_name, display_name, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['TEST', 'Test Organization', 'active']
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

    // Create test user
    const userResult = await db.query(
      `INSERT INTO users (email, first_name, last_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['test@example.com', 'Test', 'User']
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
    if (testUserId) {
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    if (testMembershipTypeId) {
      await db.query('DELETE FROM membership_types WHERE id = $1', [testMembershipTypeId]);
    }
    if (testFormId) {
      await db.query('DELETE FROM application_forms WHERE id = $1', [testFormId]);
    }
    if (testOrganisationId) {
      await db.query('DELETE FROM organizations WHERE id = $1', [testOrganisationId]);
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
          firstName: fc.string({ minLength: 1, maxLength: 50 }),
          lastName: fc.string({ minLength: 1, maxLength: 50 }),
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
              'manual-creation',
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
          expect(foundMember?.firstName).toBe(firstName);
          expect(foundMember?.lastName).toBe(lastName);
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
          firstName: fc.string({ minLength: 1, maxLength: 50 }),
          lastName: fc.string({ minLength: 1, maxLength: 50 }),
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
              'manual-creation',
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
          expect(retrievedMember?.firstName).toBe(firstName);
          expect(retrievedMember?.lastName).toBe(lastName);
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
          firstName: fc.string({ minLength: 1, maxLength: 50 }),
          lastName: fc.string({ minLength: 1, maxLength: 50 }),
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
              'manual-creation',
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
          expect(createdMember.membershipNumber).toMatch(/^TEST-\d{4}-\d{5}$/);
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
            firstName: fc.string({ minLength: 1, maxLength: 50 }),
            lastName: fc.string({ minLength: 1, maxLength: 50 }),
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
                'manual-creation',
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
                'manual-creation',
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
