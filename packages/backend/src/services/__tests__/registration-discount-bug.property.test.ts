/**
 * Bug Condition Exploration Property Test
 * Feature: discount-type-integration-fix
 *
 * Property 1: Fault Condition - Registration Type Discount IDs Silently Dropped
 *
 * This test encodes the EXPECTED behavior for discount IDs on Registration Types.
 * On UNFIXED code, these tests MUST FAIL — failure confirms the bug exists.
 * After the fix is applied, these tests should PASS.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5
 */

import * as fc from 'fast-check';
import { RegistrationService } from '../registration.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;

describe('Property 1: Fault Condition - Registration Type Discount IDs Silently Dropped', () => {
  let service: RegistrationService;

  beforeEach(() => {
    service = new RegistrationService();
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 1.1**
   *
   * Bug Condition: operation = 'create' AND discountIds IS NOT EMPTY
   *
   * Expected behavior: createRegistrationType with discountIds returns a result
   * where result.discountIds contains the provided IDs.
   *
   * On unfixed code: FAILS because CreateRegistrationTypeDto has no discountIds field,
   * the INSERT query does not include discount_ids, and rowToRegistrationType() does not
   * map discount_ids from the database row.
   */
  it('should persist and return discountIds when creating a Registration Type with discount IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        async (discountIds) => {
          const now = new Date();
          const validUntil = new Date('2025-12-31');

          // Mock the validateDiscountIds query (SELECT from discounts)
          mockDb.query.mockResolvedValueOnce({
            rows: discountIds.map(id => ({
              id,
              organisation_id: 'org-1',
              module_type: 'registrations',
              status: 'active',
            })),
          } as any);

          // Mock the INSERT RETURNING * to simulate a DB row that includes discount_ids
          mockDb.query.mockResolvedValueOnce({
            rows: [{
              id: 'reg-type-1',
              organisation_id: 'org-1',
              name: 'Test Registration',
              description: 'Test description',
              entity_name: 'Horse',
              registration_form_id: 'form-1',
              registration_status: 'open',
              is_rolling_registration: false,
              valid_until: validUntil,
              number_of_months: null,
              automatically_approve: false,
              registration_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              discount_ids: discountIds,
              created_at: now,
              updated_at: now,
            }],
          } as any);

          const result = await service.createRegistrationType({
            organisationId: 'org-1',
            name: 'Test Registration',
            description: 'Test description',
            entityName: 'Horse',
            registrationFormId: 'form-1',
            supportedPaymentMethods: ['card'],
            validUntil,
            discountIds,
          } as any);

          // The result MUST have a discountIds field containing the provided IDs
          // Using (result as any) because the interface is missing discountIds — that IS the bug
          expect(result).toHaveProperty('discountIds');
          expect((result as any).discountIds).toEqual(discountIds);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * Bug Condition: operation = 'update' AND discountIds IS DEFINED
   *
   * Expected behavior: updateRegistrationType with discountIds returns a result
   * where result.discountIds reflects the updated IDs.
   *
   * On unfixed code: FAILS because UpdateRegistrationTypeDto has no discountIds field,
   * the UPDATE query does not handle discount_ids, and rowToRegistrationType() does not
   * map discount_ids.
   */
  it('should persist and return discountIds when updating a Registration Type with discount IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        async (discountIds) => {
          const now = new Date();
          const validUntil = new Date('2025-12-31');

          // First call: getRegistrationTypeById (SELECT) returns existing type
          // Second call: validateDiscountIds query (SELECT from discounts)
          // Third call: UPDATE RETURNING * returns updated type with discount_ids
          mockDb.query
            .mockResolvedValueOnce({
              rows: [{
                id: 'reg-type-1',
                organisation_id: 'org-1',
                name: 'Existing Registration',
                description: 'Existing description',
                entity_name: 'Horse',
                registration_form_id: 'form-1',
                registration_status: 'open',
                is_rolling_registration: false,
                valid_until: validUntil,
                number_of_months: null,
                automatically_approve: false,
                registration_labels: [],
                supported_payment_methods: ['card'],
                use_terms_and_conditions: false,
                terms_and_conditions: null,
                discount_ids: [],
                created_at: now,
                updated_at: now,
              }],
            } as any)
            .mockResolvedValueOnce({
              rows: discountIds.map(id => ({
                id,
                organisation_id: 'org-1',
                module_type: 'registrations',
                status: 'active',
              })),
            } as any)
            .mockResolvedValueOnce({
              rows: [{
                id: 'reg-type-1',
                organisation_id: 'org-1',
                name: 'Existing Registration',
                description: 'Existing description',
                entity_name: 'Horse',
                registration_form_id: 'form-1',
                registration_status: 'open',
                is_rolling_registration: false,
                valid_until: validUntil,
                number_of_months: null,
                automatically_approve: false,
                registration_labels: [],
                supported_payment_methods: ['card'],
                use_terms_and_conditions: false,
                terms_and_conditions: null,
                discount_ids: discountIds,
                created_at: now,
                updated_at: now,
              }],
            } as any);

          const result = await service.updateRegistrationType('reg-type-1', {
            discountIds,
          } as any);

          // The result MUST have a discountIds field containing the updated IDs
          // Using (result as any) because the interface is missing discountIds — that IS the bug
          expect(result).toHaveProperty('discountIds');
          expect((result as any).discountIds).toEqual(discountIds);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 1.3**
   *
   * Bug Condition: operation = 'read'
   *
   * Expected behavior: Reading a Registration Type returns the discountIds field
   * mapped from the database row's discount_ids column.
   *
   * On unfixed code: FAILS because rowToRegistrationType() does not map discount_ids
   * from the database row, so result.discountIds is undefined.
   */
  it('should return discountIds field when reading a Registration Type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
        async (discountIds) => {
          const now = new Date();

          mockDb.query.mockResolvedValue({
            rows: [{
              id: 'reg-type-1',
              organisation_id: 'org-1',
              name: 'Test Registration',
              description: 'Test description',
              entity_name: 'Horse',
              registration_form_id: 'form-1',
              registration_status: 'open',
              is_rolling_registration: false,
              valid_until: new Date('2025-12-31'),
              number_of_months: null,
              automatically_approve: false,
              registration_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              discount_ids: discountIds,
              created_at: now,
              updated_at: now,
            }],
          } as any);

          const result = await service.getRegistrationTypeById('reg-type-1');

          expect(result).not.toBeNull();
          // Using (result as any) because the interface is missing discountIds — that IS the bug
          expect(result).toHaveProperty('discountIds');
          expect((result as any).discountIds).toEqual(discountIds);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   *
   * Bug Condition: no validateDiscountIds() exists
   *
   * Expected behavior: createRegistrationType with invalid discount IDs
   * (non-existent) should throw a validation error.
   *
   * On unfixed code: FAILS because there is no validateDiscountIds() method
   * in RegistrationService, so invalid discount IDs are silently accepted
   * (or rather, silently dropped).
   */
  it('should throw validation error when creating a Registration Type with invalid discount IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
        async (invalidDiscountIds) => {
          const validUntil = new Date('2025-12-31');

          // Mock: discount validation query returns no matching discounts (all invalid)
          mockDb.query.mockResolvedValue({
            rows: [],
          } as any);

          // The service SHOULD throw a validation error for invalid discount IDs
          // On unfixed code, it will NOT throw because no validation exists
          let threwError = false;
          try {
            await service.createRegistrationType({
              organisationId: 'org-1',
              name: 'Test Registration',
              description: 'Test description',
              entityName: 'Horse',
              registrationFormId: 'form-1',
              supportedPaymentMethods: ['card'],
              validUntil,
              discountIds: invalidDiscountIds,
            } as any);
          } catch (error: any) {
            // We expect a validation error about invalid discount IDs
            threwError = true;
            expect(error.message).toMatch(/discount/i);
          }

          // The service MUST throw an error for invalid discount IDs
          expect(threwError).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});
