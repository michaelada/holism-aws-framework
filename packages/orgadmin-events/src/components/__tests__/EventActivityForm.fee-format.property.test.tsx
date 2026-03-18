/**
 * Property-Based Tests for EventActivityForm formatCurrency Usage
 * Feature: payment-fee-configuration, Property 6: EventActivityForm fee display uses formatCurrency
 *
 * **Validates: Requirements 10.2**
 *
 * For any valid fee value and any organisation currency code, when the
 * EventActivityForm displays a persisted fee value, the formatted output
 * must match the result of calling formatCurrency(fee, currency).
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

const mockFormatCurrency = (value: number, currency: string) => `${currency} ${value.toFixed(2)}`;

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
  formatCurrency: (value: number, currency: string) => mockFormatCurrency(value, currency),
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

/**
 * Arbitrary generator for valid positive fee values with up to 2 decimal places.
 * Range: 0.01 to 99999.99
 */
const positiveFeeArb = fc
  .integer({ min: 1, max: 9999999 })
  .map((cents) => cents / 100);

describe('Feature: payment-fee-configuration, Property 6: EventActivityForm fee display uses formatCurrency', () => {
  const noop = vi.fn();

  // Feature: payment-fee-configuration, Property 6: EventActivityForm fee display uses formatCurrency
  // **Validates: Requirements 10.2**
  it('displayed fee helper text should match formatCurrency(fee, currency) for any valid fee and currency', () => {
    fc.assert(
      fc.property(positiveFeeArb, currencyCodeArb, (fee, currencyCode) => {
        // Update the mock currency code for this iteration
        mockCurrencyCode = currencyCode;

        const activity: EventActivityFormData = {
          name: 'Test Activity',
          description: 'Test Description',
          showPublicly: true,
          applicationFormId: '',
          limitApplicants: false,
          allowSpecifyQuantity: false,
          useTermsAndConditions: false,
          fee,
          supportedPaymentMethods: [],
          handlingFeeIncluded: false,
        };

        const { container } = render(
          <EventActivityForm
            activity={activity}
            index={0}
            onChange={noop}
            onRemove={noop}
            paymentMethods={[]}
          />,
        );

        const expectedText = mockFormatCurrency(fee, currencyCode);

        // The helper text should contain the formatCurrency output
        const helperTexts = Array.from(container.querySelectorAll('.MuiFormHelperText-root'));
        const feeHelper = helperTexts.find((el) => el.textContent?.includes(expectedText));
        expect(feeHelper).toBeTruthy();
        expect(feeHelper!.textContent).toContain(expectedText);
      }),
      { numRuns: 100 },
    );
  });
});
