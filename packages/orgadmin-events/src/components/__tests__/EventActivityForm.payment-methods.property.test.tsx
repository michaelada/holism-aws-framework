/**
 * Bug Condition Exploration Property Test
 * Feature: event-activity-payment-methods-standardization
 * Property 1: Bug Condition — Hardcoded Single-Select Payment Method in EventActivityForm
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 *
 * Bug Condition: isBugCondition(input) where
 *   input.component == 'EventActivityForm' AND input.fee > 0 AND input.field == 'paymentMethodSelection'
 *
 * This test encodes the EXPECTED (correct) behavior:
 * - EventActivityForm should render a multi-select dropdown labeled "Supported Payment Methods"
 * - The dropdown should contain dynamic payment method names from props (not hardcoded 'card'/'cheque'/'both')
 * - Selecting payment methods should produce supportedPaymentMethods: string[] (UUID array)
 * - Handling fee toggle visibility should be determined by checking if any selected method name
 *   contains 'card', 'stripe', or 'helix' (case-insensitive)
 *
 * EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';

// ── Mock setup (MUST be before component imports) ──

vi.mock('react-quill', () => ({
  __esModule: true,
  default: () => <div data-testid="react-quill" />,
}));

vi.mock('react-quill/dist/quill.snow.css', () => ({}));

vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: () => <div data-testid="discount-selector" />,
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({
    execute: vi.fn().mockResolvedValue([]),
  }),
  useOrganisation: () => ({
    organisation: {
      get id() { return 'org-1'; },
      get currency() { return 'EUR'; },
    },
  }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === 'events.activities.activity.feeCurrency' && opts?.currency) {
        return `Fee (${opts.currency})`;
      }
      if (key === 'events.activities.activity.allowedPaymentMethod') {
        return 'Allowed Payment Methods';
      }
      if (key === 'events.activities.activity.supportedPaymentMethods') {
        return 'Supported Payment Methods';
      }
      if (key === 'memberships.fields.supportedPaymentMethods') {
        return 'Supported Payment Methods';
      }
      if (key === 'events.activities.activity.handlingFeeIncluded') {
        return 'Handling fee included';
      }
      if (key === 'events.activities.activity.paymentMethods.card') return 'Card';
      if (key === 'events.activities.activity.paymentMethods.cheque') return 'Cheque';
      if (key === 'events.activities.activity.paymentMethods.both') return 'Both';
      return key;
    },
    i18n: { language: 'en-GB' },
  }),
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  useLocale: () => ({ locale: 'en-GB' }),
}));

import EventActivityForm from '../EventActivityForm';
import type { EventActivityFormData } from '../../types/event.types';

const DYNAMIC_PAYMENT_METHODS = [
  { id: 'uuid-1', name: 'Card Payment' },
  { id: 'uuid-2', name: 'Pay Offline' },
];

describe('Feature: event-activity-payment-methods-standardization, Property 1: Bug Condition — Hardcoded Single-Select Payment Method', () => {
  const noop = vi.fn();

  /**
   * Property 1: Bug Condition — Dynamic Payment Method Multi-Select Rendering
   *
   * For any fee > 0, when EventActivityForm is rendered with dynamic paymentMethods prop,
   * the form SHALL display a multi-select dropdown labeled "Supported Payment Methods"
   * containing the dynamic payment method names from props (not hardcoded 'card'/'cheque'/'both').
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
   */
  it('should render a multi-select "Supported Payment Methods" dropdown with dynamic payment methods from props (not hardcoded card/cheque/both)', () => {
    fc.assert(
      fc.property(
        // Generate a fee > 0 (0.01 to 9999.99)
        fc.integer({ min: 1, max: 999999 }).map((cents) => cents / 100),
        (fee) => {
          const activity: EventActivityFormData = {
            name: 'Test Activity',
            description: 'Test Description',
            showPublicly: true,
            applicationFormId: '',
            limitApplicants: false,
            allowSpecifyQuantity: false,
            useTermsAndConditions: false,
            fee,
            supportedPaymentMethods: DYNAMIC_PAYMENT_METHODS.map((pm) => pm.id),
            handlingFeeIncluded: false,
          };

          const { container } = render(
            <EventActivityForm
              activity={activity}
              index={0}
              onChange={noop}
              onRemove={noop}
              paymentMethods={DYNAMIC_PAYMENT_METHODS}
            />,
          );

          // 1. Assert a dropdown labeled "Supported Payment Methods" is rendered (not "Allowed Payment Methods")
          const labels = Array.from(container.querySelectorAll('label'));
          const supportedLabel = labels.find((l) =>
            l.textContent?.includes('Supported Payment Methods'),
          );
          const allowedLabel = labels.find((l) =>
            l.textContent?.includes('Allowed Payment Methods'),
          );

          // Expected: "Supported Payment Methods" label exists
          expect(supportedLabel).toBeTruthy();
          // Expected: "Allowed Payment Methods" label does NOT exist
          expect(allowedLabel).toBeFalsy();

          // 2. Assert the dropdown contains dynamic payment method names from props
          //    (not hardcoded 'Card', 'Cheque', 'Both')
          const menuItems = Array.from(container.querySelectorAll('[role="option"], li[role="option"]'));
          const allText = container.textContent || '';

          // The dynamic payment method names should appear in the rendered output
          // On unfixed code, we'll see 'Card', 'Cheque', 'Both' instead
          const hasCardPayment = allText.includes('Card Payment');
          const hasPayOffline = allText.includes('Pay Offline');
          const hasHardcodedCheque = allText.includes('Cheque');
          const hasHardcodedBoth = allText.includes('Both');

          // Expected: dynamic names present
          expect(hasCardPayment).toBe(true);
          expect(hasPayOffline).toBe(true);
          // Expected: hardcoded names NOT present
          expect(hasHardcodedCheque).toBe(false);
          expect(hasHardcodedBoth).toBe(false);
        },
      ),
      { numRuns: 10 },
    );
  });
});
