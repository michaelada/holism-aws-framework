/**
 * Preservation Property Tests (BEFORE implementing fix)
 * Feature: discount-type-integration-fix
 *
 * Property 2: Preservation - Existing Registration Type Fields and Membership Discount Pipeline
 *
 * These tests capture the BASELINE behavior of the unfixed code.
 * They MUST PASS on unfixed code and continue to pass after the fix is applied.
 * Any failure after the fix indicates a regression.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as fc from 'fast-check';
import { RegistrationService } from '../registration.service';
import { MembershipService } from '../membership.service';
import { DiscountService } from '../discount.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;

// ── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid registration status */
const registrationStatusArb = fc.constantFrom('open' as const, 'closed' as const);

/** Generate a non-empty trimmed string (for names, entity names, etc.) */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

/** Generate an optional description */
const descriptionArb = fc.string({ minLength: 0, maxLength: 200 });

/** Generate a list of labels */
const labelsArb = fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 });

/** Generate supported payment methods (at least one) */
const paymentMethodsArb = fc.array(
  fc.constantFrom('card', 'bank_transfer', 'cash', 'invoice'),
  { minLength: 1, maxLength: 4 }
);

/** Generate a future date for validUntil */
const futureDateArb = fc.date({
  min: new Date('2025-06-01'),
  max: new Date('2030-12-31'),
});

/**
 * Generate a complete CreateRegistrationTypeDto WITHOUT discountIds.
 * Uses rolling vs fixed-period branching to ensure valid configurations.
 */
const createRegistrationTypeDtoArb = fc.record({
  organisationId: fc.uuid(),
  name: nonEmptyStringArb,
  description: descriptionArb,
  entityName: nonEmptyStringArb,
  registrationFormId: fc.uuid(),
  registrationStatus: registrationStatusArb,
  isRollingRegistration: fc.boolean(),
  validUntil: fc.option(futureDateArb, { nil: undefined }),
  numberOfMonths: fc.option(fc.integer({ min: 1, max: 60 }), { nil: undefined }),
  automaticallyApprove: fc.boolean(),
  registrationLabels: labelsArb,
  supportedPaymentMethods: paymentMethodsArb,
  useTermsAndConditions: fc.boolean(),
  termsAndConditions: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
}).map(dto => {
  // Ensure valid rolling/fixed-period configuration
  if (dto.isRollingRegistration) {
    dto.numberOfMonths = dto.numberOfMonths ?? 12;
    dto.validUntil = undefined;
  } else {
    dto.validUntil = dto.validUntil ?? new Date('2026-01-01');
    dto.numberOfMonths = undefined;
  }
  // Ensure terms consistency
  if (dto.useTermsAndConditions) {
    dto.termsAndConditions = dto.termsAndConditions ?? 'Default terms and conditions text.';
  }
  return dto;
});

/**
 * Generate a partial UpdateRegistrationTypeDto WITHOUT discountIds.
 * At least one field is always present.
 */
const updateRegistrationTypeDtoArb = fc.record({
  name: fc.option(nonEmptyStringArb, { nil: undefined }),
  description: fc.option(descriptionArb, { nil: undefined }),
  entityName: fc.option(nonEmptyStringArb, { nil: undefined }),
  registrationFormId: fc.option(fc.uuid(), { nil: undefined }),
  registrationStatus: fc.option(registrationStatusArb, { nil: undefined }),
  isRollingRegistration: fc.option(fc.boolean(), { nil: undefined }),
  validUntil: fc.option(futureDateArb, { nil: undefined }),
  numberOfMonths: fc.option(fc.integer({ min: 1, max: 60 }), { nil: undefined }),
  automaticallyApprove: fc.option(fc.boolean(), { nil: undefined }),
  registrationLabels: fc.option(labelsArb, { nil: undefined }),
  supportedPaymentMethods: fc.option(paymentMethodsArb, { nil: undefined }),
  useTermsAndConditions: fc.option(fc.boolean(), { nil: undefined }),
  termsAndConditions: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
}).filter(dto => {
  // Ensure at least one field is defined
  return Object.values(dto).some(v => v !== undefined);
});

// ── Helper: build a mock DB row from a CreateRegistrationTypeDto ────────────

function buildMockRow(dto: any, id: string = 'reg-type-1') {
  const now = new Date();
  return {
    id,
    organisation_id: dto.organisationId,
    name: dto.name,
    description: dto.description,
    entity_name: dto.entityName,
    registration_form_id: dto.registrationFormId,
    registration_status: dto.registrationStatus || 'open',
    is_rolling_registration: dto.isRollingRegistration || false,
    valid_until: dto.validUntil || null,
    number_of_months: dto.numberOfMonths || null,
    automatically_approve: dto.automaticallyApprove || false,
    registration_labels: dto.registrationLabels || [],
    supported_payment_methods: dto.supportedPaymentMethods,
    use_terms_and_conditions: dto.useTermsAndConditions || false,
    terms_and_conditions: dto.termsAndConditions || null,
    created_at: now,
    updated_at: now,
  };
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('Property 2: Preservation - Existing Registration Type Fields and Membership Discount Pipeline', () => {
  let registrationService: RegistrationService;

  beforeEach(() => {
    registrationService = new RegistrationService();
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.1, 3.4**
   *
   * Preservation: For all Registration Type create operations without discountIds,
   * all existing fields (name, description, entityName, registrationFormId,
   * registrationStatus, isRollingRegistration, validUntil, numberOfMonths,
   * automaticallyApprove, registrationLabels, supportedPaymentMethods,
   * useTermsAndConditions, termsAndConditions) are stored and returned identically.
   */
  it('should preserve all existing fields on create without discountIds', async () => {
    await fc.assert(
      fc.asyncProperty(
        createRegistrationTypeDtoArb,
        async (dto) => {
          const mockRow = buildMockRow(dto);

          mockDb.query.mockResolvedValue({
            rows: [mockRow],
          } as any);

          const result = await registrationService.createRegistrationType(dto);

          // All existing fields must be returned identically
          expect(result.name).toBe(mockRow.name);
          expect(result.description).toBe(mockRow.description);
          expect(result.entityName).toBe(mockRow.entity_name);
          expect(result.registrationFormId).toBe(mockRow.registration_form_id);
          expect(result.registrationStatus).toBe(mockRow.registration_status);
          expect(result.isRollingRegistration).toBe(mockRow.is_rolling_registration);
          expect(result.validUntil).toBe(mockRow.valid_until);
          expect(result.numberOfMonths).toBe(mockRow.number_of_months);
          expect(result.automaticallyApprove).toBe(mockRow.automatically_approve);
          expect(result.registrationLabels).toEqual(mockRow.registration_labels);
          expect(result.supportedPaymentMethods).toEqual(mockRow.supported_payment_methods);
          expect(result.useTermsAndConditions).toBe(mockRow.use_terms_and_conditions);
          expect(result.termsAndConditions).toBe(mockRow.terms_and_conditions);
          expect(result.organisationId).toBe(mockRow.organisation_id);
          expect(result.id).toBe(mockRow.id);
          expect(result.createdAt).toBe(mockRow.created_at);
          expect(result.updatedAt).toBe(mockRow.updated_at);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.4**
   *
   * Preservation: For all Registration Type update operations without discountIds
   * in the payload, existing fields are preserved and only specified fields change.
   */
  it('should preserve existing fields on update without discountIds and only change specified fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        updateRegistrationTypeDtoArb,
        async (updateDto) => {
          const now = new Date();
          const existingRow = {
            id: 'reg-type-1',
            organisation_id: 'org-1',
            name: 'Original Name',
            description: 'Original description',
            entity_name: 'Horse',
            registration_form_id: 'form-1',
            registration_status: 'open',
            is_rolling_registration: false,
            valid_until: new Date('2026-06-01'),
            number_of_months: null,
            automatically_approve: false,
            registration_labels: ['label1'],
            supported_payment_methods: ['card'],
            use_terms_and_conditions: false,
            terms_and_conditions: null,
            created_at: now,
            updated_at: now,
          };

          // Build the expected updated row: apply only the fields present in updateDto
          const updatedRow: Record<string, any> = { ...existingRow, updated_at: new Date() };
          if (updateDto.name !== undefined) updatedRow.name = updateDto.name;
          if (updateDto.description !== undefined) updatedRow.description = updateDto.description;
          if (updateDto.entityName !== undefined) updatedRow.entity_name = updateDto.entityName;
          if (updateDto.registrationFormId !== undefined) updatedRow.registration_form_id = updateDto.registrationFormId;
          if (updateDto.registrationStatus !== undefined) updatedRow.registration_status = updateDto.registrationStatus;
          if (updateDto.isRollingRegistration !== undefined) updatedRow.is_rolling_registration = updateDto.isRollingRegistration;
          if (updateDto.validUntil !== undefined) updatedRow.valid_until = updateDto.validUntil || null;
          if (updateDto.numberOfMonths !== undefined) updatedRow.number_of_months = updateDto.numberOfMonths || null;
          if (updateDto.automaticallyApprove !== undefined) updatedRow.automatically_approve = updateDto.automaticallyApprove;
          if (updateDto.registrationLabels !== undefined) updatedRow.registration_labels = updateDto.registrationLabels;
          if (updateDto.supportedPaymentMethods !== undefined) updatedRow.supported_payment_methods = updateDto.supportedPaymentMethods;
          if (updateDto.useTermsAndConditions !== undefined) updatedRow.use_terms_and_conditions = updateDto.useTermsAndConditions;
          if (updateDto.termsAndConditions !== undefined) updatedRow.terms_and_conditions = updateDto.termsAndConditions || null;

          // Ensure valid rolling/fixed-period configuration for the update
          const isRolling = updateDto.isRollingRegistration !== undefined
            ? updateDto.isRollingRegistration
            : existingRow.is_rolling_registration;
          const numMonths = updateDto.numberOfMonths !== undefined
            ? updateDto.numberOfMonths
            : existingRow.number_of_months;
          const validUntilVal = updateDto.validUntil !== undefined
            ? updateDto.validUntil
            : existingRow.valid_until;

          // Skip invalid configurations that would throw validation errors
          if (isRolling && !numMonths) return;
          if (!isRolling && !validUntilVal) return;

          // Ensure entity name is valid
          const entityName = updateDto.entityName !== undefined
            ? updateDto.entityName
            : existingRow.entity_name;
          if (!entityName || entityName.trim().length === 0) return;

          // Ensure terms consistency
          const useTerms = updateDto.useTermsAndConditions !== undefined
            ? updateDto.useTermsAndConditions
            : existingRow.use_terms_and_conditions;
          const termsText = updateDto.termsAndConditions !== undefined
            ? updateDto.termsAndConditions
            : existingRow.terms_and_conditions;
          if (useTerms && !termsText) return;

          // First call: getRegistrationTypeById (SELECT)
          // Second call: UPDATE RETURNING *
          mockDb.query
            .mockResolvedValueOnce({ rows: [existingRow] } as any)
            .mockResolvedValueOnce({ rows: [updatedRow] } as any);

          const result = await registrationService.updateRegistrationType('reg-type-1', updateDto);

          // Fields NOT in the update payload must be preserved from existing
          if (updateDto.name === undefined) expect(result.name).toBe(existingRow.name);
          if (updateDto.description === undefined) expect(result.description).toBe(existingRow.description);
          if (updateDto.entityName === undefined) expect(result.entityName).toBe(existingRow.entity_name);
          if (updateDto.registrationFormId === undefined) expect(result.registrationFormId).toBe(existingRow.registration_form_id);
          if (updateDto.registrationStatus === undefined) expect(result.registrationStatus).toBe(existingRow.registration_status);
          if (updateDto.isRollingRegistration === undefined) expect(result.isRollingRegistration).toBe(existingRow.is_rolling_registration);
          if (updateDto.automaticallyApprove === undefined) expect(result.automaticallyApprove).toBe(existingRow.automatically_approve);
          if (updateDto.registrationLabels === undefined) expect(result.registrationLabels).toEqual(existingRow.registration_labels);
          if (updateDto.supportedPaymentMethods === undefined) expect(result.supportedPaymentMethods).toEqual(existingRow.supported_payment_methods);
          if (updateDto.useTermsAndConditions === undefined) expect(result.useTermsAndConditions).toBe(existingRow.use_terms_and_conditions);

          // Fields IN the update payload must reflect the new values
          if (updateDto.name !== undefined) expect(result.name).toBe(updateDto.name);
          if (updateDto.description !== undefined) expect(result.description).toBe(updateDto.description);
          if (updateDto.entityName !== undefined) expect(result.entityName).toBe(updateDto.entityName);
          if (updateDto.registrationFormId !== undefined) expect(result.registrationFormId).toBe(updateDto.registrationFormId);
          if (updateDto.registrationStatus !== undefined) expect(result.registrationStatus).toBe(updateDto.registrationStatus);
          if (updateDto.isRollingRegistration !== undefined) expect(result.isRollingRegistration).toBe(updateDto.isRollingRegistration);
          if (updateDto.automaticallyApprove !== undefined) expect(result.automaticallyApprove).toBe(updateDto.automaticallyApprove);
          if (updateDto.registrationLabels !== undefined) expect(result.registrationLabels).toEqual(updateDto.registrationLabels);
          if (updateDto.supportedPaymentMethods !== undefined) expect(result.supportedPaymentMethods).toEqual(updateDto.supportedPaymentMethods);
          if (updateDto.useTermsAndConditions !== undefined) expect(result.useTermsAndConditions).toBe(updateDto.useTermsAndConditions);

          // ID and organisationId must always be preserved
          expect(result.id).toBe(existingRow.id);
          expect(result.organisationId).toBe(existingRow.organisation_id);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.3, 3.5**
   *
   * Preservation: Membership discount validation and getMembershipTypesUsingDiscount()
   * produce identical results. The membership discount pipeline must remain unchanged.
   */
  describe('Membership discount pipeline preservation', () => {
    let membershipService: MembershipService;
    let discountService: DiscountService;

    beforeEach(() => {
      membershipService = new MembershipService();
      discountService = new DiscountService();
    });

    /**
     * **Validates: Requirements 3.3**
     *
     * MembershipService.validateDiscountIds() continues to validate with module_type = 'memberships'.
     * For all arrays of discount IDs and organisation IDs, the validation behavior is preserved.
     */
    it('should preserve MembershipService.validateDiscountIds() behavior with module_type = memberships', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (discountIds, organisationId) => {
            // Mock: all discounts exist, belong to the org, have correct module_type, and are active
            mockDb.query.mockResolvedValue({
              rows: discountIds.map(id => ({
                id,
                organisation_id: organisationId,
                module_type: 'memberships',
                status: 'active',
              })),
            } as any);

            const result = await membershipService.validateDiscountIds(discountIds, organisationId);

            // Validation should pass for valid membership discounts
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
          }
        ),
        { numRuns: 30 }
      );
    });

    /**
     * **Validates: Requirements 3.3**
     *
     * MembershipService.validateDiscountIds() rejects discounts with wrong module_type.
     */
    it('should preserve MembershipService.validateDiscountIds() rejection of wrong module_type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
          fc.uuid(),
          fc.constantFrom('registrations', 'events', 'other'),
          async (discountIds, organisationId, wrongModuleType) => {
            // Mock: discounts exist but have wrong module_type
            mockDb.query.mockResolvedValue({
              rows: discountIds.map(id => ({
                id,
                organisation_id: organisationId,
                module_type: wrongModuleType,
                status: 'active',
              })),
            } as any);

            const result = await membershipService.validateDiscountIds(discountIds, organisationId);

            // Validation should fail — wrong module_type
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBe(discountIds.length);
            for (const error of result.errors) {
              expect(error.reason).toBe('wrong_module_type');
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * **Validates: Requirements 3.5**
     *
     * DiscountService.getMembershipTypesUsingDiscount() continues to return correct
     * membership type IDs. The query uses the membership_types table with JSONB containment.
     */
    it('should preserve DiscountService.getMembershipTypesUsingDiscount() behavior', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
          async (discountId, organisationId, membershipTypeIds) => {
            // Mock: query returns the membership type IDs that use this discount
            mockDb.query.mockResolvedValue({
              rows: membershipTypeIds.map(id => ({ id })),
            } as any);

            const result = await discountService.getMembershipTypesUsingDiscount(
              discountId,
              organisationId
            );

            // Should return the exact membership type IDs
            expect(result).toEqual(membershipTypeIds);

            // Verify the query was called with correct parameters
            expect(mockDb.query).toHaveBeenCalledWith(
              expect.stringContaining('membership_types'),
              [organisationId, JSON.stringify([discountId])]
            );
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
