/**
 * Unit Tests for MembershipTypeForm Payment Configuration
 *
 * Tests specific examples and edge cases for fee field rendering,
 * handling fee checkbox visibility, and default values.
 *
 * Requirements: 1.1, 1.2, 2.1, 8.1, 8.3
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '../../test/i18n-test-utils';
import MembershipTypeForm from '../MembershipTypeForm';
import type { CreateMembershipTypeDto } from '../../types/membership.types';

const PAYMENT_METHODS = [
  { id: 'stripe', name: 'Stripe' },
  { id: 'pay-offline', name: 'Pay Offline' },
  { id: 'card', name: 'Card' },
];

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

function renderForm(overrides: Partial<CreateMembershipTypeDto> = {}, currency = 'EUR') {
  const testI18n = setupI18n();
  return render(
    <I18nextProvider i18n={testI18n}>
      <MembershipTypeForm
        formData={{ ...defaultFormData, ...overrides }}
        onChange={noop}
        applicationForms={[]}
        paymentMethods={PAYMENT_METHODS}
        organisation={{ id: 'org-1', currency }}
      />
    </I18nextProvider>,
  );
}

describe('MembershipTypeForm payment configuration', () => {
  // Validates: Requirement 1.1 — fee field labelled with organisation currency code
  it('renders fee field with "EUR" label when org currency is EUR', () => {
    const { container } = renderForm({}, 'EUR');

    const labels = Array.from(container.querySelectorAll('label'));
    const feeLabel = labels.find((label) => label.textContent?.includes('Fee (EUR)'));
    expect(feeLabel).toBeTruthy();
  });

  // Validates: Requirement 8.3 — handling fee hidden when fee is 0
  it('hides handling fee checkbox when fee is 0', () => {
    const { container } = renderForm({ fee: 0, supportedPaymentMethods: ['stripe'] });

    const labels = Array.from(container.querySelectorAll('label'));
    const handlingFeeLabel = labels.find((l) => l.textContent?.includes('Handling fee included'));
    expect(handlingFeeLabel).toBeFalsy();
  });

  // Validates: Requirements 2.1, 8.3 — handling fee visible when fee > 0 and card payment selected
  it('shows handling fee checkbox when fee is 50 and payment methods include stripe', () => {
    const { container } = renderForm({ fee: 50, supportedPaymentMethods: ['stripe'] });

    const labels = Array.from(container.querySelectorAll('label'));
    const handlingFeeLabel = labels.find((l) => l.textContent?.includes('Handling fee included'));
    expect(handlingFeeLabel).toBeTruthy();
  });

  // Validates: Requirement 8.3 — handling fee hidden when no card-based payment method
  it('hides handling fee checkbox when payment methods are only pay-offline', () => {
    const { container } = renderForm({ fee: 50, supportedPaymentMethods: ['pay-offline'] });

    const labels = Array.from(container.querySelectorAll('label'));
    const handlingFeeLabel = labels.find((l) => l.textContent?.includes('Handling fee included'));
    expect(handlingFeeLabel).toBeFalsy();
  });

  // Validates: Requirements 1.2, 8.1 — default values for fee and handlingFeeIncluded
  it('uses default values of fee 0.00 and handlingFeeIncluded false', () => {
    const { container } = renderForm();

    // Fee input should have value 0
    const inputs = Array.from(container.querySelectorAll('input[type="number"]'));
    const feeInput = inputs.find((input) => {
      const id = input.getAttribute('id');
      if (!id) return false;
      const label = container.querySelector(`label[for="${id}"]`);
      return label?.textContent?.includes('Fee');
    });
    expect(feeInput).toBeTruthy();
    expect((feeInput as HTMLInputElement).value).toBe('0');

    // Handling fee checkbox should not be rendered (fee is 0)
    const labels = Array.from(container.querySelectorAll('label'));
    const handlingFeeLabel = labels.find((l) => l.textContent?.includes('Handling fee included'));
    expect(handlingFeeLabel).toBeFalsy();
  });
});
