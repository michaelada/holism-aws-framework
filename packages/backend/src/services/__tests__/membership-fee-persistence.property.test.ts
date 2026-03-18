/**
 * Property-Based Tests for Membership Fee Round-Trip Persistence
 * Feature: payment-fee-configuration, Property 3: Fee round-trip persistence
 *
 * Validates: Requirements 1.3
 *
 * For any valid fee value (non-negative, up to two decimal places),
 * saving a membership type and reading it back should return the same fee value.
 */

import * as fc from 'fast-check';
import { MembershipService } from '../membership.service';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

jest.mock('../membership-number-generator.service', () => ({
  membershipNumberGenerator: {
    generateWithRetry: jest.fn(),
  },
}));

jest.mock('../membership-number-validator.service', () => ({
  membershipNumberValidator: {
    validateUniqueness: jest.fn(),
  },
}));

/**
 * Generates a valid fee value: non-negative with up to 2 decimal places.
 * Uses fc.double rounded to 2dp, matching the DECIMAL(10,2) column type.
 */
const validFeeArb = fc
  .double({ min: 0, max: 99999999.99, noNaN: true, noDefaultInfinity: true })
  .map((v) => Math.round(v * 100) / 100);

describe('Membership Fee Round-Trip Persistence Property Tests', () => {
  let service: MembershipService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new MembershipService();
    jest.clearAllMocks();
  });

  // Feature: payment-fee-configuration, Property 3: Fee round-trip persistence
  // **Validates: Requirements 1.3**
  it('should preserve fee value through create and read-back round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(validFeeArb, async (fee) => {
        // Simulate the DB row that RETURNING * would produce after INSERT.
        // The DB stores fee as DECIMAL(10,2), which comes back as a string
        // representation (PostgreSQL returns numeric types as strings via node-pg).
        const dbRow = {
          id: 'test-id',
          organisation_id: 'org-1',
          name: 'Test Membership',
          description: 'Test',
          membership_form_id: 'form-1',
          membership_status: 'open',
          is_rolling_membership: true,
          valid_until: null,
          number_of_months: 12,
          automatically_approve: false,
          member_labels: [],
          supported_payment_methods: ['card'],
          use_terms_and_conditions: false,
          terms_and_conditions: null,
          membership_type_category: 'single',
          max_people_in_application: null,
          min_people_in_application: null,
          person_titles: null,
          person_labels: null,
          field_configuration: null,
          discount_ids: JSON.stringify([]),
          fee: fee.toFixed(2), // DB returns DECIMAL as string
          handling_fee_included: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        // Mock create returning the row
        mockDb.query.mockResolvedValueOnce({ rows: [dbRow] } as any);

        const created = await service.createMembershipType({
          organisationId: 'org-1',
          name: 'Test Membership',
          description: 'Test',
          membershipFormId: 'form-1',
          supportedPaymentMethods: ['card'],
          isRollingMembership: true,
          numberOfMonths: 12,
          fee,
        });

        // Mock read-back returning the same row (simulating SELECT after INSERT)
        mockDb.query.mockResolvedValueOnce({ rows: [dbRow] } as any);

        const readBack = await service.getMembershipTypeById('test-id');

        // The fee should survive the round-trip: input → DB string → parseFloat
        expect(created.fee).toBe(fee);
        expect(readBack).not.toBeNull();
        expect(readBack!.fee).toBe(fee);
      }),
      { numRuns: 100 }
    );
  });
});
