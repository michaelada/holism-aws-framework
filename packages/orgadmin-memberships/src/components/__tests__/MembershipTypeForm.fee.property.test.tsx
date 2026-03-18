/**
 * Property-Based Tests for MembershipTypeForm Fee Label Currency Code
 * Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code
 *
 * **Validates: Requirements 1.1, 8.2**
 *
 * For any 3-letter currency code provided via organisation.currency,
 * the rendered fee field label must contain that currency code string.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '../../test/i18n-test-utils';
import MembershipTypeForm from '../MembershipTypeForm';
import type { CreateMembershipTypeDto } from '../../types/membership.types';

/**
 * Arbitrary generator for 3-letter uppercase currency codes (e.g. EUR, USD, GBP).
 */
const currencyCodeArb = fc
  .array(fc.integer({ min: 65, max: 90 }), { minLength: 3, maxLength: 3 })
  .map((codes) => String.fromCharCode(...codes));

describe('Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code', () => {
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

  // Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code
  // **Validates: Requirements 1.1, 8.2**
  it('fee field label should contain the organisation currency code for any valid 3-letter code', () => {
    fc.assert(
      fc.property(currencyCodeArb, (currencyCode) => {
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

        const { container } = render(
          <I18nextProvider i18n={testI18n}>
            <MembershipTypeForm
              formData={defaultFormData}
              onChange={noop}
              applicationForms={[]}
              paymentMethods={[]}
              organisation={{ id: 'org-1', currency: currencyCode }}
            />
          </I18nextProvider>,
        );

        // The fee label should contain the currency code
        const labels = Array.from(container.querySelectorAll('label'));
        const feeLabel = labels.find((label) => label.textContent?.includes(currencyCode));
        expect(feeLabel).toBeTruthy();
        expect(feeLabel!.textContent).toContain(`Fee (${currencyCode})`);
      }),
      { numRuns: 100 },
    );
  });
});
