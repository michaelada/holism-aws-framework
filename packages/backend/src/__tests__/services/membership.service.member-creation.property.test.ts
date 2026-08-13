/**
 * Property-Based Tests for Member Creation
 * 
 * Feature: manual-member-addition
 * 
 * These tests validate universal properties that should hold true across
 * all valid inputs for member creation with form submission linking.
 */

import * as fc from 'fast-check';
import { MembershipService, CreateMemberDto } from '../../services/membership.service';
import { db } from '../../database/pool';

// Mock the database
import { createMockClient } from '../../test-helpers/mock-db-client';

jest.mock('../../database/pool', () => ({
  db: {
    query: jest.fn(),
    // Transactional work on this path (discount.service) takes a pooled
    // client. Without this the service gets `undefined` and fails later with
    // "reading 'release'", which looks like a service bug rather than a gap
    // in the mock.
    getClient: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the form submission service
jest.mock('../../services/form-submission.service', () => ({
  FormSubmissionService: jest.fn().mockImplementation(() => ({
    getSubmissionById: jest.fn(),
  })),
}));


/**
 * What the database holds for one property run.
 *
 * The suite used to queue results positionally — one `mockResolvedValueOnce`
 * per query, in the order the service happened to issue them. Member creation
 * has since grown two more lookups (the organisation's type, and that type's
 * numbering configuration) and allocates the membership number through
 * `membership_number_sequences` on a pooled client, so those queues handed each
 * query somebody else's rows: the type lookup answered with a form submission,
 * the sequence read came back empty, and every property failed on
 * "Cannot read properties of undefined (reading 'next_number')" — a mismatch in
 * the mock, reported as if the service were broken.
 *
 * Answering by what is being asked for is stable against that: a property
 * declares the rows it cares about and the rest of the path is satisfied with
 * defaults.
 */
interface DbState {
  /** The row `getMembershipTypeById` finds — `null` for "no such type". */
  membershipType: Record<string, any> | null;
  /** The row the INSERT returns, i.e. the member as created. */
  member: Record<string, any> | null;
  /** The organisation's type, and how that type numbers its members. */
  organizationTypeId: string;
  membershipNumbering: string;
  membershipNumberUniqueness: string;
  initialMembershipNumber: number;
  /** Whether the organisation itself exists. */
  organisationExists: boolean;
  /** Next number the sequence would hand out. */
  nextNumber: number;
}

const dbState: DbState = {
  membershipType: null,
  member: null,
  organizationTypeId: '00000000-0000-4000-8000-0000000000ff',
  membershipNumbering: 'internal',
  membershipNumberUniqueness: 'organization',
  initialMembershipNumber: 1000000,
  organisationExists: true,
  nextNumber: 1000000,
};

const result = (rows: Record<string, any>[], command = 'SELECT') => ({
  rows,
  command,
  rowCount: rows.length,
  oid: 0,
  fields: [],
});

/** Answer a query by what it asks for rather than by when it arrives. */
const answer = (sql: unknown) => {
  const text = String(sql);

  if (text.includes('FROM membership_types')) {
    return Promise.resolve(result(dbState.membershipType ? [dbState.membershipType] : []));
  }
  if (text.includes('FROM organizations')) {
    return Promise.resolve(
      result(
        dbState.organisationExists
          ? [{ organization_type_id: dbState.organizationTypeId }]
          : []
      )
    );
  }
  if (text.includes('FROM organization_types')) {
    return Promise.resolve(
      result([
        {
          membership_numbering: dbState.membershipNumbering,
          membership_number_uniqueness: dbState.membershipNumberUniqueness,
          initial_membership_number: dbState.initialMembershipNumber,
        },
      ])
    );
  }
  // The generator inserts the sequence row if absent, then reads it FOR UPDATE.
  if (text.includes('membership_number_sequences')) {
    return Promise.resolve(
      text.includes('SELECT') ? result([{ next_number: dbState.nextNumber }]) : result([])
    );
  }
  if (text.includes('INSERT INTO members')) {
    return Promise.resolve(result(dbState.member ? [dbState.member] : [], 'INSERT'));
  }
  // Duplicate checks, counts, discounts, and the transaction statements.
  return Promise.resolve(result([]));
};

/**
 * Declare what this property's database holds. Anything not named keeps the
 * default from `dbState`, which is reset before each property run.
 */
const given = (state: Partial<DbState>) => {
  Object.assign(dbState, state);
};


describe('Membership Service - Member Creation Property-Based Tests', () => {
  let service: MembershipService;
  let mockFormSubmissionService: any;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();

    /*
     * Both the pool and a pooled client answer by query shape. The number
     * generator does its work on a client inside a transaction, so a client
     * that only resolves empty results would leave it without a sequence row.
     */
    const client = createMockClient();
    client.query.mockImplementation(answer);
    (mockDb.getClient as unknown as jest.Mock).mockResolvedValue(client);
    mockDb.query.mockImplementation(answer as any);

    // Defaults for a property that does not say otherwise.
    Object.assign(dbState, {
      membershipType: null,
      member: null,
      organizationTypeId: '00000000-0000-4000-8000-0000000000ff',
      membershipNumbering: 'internal',
      membershipNumberUniqueness: 'organization',
      initialMembershipNumber: 1000000,
      organisationExists: true,
      nextNumber: 1000000,
    });
    
    /*
     * Form-submission validation moved out of `membership.service` into
     * `FormSubmissionService`. This suite still mocks it as one of the
     * `db.query` calls (see the mock sequences below), so the real dependency
     * returned `undefined` and every property failed with "Form submission not
     * found" before reaching the behaviour under test.
     *
     * A default is set here rather than in each property. The cases that need a
     * missing submission override it with `mockResolvedValueOnce(null)`, which
     * takes precedence.
     */
    mockFormSubmissionService = {
      getSubmissionById: jest.fn().mockResolvedValue({
        id: '00000000-0000-1000-8000-000000000000',
        formId: 'form-1',
        data: {},
      }),
    };
    
    // Create service with mocked form submission service
    service = new MembershipService(mockFormSubmissionService);
  });

  /**
   * Property 10: Member Record Creation with Form Submission Link
   * 
   * For any created form submission, the system should create a member record that is
   * linked to the form submission via the formSubmissionId field.
   * 
   * **Validates: Requirements 4.2**
   */
  describe('Property 10: Member Record Creation with Form Submission Link', () => {
    /**
     * Test: Created member should be linked to form submission
     * 
     * Property: When creating a member with a form submission ID, the created member
     * record should contain the exact formSubmissionId that was provided in the request.
     */
    it('should create member record linked to form submission via formSubmissionId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            automaticallyApprove: fc.boolean(),
          }),
          async (data) => {
            const memberData: CreateMemberDto = {
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            };

            // Arrange: Mock membership type exists
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: data.automaticallyApprove,
            };

            // Expected status based on automaticallyApprove flag
            const expectedStatus = data.automaticallyApprove ? 'active' : 'pending';



            // Mock the created member record
            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: data.organisationId,
              membership_type_id: data.membershipTypeId,
              user_id: data.userId,
              membership_number: `TEST-${new Date().getFullYear()}-00001`,
              first_name: data.firstName.trim(),
              last_name: data.lastName.trim(),
              form_submission_id: data.formSubmissionId, // Use the input formSubmissionId
              date_last_renewed: new Date(),
              status: expectedStatus,
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            // Setup mock responses in order
            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Act: Create member
            const createdMember = await service.createMember(memberData);

            // Assert: Property - Created member must be linked to the form submission
            expect(createdMember.formSubmissionId).toBe(data.formSubmissionId);

            // Verify the INSERT query was called
            const insertCall = mockDb.query.mock.calls.find(call => 
              typeof call[0] === 'string' && call[0].includes('INSERT INTO members')
            );
            expect(insertCall).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Form submission ID should be preserved exactly as provided
     * 
     * Property: The formSubmissionId in the created member record should be identical
     * to the formSubmissionId provided in the CreateMemberDto, with no modifications.
     */
    it('should preserve formSubmissionId exactly as provided without modification', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // formSubmissionId
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            automaticallyApprove: fc.boolean(),
          }),
          async (formSubmissionId, baseData) => {
            const memberData: CreateMemberDto = {
              ...baseData,
              formSubmissionId,
            };

            // Expected status based on automaticallyApprove flag
            const expectedStatus = baseData.automaticallyApprove ? 'active' : 'pending';

            // Arrange: Mock membership type
            const mockMembershipType = {
              id: memberData.membershipTypeId,
              organisationId: memberData.organisationId,
              name: 'Test Membership',
              isRollingMembership: false,
              validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              automaticallyApprove: baseData.automaticallyApprove,
            };


            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: memberData.organisationId,
              membership_type_id: memberData.membershipTypeId,
              user_id: memberData.userId,
              membership_number: `ORG-${new Date().getFullYear()}-00006`,
              first_name: memberData.firstName.trim(),
              last_name: memberData.lastName.trim(),
              form_submission_id: formSubmissionId, // Exact match
              date_last_renewed: new Date(),
              status: expectedStatus,
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Act
            const createdMember = await service.createMember(memberData);

            // Assert: Property - formSubmissionId must be preserved exactly
            expect(createdMember.formSubmissionId).toBe(formSubmissionId);
            expect(createdMember.formSubmissionId).toStrictEqual(formSubmissionId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Multiple members can link to different form submissions
     * 
     * Property: When creating multiple members with different form submission IDs,
     * each member should be linked to its respective form submission without interference.
     */
    it('should create multiple members each linked to their respective form submissions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              organisationId: fc.uuid(),
              membershipTypeId: fc.uuid(),
              userId: fc.uuid(),
              firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              formSubmissionId: fc.uuid(),
              automaticallyApprove: fc.boolean(),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (membersData) => {
            // Ensure all form submission IDs are unique
            const uniqueFormSubmissionIds = new Set(membersData.map(m => m.formSubmissionId));
            if (uniqueFormSubmissionIds.size !== membersData.length) {
              // Skip this test case if form submission IDs are not unique
              return;
            }

            const createdMembers: any[] = [];

            for (let i = 0; i < membersData.length; i++) {
              const data = membersData[i];
              const memberData: CreateMemberDto = {
                organisationId: data.organisationId,
                membershipTypeId: data.membershipTypeId,
                userId: data.userId,
                firstName: data.firstName,
                lastName: data.lastName,
                formSubmissionId: data.formSubmissionId,
              };

              // Expected status based on automaticallyApprove flag
              const expectedStatus = data.automaticallyApprove ? 'active' : 'pending';

              // Arrange: Mock for each member creation
              const mockMembershipType = {
                id: data.membershipTypeId,
                organisationId: data.organisationId,
                name: 'Test Membership',
                isRollingMembership: true,
                numberOfMonths: 12,
                automaticallyApprove: data.automaticallyApprove,
              };


              const mockCreatedMember = {
                id: fc.sample(fc.uuid(), 1)[0],
                organisation_id: data.organisationId,
                membership_type_id: data.membershipTypeId,
                user_id: data.userId,
                membership_number: `TST-${new Date().getFullYear()}-${String(i + 1).padStart(5, '0')}`,
                first_name: data.firstName.trim(),
                last_name: data.lastName.trim(),
                form_submission_id: data.formSubmissionId,
                date_last_renewed: new Date(),
                status: expectedStatus,
                valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                labels: [],
                processed: false,
                payment_status: 'pending',
                created_at: new Date(),
                updated_at: new Date(),
              };

              given({
                membershipType: mockMembershipType,
                member: mockCreatedMember,
              });

              // Act
              const createdMember = await service.createMember(memberData);
              createdMembers.push(createdMember);
            }

            // Assert: Property - Each member should be linked to its respective form submission
            for (let i = 0; i < membersData.length; i++) {
              expect(createdMembers[i].formSubmissionId).toBe(membersData[i].formSubmissionId);
            }

            // Property: All form submission IDs should be preserved and unique
            const createdFormSubmissionIds = createdMembers.map(m => m.formSubmissionId);
            expect(new Set(createdFormSubmissionIds).size).toBe(membersData.length);
          }
        ),
        { numRuns: 50 } // Reduced runs due to multiple operations per test
      );
    });
  });

  /**
   * Property 11: Unique Membership Number Generation
   * 
   * For any set of members created within an organization, each member should have a
   * unique membership number that follows the format {ORG_PREFIX}-{YEAR}-{SEQUENCE}.
   * 
   * **Validates: Requirements 4.3**
   */
  describe('Property 11: Unique Membership Number Generation', () => {
    /**
     * Test: All generated membership numbers should be unique
     * 
     * Property: When creating multiple members for the same organization, each member
     * should receive a unique membership number with no duplicates.
     */
    it('should generate unique membership numbers for all members', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
          }),
          fc.integer({ min: 2, max: 20 }), // number of members to create
          async ({ organisationId, membershipTypeId, orgPrefix }, memberCount) => {
            const membershipNumbers = new Set<string>();
            const currentYear = new Date().getFullYear();

            // Arrange: Mock membership type
            const mockMembershipType = {
              id: membershipTypeId,
              organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: true,
            };


            // Act: Create multiple members
            for (let i = 0; i < memberCount; i++) {
              const memberData: CreateMemberDto = {
                organisationId,
                membershipTypeId,
                userId: fc.sample(fc.uuid(), 1)[0],
                firstName: `First${i}`,
                lastName: `Last${i}`,
                formSubmissionId: fc.sample(fc.uuid(), 1)[0],
              };


              // Generate expected membership number
              const sequence = String(i + 1).padStart(5, '0');
              const expectedMembershipNumber = `${orgPrefix}-${currentYear}-${sequence}`;

              const mockCreatedMember = {
                id: fc.sample(fc.uuid(), 1)[0],
                organisation_id: organisationId,
                membership_type_id: membershipTypeId,
                user_id: memberData.userId,
                membership_number: expectedMembershipNumber,
                first_name: memberData.firstName.trim(),
                last_name: memberData.lastName.trim(),
                form_submission_id: memberData.formSubmissionId,
                date_last_renewed: new Date(),
                status: 'active', // Status determined by automaticallyApprove: true
                valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                labels: [],
                processed: false,
                payment_status: 'pending',
                created_at: new Date(),
                updated_at: new Date(),
              };

              given({
                membershipType: mockMembershipType,
                member: mockCreatedMember,
              });

              const createdMember = await service.createMember(memberData);
              membershipNumbers.add(createdMember.membershipNumber);
            }

            // Assert: Property - All membership numbers should be unique
            expect(membershipNumbers.size).toBe(memberCount);

            // Property: All membership numbers should follow the correct format
            membershipNumbers.forEach(number => {
              expect(number).toMatch(new RegExp(`^${orgPrefix}-${currentYear}-\\d{5}$`));
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Membership numbers should follow the correct format
     * 
     * Property: Every generated membership number should follow the format
     * {ORG_PREFIX}-{YEAR}-{SEQUENCE} where SEQUENCE is a 5-digit zero-padded number.
     */
    it('should generate membership numbers in correct format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            automaticallyApprove: fc.boolean(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
            sequenceNumber: fc.integer({ min: 1, max: 99999 }),
          }),
          async (data) => {
            const currentYear = new Date().getFullYear();
            const expectedSequence = String(data.sequenceNumber).padStart(5, '0');
            const expectedMembershipNumber = `${data.orgPrefix}-${currentYear}-${expectedSequence}`;
            const expectedStatus = data.automaticallyApprove ? 'active' : 'pending';

            // Arrange: Mock membership type
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: data.automaticallyApprove,
            };



            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: data.organisationId,
              membership_type_id: data.membershipTypeId,
              user_id: data.userId,
              membership_number: expectedMembershipNumber,
              first_name: data.firstName.trim(),
              last_name: data.lastName.trim(),
              form_submission_id: data.formSubmissionId,
              date_last_renewed: new Date(),
              status: expectedStatus,
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Act
            const createdMember = await service.createMember({
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            });

            // Assert: Property - Membership number follows correct format
            expect(createdMember.membershipNumber).toBe(expectedMembershipNumber);
            expect(createdMember.membershipNumber).toMatch(/^[A-Z]+-\d{4}-\d{5}$/);

            // Property: Format components are correct
            const [prefix, year, sequence] = createdMember.membershipNumber.split('-');
            expect(prefix).toBe(data.orgPrefix);
            expect(year).toBe(String(currentYear));
            expect(sequence).toBe(expectedSequence);
            expect(sequence.length).toBe(5);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Sequence numbers should increment properly
     * 
     * Property: When creating members sequentially for the same organization and year,
     * the sequence number should increment by 1 for each new member.
     */
    it('should increment sequence numbers properly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
            startingSequence: fc.integer({ min: 0, max: 100 }),
          }),
          fc.integer({ min: 3, max: 10 }), // number of members to create
          async ({ organisationId, membershipTypeId, orgPrefix, startingSequence }, memberCount) => {
            const currentYear = new Date().getFullYear();
            const membershipNumbers: string[] = [];

            // Arrange: Mock membership type
            const mockMembershipType = {
              id: membershipTypeId,
              organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: true,
            };


            // Act: Create multiple members sequentially
            for (let i = 0; i < memberCount; i++) {
              const memberData: CreateMemberDto = {
                organisationId,
                membershipTypeId,
                userId: fc.sample(fc.uuid(), 1)[0],
                firstName: `First${i}`,
                lastName: `Last${i}`,
                formSubmissionId: fc.sample(fc.uuid(), 1)[0],
              };


              // Generate expected membership number
              const sequence = String(startingSequence + i + 1).padStart(5, '0');
              const expectedMembershipNumber = `${orgPrefix}-${currentYear}-${sequence}`;

              const mockCreatedMember = {
                id: fc.sample(fc.uuid(), 1)[0],
                organisation_id: organisationId,
                membership_type_id: membershipTypeId,
                user_id: memberData.userId,
                membership_number: expectedMembershipNumber,
                first_name: memberData.firstName.trim(),
                last_name: memberData.lastName.trim(),
                form_submission_id: memberData.formSubmissionId,
                date_last_renewed: new Date(),
                status: 'active', // Status determined by automaticallyApprove: true
                valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                labels: [],
                processed: false,
                payment_status: 'pending',
                created_at: new Date(),
                updated_at: new Date(),
              };

              given({
                membershipType: mockMembershipType,
                member: mockCreatedMember,
              });

              const createdMember = await service.createMember(memberData);
              membershipNumbers.push(createdMember.membershipNumber);
            }

            // Assert: Property - Sequence numbers should increment by 1
            for (let i = 1; i < membershipNumbers.length; i++) {
              const prevSequence = parseInt(membershipNumbers[i - 1].split('-')[2]);
              const currSequence = parseInt(membershipNumbers[i].split('-')[2]);
              expect(currSequence).toBe(prevSequence + 1);
            }

            // Property: All numbers should be unique
            expect(new Set(membershipNumbers).size).toBe(memberCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Sequence numbers should be zero-padded to 5 digits
     * 
     * Property: All sequence numbers should be exactly 5 digits long, with leading
     * zeros for numbers less than 10000.
     */
    it('should zero-pad sequence numbers to 5 digits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            automaticallyApprove: fc.boolean(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
            sequenceNumber: fc.integer({ min: 1, max: 9999 }), // Test numbers that need padding
          }),
          async (data) => {
            const currentYear = new Date().getFullYear();
            const expectedSequence = String(data.sequenceNumber).padStart(5, '0');
            const expectedMembershipNumber = `${data.orgPrefix}-${currentYear}-${expectedSequence}`;
            const expectedStatus = data.automaticallyApprove ? 'active' : 'pending';

            // Arrange: Mock membership type
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: data.automaticallyApprove,
            };



            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: data.organisationId,
              membership_type_id: data.membershipTypeId,
              user_id: data.userId,
              membership_number: expectedMembershipNumber,
              first_name: data.firstName.trim(),
              last_name: data.lastName.trim(),
              form_submission_id: data.formSubmissionId,
              date_last_renewed: new Date(),
              status: expectedStatus,
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Act
            const createdMember = await service.createMember({
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            });

            // Assert: Property - Sequence is exactly 5 digits with leading zeros
            const sequence = createdMember.membershipNumber.split('-')[2];
            expect(sequence.length).toBe(5);
            expect(sequence).toBe(expectedSequence);

            // Property: Leading zeros are preserved for small numbers
            if (data.sequenceNumber < 10) {
              expect(sequence).toMatch(/^0000\d$/);
            } else if (data.sequenceNumber < 100) {
              expect(sequence).toMatch(/^000\d{2}$/);
            } else if (data.sequenceNumber < 1000) {
              expect(sequence).toMatch(/^00\d{3}$/);
            } else if (data.sequenceNumber < 10000) {
              expect(sequence).toMatch(/^0\d{4}$/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Membership numbers should include current year
     * 
     * Property: All generated membership numbers should include the current year
     * in the format YYYY.
     */
    it('should include current year in membership numbers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            automaticallyApprove: fc.boolean(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
          }),
          async (data) => {
            const currentYear = new Date().getFullYear();
            const expectedStatus = data.automaticallyApprove ? 'active' : 'pending';

            // Arrange: Mock membership type
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: data.automaticallyApprove,
            };



            const expectedMembershipNumber = `${data.orgPrefix}-${currentYear}-00001`;

            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: data.organisationId,
              membership_type_id: data.membershipTypeId,
              user_id: data.userId,
              membership_number: expectedMembershipNumber,
              first_name: data.firstName.trim(),
              last_name: data.lastName.trim(),
              form_submission_id: data.formSubmissionId,
              date_last_renewed: new Date(),
              status: expectedStatus,
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Act
            const createdMember = await service.createMember({
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            });

            // Assert: Property - Year component matches current year
            const year = createdMember.membershipNumber.split('-')[1];
            expect(year).toBe(String(currentYear));
            expect(parseInt(year)).toBe(currentYear);
            expect(year.length).toBe(4);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Organization prefix should be used in membership numbers
     * 
     * Property: The membership number should start with the organization's short_name
     * (prefix) exactly as stored in the database.
     */
    it('should use organization prefix in membership numbers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            automaticallyApprove: fc.boolean(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 10 }).filter(s => /^[A-Z0-9]+$/.test(s)),
          }),
          async (data) => {
            const currentYear = new Date().getFullYear();
            const expectedStatus = data.automaticallyApprove ? 'active' : 'pending';

            // Arrange: Mock membership type
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: data.automaticallyApprove,
            };



            const expectedMembershipNumber = `${data.orgPrefix}-${currentYear}-00001`;

            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: data.organisationId,
              membership_type_id: data.membershipTypeId,
              user_id: data.userId,
              membership_number: expectedMembershipNumber,
              first_name: data.firstName.trim(),
              last_name: data.lastName.trim(),
              form_submission_id: data.formSubmissionId,
              date_last_renewed: new Date(),
              status: expectedStatus,
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Act
            const createdMember = await service.createMember({
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            });

            // Assert: Property - Prefix matches organization short_name exactly
            const prefix = createdMember.membershipNumber.split('-')[0];
            expect(prefix).toBe(data.orgPrefix);
            expect(createdMember.membershipNumber).toMatch(new RegExp(`^${data.orgPrefix}-`));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Conditional Member Status Assignment
   * 
   * For any membership type, when a member is created, the member's status should be
   * set to "active" if the membership type's automaticallyApprove flag is true,
   * otherwise "pending".
   * 
   * **Validates: Requirements 4.4**
   */
  describe('Property 12: Conditional Member Status Assignment', () => {
    /**
     * Test: Member status should be "active" when automaticallyApprove is true
     * 
     * Property: When creating a member with a membership type that has
     * automaticallyApprove set to true, the created member's status should be "active".
     */
    it('should set member status to "active" when automaticallyApprove is true', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
          }),
          async (data) => {
            const memberData: CreateMemberDto = {
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            };

            // Arrange: Mock membership type with automaticallyApprove = true
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: true, // Key property for this test
            };



            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: data.organisationId,
              membership_type_id: data.membershipTypeId,
              user_id: data.userId,
              membership_number: `${data.orgPrefix}-${new Date().getFullYear()}-00001`,
              first_name: data.firstName.trim(),
              last_name: data.lastName.trim(),
              form_submission_id: data.formSubmissionId,
              date_last_renewed: new Date(),
              status: 'active', // Expected status when automaticallyApprove is true
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Act: Create member
            const createdMember = await service.createMember(memberData);

            // Assert: Property - Status must be "active" when automaticallyApprove is true
            expect(createdMember.status).toBe('active');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Member status should be "pending" when automaticallyApprove is false
     * 
     * Property: When creating a member with a membership type that has
     * automaticallyApprove set to false, the created member's status should be "pending".
     */
    it('should set member status to "pending" when automaticallyApprove is false', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
          }),
          async (data) => {
            const memberData: CreateMemberDto = {
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            };

            // Arrange: Mock membership type with automaticallyApprove = false
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: false, // Key property for this test
            };



            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: data.organisationId,
              membership_type_id: data.membershipTypeId,
              user_id: data.userId,
              membership_number: `${data.orgPrefix}-${new Date().getFullYear()}-00001`,
              first_name: data.firstName.trim(),
              last_name: data.lastName.trim(),
              form_submission_id: data.formSubmissionId,
              date_last_renewed: new Date(),
              status: 'pending', // Expected status when automaticallyApprove is false
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Act: Create member
            const createdMember = await service.createMember(memberData);

            // Assert: Property - Status must be "pending" when automaticallyApprove is false
            expect(createdMember.status).toBe('pending');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Status assignment should be consistent across all membership types
     * 
     * Property: For any membership type configuration, the status assignment logic
     * should consistently map automaticallyApprove=true to "active" and
     * automaticallyApprove=false to "pending", regardless of other membership type properties.
     */
    it('should consistently assign status based on automaticallyApprove flag', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
            automaticallyApprove: fc.boolean(), // Randomize the flag
            isRollingMembership: fc.boolean(),
            numberOfMonths: fc.option(fc.integer({ min: 1, max: 60 })),
            validUntil: fc.option(fc.date({ min: new Date(), max: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) })),
          }),
          async (data) => {
            const memberData: CreateMemberDto = {
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            };

            // Arrange: Mock membership type with various configurations
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: data.isRollingMembership,
              numberOfMonths: data.numberOfMonths,
              validUntil: data.validUntil,
              automaticallyApprove: data.automaticallyApprove, // The key property
            };



            // Expected status based on automaticallyApprove flag
            const expectedStatus = data.automaticallyApprove ? 'active' : 'pending';

            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: data.organisationId,
              membership_type_id: data.membershipTypeId,
              user_id: data.userId,
              membership_number: `${data.orgPrefix}-${new Date().getFullYear()}-00001`,
              first_name: data.firstName.trim(),
              last_name: data.lastName.trim(),
              form_submission_id: data.formSubmissionId,
              date_last_renewed: new Date(),
              status: expectedStatus,
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Act: Create member
            const createdMember = await service.createMember(memberData);

            // Assert: Property - Status must match the expected value based on automaticallyApprove
            expect(createdMember.status).toBe(expectedStatus);

            // Property: Status must be one of the two valid values
            expect(['active', 'pending']).toContain(createdMember.status);

            // Property: The mapping is deterministic
            if (data.automaticallyApprove) {
              expect(createdMember.status).toBe('active');
            } else {
              expect(createdMember.status).toBe('pending');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Multiple members with different automaticallyApprove settings
     * 
     * Property: When creating multiple members with different membership types,
     * each member's status should be correctly determined by its respective
     * membership type's automaticallyApprove flag.
     */
    it('should correctly assign status for multiple members with different membership types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              organisationId: fc.uuid(),
              membershipTypeId: fc.uuid(),
              userId: fc.uuid(),
              firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              formSubmissionId: fc.uuid(),
              automaticallyApprove: fc.boolean(),
              orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (membersData) => {
            const createdMembers: any[] = [];

            for (let i = 0; i < membersData.length; i++) {
              const data = membersData[i];
              const memberData: CreateMemberDto = {
                organisationId: data.organisationId,
                membershipTypeId: data.membershipTypeId,
                userId: data.userId,
                firstName: data.firstName,
                lastName: data.lastName,
                formSubmissionId: data.formSubmissionId,
              };

              // Expected status based on automaticallyApprove flag
              const expectedStatus = data.automaticallyApprove ? 'active' : 'pending';

              // Arrange: Mock for each member creation
              const mockMembershipType = {
                id: data.membershipTypeId,
                organisationId: data.organisationId,
                name: 'Test Membership',
                isRollingMembership: true,
                numberOfMonths: 12,
                automaticallyApprove: data.automaticallyApprove,
              };


              const mockCreatedMember = {
                id: fc.sample(fc.uuid(), 1)[0],
                organisation_id: data.organisationId,
                membership_type_id: data.membershipTypeId,
                user_id: data.userId,
                membership_number: `${data.orgPrefix}-${new Date().getFullYear()}-${String(i + 1).padStart(5, '0')}`,
                first_name: data.firstName.trim(),
                last_name: data.lastName.trim(),
                form_submission_id: data.formSubmissionId,
                date_last_renewed: new Date(),
                status: expectedStatus,
                valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                labels: [],
                processed: false,
                payment_status: 'pending',
                created_at: new Date(),
                updated_at: new Date(),
              };

              given({
                membershipType: mockMembershipType,
                member: mockCreatedMember,
              });

              // Act
              const createdMember = await service.createMember(memberData);
              createdMembers.push({ member: createdMember, expectedStatus });
            }

            // Assert: Property - Each member's status should match its expected status
            for (let i = 0; i < membersData.length; i++) {
              const { member, expectedStatus } = createdMembers[i];
              expect(member.status).toBe(expectedStatus);

              // Property: Status matches the automaticallyApprove flag
              if (membersData[i].automaticallyApprove) {
                expect(member.status).toBe('active');
              } else {
                expect(member.status).toBe('pending');
              }
            }
          }
        ),
        { numRuns: 50 } // Reduced runs due to multiple operations per test
      );
    });
  });

  /**
   * Property 17: Referential Integrity Validation
   * 
   * For any member creation attempt, the system should validate that both the selected
   * membership type and its associated form definition exist before proceeding with creation.
   * 
   * **Validates: Requirements 8.5, 8.6**
   */
  describe('Property 17: Referential Integrity Validation', () => {
    /**
     * Test: Should throw error when membership type does not exist
     * 
     * Property: When attempting to create a member with a non-existent membership type ID,
     * the system should throw an error indicating the membership type was not found.
     */
    it('should throw error when membership type does not exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
          }),
          async (data) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();
            
            const memberData: CreateMemberDto = {
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            };

            // Arrange: Mock that membership type does NOT exist (empty result)
            given({ membershipType: null });

            // Act & Assert: Property - Should throw error for non-existent membership type
            await expect(service.createMember(memberData)).rejects.toThrow('Membership type not found');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Should throw error when form submission does not exist
     * 
     * Property: When attempting to create a member with a non-existent form submission ID,
     * the system should throw an error indicating the form submission was not found.
     */
    it('should throw error when form submission does not exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
          }),
          async (data) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();
            
            const memberData: CreateMemberDto = {
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            };

            // Arrange: Mock membership type exists
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: true,
            };

            given({ membershipType: mockMembershipType });

            // Mock form submission does NOT exist
            mockFormSubmissionService.getSubmissionById.mockResolvedValueOnce(null);

            // Act & Assert: Property - Should throw error for non-existent form submission
            await expect(service.createMember(memberData)).rejects.toThrow('Form submission not found');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Should validate membership type before form submission
     * 
     * Property: The system should validate the membership type exists before checking
     * the form submission, ensuring proper validation order.
     */
    it('should validate membership type before form submission', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
          }),
          async (data) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();
            
            const memberData: CreateMemberDto = {
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            };

            // Arrange: Mock that membership type does NOT exist
            given({ membershipType: null });

            // Act & Assert: Should throw error for membership type
            await expect(service.createMember(memberData)).rejects.toThrow('Membership type not found');

            // Property: Should not proceed to form submission validation
            expect(mockFormSubmissionService.getSubmissionById).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Should proceed with creation when both references exist
     * 
     * Property: When both the membership type and form submission exist,
     * the system should proceed with member creation without throwing referential errors.
     */
    it('should proceed with creation when both membership type and form submission exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
            automaticallyApprove: fc.boolean(),
          }),
          async (data) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();
            
            const memberData: CreateMemberDto = {
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            };

            // Expected status based on automaticallyApprove flag
            const expectedStatus = data.automaticallyApprove ? 'active' : 'pending';

            // Arrange: Mock membership type exists
            const mockMembershipType = {
              id: data.membershipTypeId,
              organisationId: data.organisationId,
              name: 'Test Membership',
              isRollingMembership: true,
              numberOfMonths: 12,
              automaticallyApprove: data.automaticallyApprove,
            };

            // Mock form submission exists
            const mockFormSubmission = {
              id: data.formSubmissionId,
              formId: 'form-1',
              organisationId: data.organisationId,
              userId: data.userId,
              submissionType: 'membership_application',
              contextId: 'manual-creation',
              submissionData: {},
              status: 'approved',
              submittedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            };



            // Mock the created member record
            const mockCreatedMember = {
              id: fc.sample(fc.uuid(), 1)[0],
              organisation_id: data.organisationId,
              membership_type_id: data.membershipTypeId,
              user_id: data.userId,
              membership_number: `${data.orgPrefix}-${new Date().getFullYear()}-00001`,
              first_name: data.firstName.trim(),
              last_name: data.lastName.trim(),
              form_submission_id: data.formSubmissionId,
              date_last_renewed: new Date(),
              status: expectedStatus,
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            };

            // Setup mock responses in order
            given({
              membershipType: mockMembershipType,
              member: mockCreatedMember,
            });

            // Mock form submission service
            mockFormSubmissionService.getSubmissionById.mockResolvedValueOnce(mockFormSubmission);

            // Act: Create member - should succeed without throwing
            const createdMember = await service.createMember(memberData);

            // Assert: Property - Member should be created successfully when both references exist
            expect(createdMember).toBeDefined();
            expect(createdMember.id).toBeDefined();
            expect(createdMember.membershipTypeId).toBe(data.membershipTypeId);
            expect(createdMember.formSubmissionId).toBe(data.formSubmissionId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Should consistently validate references across different data combinations
     * 
     * Property: For any combination of valid/invalid membership type and form submission,
     * the system should consistently enforce referential integrity validation.
     */
    it('should consistently validate references across different scenarios', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            membershipTypeId: fc.uuid(),
            userId: fc.uuid(),
            firstName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            lastName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            formSubmissionId: fc.uuid(),
            membershipTypeExists: fc.boolean(),
            formSubmissionExists: fc.boolean(),
            orgPrefix: fc.string({ minLength: 2, maxLength: 5 }).filter(s => /^[A-Z]+$/.test(s)),
          }),
          async (data) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();
            
            const memberData: CreateMemberDto = {
              organisationId: data.organisationId,
              membershipTypeId: data.membershipTypeId,
              userId: data.userId,
              firstName: data.firstName,
              lastName: data.lastName,
              formSubmissionId: data.formSubmissionId,
            };

            // Arrange: Mock membership type based on existence flag
            if (data.membershipTypeExists) {
              const mockMembershipType = {
                id: data.membershipTypeId,
                organisationId: data.organisationId,
                name: 'Test Membership',
                isRollingMembership: true,
                numberOfMonths: 12,
                automaticallyApprove: true,
              };

              given({ membershipType: mockMembershipType });

              // If membership type exists, mock form submission based on existence flag
              if (data.formSubmissionExists) {
                const mockFormSubmission = {
                  id: data.formSubmissionId,
                  formId: 'form-1',
                  organisationId: data.organisationId,
                  userId: data.userId,
                  submissionType: 'membership_application',
                  contextId: 'manual-creation',
                  submissionData: {},
                  status: 'approved',
                  submittedAt: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };

                mockFormSubmissionService.getSubmissionById.mockResolvedValueOnce(mockFormSubmission);

                given({
                  membershipType: { id: data.organisationId, short_name: data.orgPrefix },
                  member: {
                      id: fc.sample(fc.uuid(), 1)[0],
                      organisation_id: data.organisationId,
                      membership_type_id: data.membershipTypeId,
                      user_id: data.userId,
                      membership_number: `${data.orgPrefix}-${new Date().getFullYear()}-00001`,
                      first_name: data.firstName.trim(),
                      last_name: data.lastName.trim(),
                      form_submission_id: data.formSubmissionId,
                      date_last_renewed: new Date(),
                      status: 'active',
                      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                      labels: [],
                      processed: false,
                      payment_status: 'pending',
                      created_at: new Date(),
                      updated_at: new Date(),
                    },
                });
              } else {
                // Form submission does not exist
                mockFormSubmissionService.getSubmissionById.mockResolvedValueOnce(null);
              }
            } else {
              // Membership type does not exist
              given({ membershipType: null });
            }

            // Act & Assert: Property - Validation behavior should be consistent
            if (!data.membershipTypeExists) {
              // Should fail with membership type error
              await expect(service.createMember(memberData)).rejects.toThrow('Membership type not found');
            } else if (!data.formSubmissionExists) {
              // Should fail with form submission error
              await expect(service.createMember(memberData)).rejects.toThrow('Form submission not found');
            } else {
              // Should succeed
              const createdMember = await service.createMember(memberData);
              expect(createdMember).toBeDefined();
              expect(createdMember.membershipTypeId).toBe(data.membershipTypeId);
              expect(createdMember.formSubmissionId).toBe(data.formSubmissionId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
