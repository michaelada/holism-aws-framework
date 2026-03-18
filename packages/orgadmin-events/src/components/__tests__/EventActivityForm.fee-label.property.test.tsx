/**
 * Property-Based Tests for EventActivityForm Fee Label Currency Code
 * Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code
 *
 * **Validates: Requirements 10.1, 8.2**
 *
 * For any 3-letter currency code provided via organisation.currency,
 * the rendered fee field label must contain that currency code string.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';

// ── Mock setup (MUST be before component imports) ──

let mockCurrencyCode = 'EUR';

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
      get currency() { return mockCurrencyCode; },
    },
  }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === 'events.activities.activity.feeCurrency' && opts?.currency) {
        return `Fee (${opts.currency})`;
      }
      return key;
    },
    i18n: { language: 'en-GB' },
  }),
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  useLocale: () => ({ locale: 'en-GB' }),
}));

import EventActivityForm from '../EventActivityForm';
import type { EventActivityFormData } from '../../types/event.types';

/**
 * Arbitrary generator for 3-letter uppercase currency codes (e.g. EUR, USD, GBP).
 */
const currencyCodeArb = fc
  .array(fc.integer({ min: 65, max: 90 }), { minLength: 3, maxLength: 3 })
  .map((codes) => String.fromCharCode(...codes));

describe('Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code', () => {
  const defaultActivity: EventActivityFormData = {
    name: 'Test Activity',
    description: 'Test Description',
    showPublicly: true,
    applicationFormId: '',
    limitApplicants: false,
    allowSpecifyQuantity: false,
    useTermsAndConditions: false,
    fee: 0,
    allowedPaymentMethod: 'both',
    handlingFeeIncluded: false,
  };

  const noop = vi.fn();

  // Feature: payment-fee-configuration, Property 1: Fee label includes organisation currency code
  // **Validates: Requirements 10.1, 8.2**
  it('fee field label should contain the organisation currency code for any valid 3-letter code', () => {
    fc.assert(
      fc.property(currencyCodeArb, (currencyCode) => {
        // Update the mock currency code for this iteration
        mockCurrencyCode = currencyCode;

        const { container } = render(
          <EventActivityForm
            activity={defaultActivity}
            index={0}
            onChange={noop}
            onRemove={noop}
          />,
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
