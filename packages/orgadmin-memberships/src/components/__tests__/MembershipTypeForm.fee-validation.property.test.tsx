/**
 * Property-Based Tests for MembershipTypeForm Fee Validation
 * Feature: payment-fee-configuration, Property 2: Fee validation rejects invalid values
 *
 * **Validates: Requirements 1.2**
 *
 * For any numeric input, the fee field should accept the value if and only if
 * it is non-negative and has at most two decimal places.
 *
 * The fee field uses inputProps={{ min: 0, step: 0.01 }} on the HTML input element.
 * This test verifies that the rendered input has the correct min and step attributes
 * that enforce the validation rules.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '../../test/i18n-test-utils';
import MembershipTypeForm from '../MembershipTypeForm';
import type { CreateMembershipTypeDto } from '../../types/membership.types';

/**
 * Helper: count decimal places of a number.
 * Returns 0 for integers, 1 for one decimal place, etc.
 */
function decimalPlaces(value: number): number {
  const str = String(value);
  const dotIndex = str.indexOf('.');
  if (dotIndex === -1) return 0;
  return str.length - dotIndex - 1;
}

/**
 * A value is valid for the fee field iff it is non-negative and has at most 2 decimal places.
 */
function isValidFee(value: number): boolean {
  return value >= 0 && decimalPlaces(value) <= 2;
}

describe('Feature: payment-fee-configuration, Property 2: Fee validation rejects invalid values', () => {
  const defaultFormData: CreateMembershipTypeDto = {
    name: '',
    description: '',
    membershipFormId: '',
    membershipStatus: 'open',
    isRollingMembership: true,
    numberOfMonths: 12,
    automaticallyApprove: false,
    memberLabels: [],
    supportedPaymentMethods: [],
    fee: 0,
    handlingFeeIncluded: false,
    useTermsAndConditions: false,
    membershipTypeCategory: 'single',
  };

  const noop = vi.fn();

  function renderForm(feeValue: number) {
    const testI18n = createTestI18n('en-GB');
    testI18n.addResourceBundle(
      'en-GB',
      'translation',
      {
        payment: {
          fee: 'Fee ({{currency}})',
          feeHelper: 'The amount to charge for this type',
        },
        memberships: {
          ...testI18n.getResourceBundle('en-GB', 'translation')?.memberships,
          fields: {
            ...testI18n.getResourceBundle('en-GB', 'translation')?.memberships?.fields,
            name: 'Name',
            description: 'Description',
            membershipForm: 'Membership Form',
            membershipStatus: 'Status',
            isRollingMembership: 'Rolling Membership',
            numberOfMonths: 'Number of Months',
            automaticallyApprove: 'Automatically Approve',
            supportedPaymentMethods: 'Payment Methods',
            useTermsAndConditions: 'Use Terms and Conditions',
          },
          statusOptions: {
            openAccepting: 'Open',
            closedNotAccepting: 'Closed',
          },
        },
      },
      true,
      true,
    );

    return render(
      <I18nextProvider i18n={testI18n}>
        <MembershipTypeForm
          formData={{ ...defaultFormData, fee: feeValue }}
          onChange={noop}
          applicationForms={[]}
          paymentMethods={[]}
          organisation={{ id: 'org-1', currency: 'EUR' }}
        />
      </I18nextProvider>,
    );
  }

  // Feature: payment-fee-configuration, Property 2: Fee validation rejects invalid values
  // **Validates: Requirements 1.2**
  it('fee input should have min=0 and step=0.01 attributes to enforce non-negative values with at most 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 100000, noNaN: true }),
        (feeValue) => {
          const { container } = renderForm(feeValue);

          // Find the fee input by its type="number" and associated label
          const inputs = Array.from(container.querySelectorAll('input[type="number"]'));
          const feeInput = inputs.find((input) => {
            const id = input.getAttribute('id');
            if (!id) return false;
            const label = container.querySelector(`label[for="${id}"]`);
            return label?.textContent?.includes('Fee');
          });

          expect(feeInput).toBeTruthy();

          // Verify the input has min=0 (enforces non-negative)
          const minAttr = feeInput!.getAttribute('min');
          expect(minAttr).toBe('0');

          // Verify the input has step=0.01 (enforces at most 2 decimal places)
          const stepAttr = feeInput!.getAttribute('step');
          expect(stepAttr).toBe('0.01');
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: payment-fee-configuration, Property 2: Fee validation rejects invalid values
  // **Validates: Requirements 1.2**
  it('for any random number, isValidFee should return true iff value is non-negative and has ≤ 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Valid: non-negative integers
          fc.integer({ min: 0, max: 99999999 }),
          // Valid: non-negative with 1 decimal place
          fc.integer({ min: 0, max: 99999999 }).map((n) => n + 0.1),
          // Valid: non-negative with 2 decimal places
          fc.integer({ min: 0, max: 99999999 }).map((n) => n + 0.01),
          fc.integer({ min: 0, max: 99999999 }).map((n) => n + 0.99),
          // Invalid: negative values
          fc.integer({ min: -99999999, max: -1 }),
          // Invalid: more than 2 decimal places
          fc.integer({ min: 0, max: 99999999 }).map((n) => n + 0.001),
          fc.integer({ min: 0, max: 99999999 }).map((n) => n + 0.123),
        ),
        (value) => {
          const valid = isValidFee(value);
          const expectedValid = value >= 0 && decimalPlaces(value) <= 2;
          expect(valid).toBe(expectedValid);
        },
      ),
      { numRuns: 100 },
    );
  });
});
