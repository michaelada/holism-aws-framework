/**
 * Property-Based Tests for MembershipTypeForm Handling Fee Toggle Visibility
 * Feature: payment-fee-configuration, Property 4: Handling fee toggle visibility
 *
 * **Validates: Requirements 2.1, 8.3**
 *
 * For any combination of fee value and set of supported payment methods,
 * the handling fee included toggle is visible if and only if a card-based
 * payment method is in the selected set AND the fee is greater than zero.
 *
 * Formula: showHandlingFee = hasCardPayment && fee > 0
 * Card-based methods: 'stripe', 'card'
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '../../test/i18n-test-utils';
import MembershipTypeForm from '../MembershipTypeForm';
import type { CreateMembershipTypeDto } from '../../types/membership.types';

const PAYMENT_METHODS = ['stripe', 'pay-offline', 'card'] as const;
const CARD_METHODS = ['stripe', 'card'];

/**
 * Arbitrary generator for a subset of payment methods.
 */
const paymentMethodsArb = fc.subarray([...PAYMENT_METHODS], { minLength: 0, maxLength: 3 });

/**
 * Arbitrary generator for fee values: mix of zero, positive, and negative values.
 */
const feeArb = fc.oneof(
  fc.constant(0),
  fc.double({ min: 0.01, max: 99999.99, noNaN: true }),
  fc.double({ min: -1000, max: -0.01, noNaN: true }),
);

describe('Feature: payment-fee-configuration, Property 4: Handling fee toggle visibility', () => {
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

  function setupI18n() {
    const testI18n = createTestI18n('en-GB');
    testI18n.addResourceBundle(
      'en-GB',
      'translation',
      {
        payment: {
          fee: 'Fee ({{currency}})',
          feeHelper: 'The amount to charge for this type',
          handlingFeeIncluded: 'Handling fee included',
          handlingFeeIncludedHelper:
            'When enabled, the card processing fee is absorbed into the price. When disabled, the processing fee is added on top at checkout.',
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
    return testI18n;
  }

  function renderForm(fee: number, paymentMethods: string[]) {
    const testI18n = setupI18n();
    const paymentMethodOptions = PAYMENT_METHODS.map((id) => ({ id, name: id }));

    return render(
      <I18nextProvider i18n={testI18n}>
        <MembershipTypeForm
          formData={{ ...defaultFormData, fee, supportedPaymentMethods: paymentMethods }}
          onChange={noop}
          applicationForms={[]}
          paymentMethods={paymentMethodOptions}
          organisation={{ id: 'org-1', currency: 'EUR' }}
        />
      </I18nextProvider>,
    );
  }

  // Feature: payment-fee-configuration, Property 4: Handling fee toggle visibility
  // **Validates: Requirements 2.1, 8.3**
  it('handling fee toggle is visible iff fee > 0 AND a card-based payment method is selected', () => {
    fc.assert(
      fc.property(feeArb, paymentMethodsArb, (fee, paymentMethods) => {
        const { container } = renderForm(fee, paymentMethods);

        const hasCardPayment = paymentMethods.some((m) => CARD_METHODS.includes(m));
        const expectedVisible = hasCardPayment && fee > 0;

        // Look for the handling fee checkbox label text
        const labels = Array.from(container.querySelectorAll('label'));
        const handlingFeeLabel = labels.find((label) =>
          label.textContent?.includes('Handling fee included'),
        );

        if (expectedVisible) {
          expect(handlingFeeLabel).toBeTruthy();
        } else {
          expect(handlingFeeLabel).toBeFalsy();
        }
      }),
      { numRuns: 100 },
    );
  });
});
