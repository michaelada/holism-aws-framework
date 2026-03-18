/**
 * Unit Tests for EventActivityForm Standardisation
 *
 * Tests specific examples and edge cases for fee label rendering with currency,
 * formatCurrency usage, field ordering, and i18n key usage.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

let mockCurrencyCode = 'EUR';
const mockFormatCurrency = vi.fn(
  (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
);
const mockT = vi.fn((key: string, opts?: Record<string, string>) => {
  if (key === 'events.activities.activity.feeCurrency' && opts?.currency) {
    return `Fee (${opts.currency})`;
  }
  if (key === 'events.activities.activity.handlingFeeIncluded') {
    return 'Handling fee included';
  }
  if (key === 'events.activities.activity.supportedPaymentMethods') {
    return 'Supported Payment Methods';
  }
  if (key === 'events.activities.activity.allowedPaymentMethod') {
    return 'Payment Method';
  }
  if (key === 'events.activities.activity.feeHelper') {
    return 'Fee helper text';
  }
  return key;
});

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
    t: mockT,
    i18n: { language: 'en-GB' },
  }),
  formatCurrency: (...args: any[]) => mockFormatCurrency(args[0], args[1]),
  useLocale: () => ({ locale: 'en-GB' }),
}));

import EventActivityForm from '../EventActivityForm';
import type { EventActivityFormData } from '../../types/event.types';

const noop = vi.fn();

const defaultPaymentMethods = [
  { id: 'pm-card', name: 'Card Payment' },
  { id: 'pm-offline', name: 'Pay Offline' },
];

function makeActivity(overrides: Partial<EventActivityFormData> = {}): EventActivityFormData {
  return {
    name: 'Test Activity',
    description: 'Test Description',
    showPublicly: true,
    applicationFormId: '',
    limitApplicants: false,
    allowSpecifyQuantity: false,
    useTermsAndConditions: false,
    fee: 0,
    supportedPaymentMethods: [],
    handlingFeeIncluded: false,
    ...overrides,
  };
}

describe('EventActivityForm standardisation', () => {
  beforeEach(() => {
    mockT.mockClear();
    mockFormatCurrency.mockClear();
  });

  // Validates: Requirement 10.1 — fee label includes organisation currency code
  it('renders fee label "Fee (EUR)" when org currency is EUR', () => {
    mockCurrencyCode = 'EUR';
    const { container } = render(
      <EventActivityForm activity={makeActivity()} index={0} onChange={noop} onRemove={noop} paymentMethods={defaultPaymentMethods} />,
    );

    const labels = Array.from(container.querySelectorAll('label'));
    const feeLabel = labels.find((l) => l.textContent?.includes('Fee (EUR)'));
    expect(feeLabel).toBeTruthy();
  });

  // Validates: Requirement 10.1 — fee label includes organisation currency code
  it('renders fee label "Fee (USD)" when org currency is USD', () => {
    mockCurrencyCode = 'USD';
    const { container } = render(
      <EventActivityForm activity={makeActivity()} index={0} onChange={noop} onRemove={noop} paymentMethods={defaultPaymentMethods} />,
    );

    const labels = Array.from(container.querySelectorAll('label'));
    const feeLabel = labels.find((l) => l.textContent?.includes('Fee (USD)'));
    expect(feeLabel).toBeTruthy();
  });

  // Validates: Requirement 10.2 — formatCurrency is used for persisted fee display
  it('uses formatCurrency for persisted fee display when fee > 0', () => {
    mockCurrencyCode = 'EUR';
    const { container } = render(
      <EventActivityForm
        activity={makeActivity({ fee: 25.5 })}
        index={0}
        onChange={noop}
        onRemove={noop}
        paymentMethods={defaultPaymentMethods}
      />,
    );

    expect(mockFormatCurrency).toHaveBeenCalledWith(25.5, 'EUR');
    const helperTexts = Array.from(container.querySelectorAll('.MuiFormHelperText-root'));
    const feeHelper = helperTexts.find((el) => el.textContent?.includes('EUR 25.50'));
    expect(feeHelper).toBeTruthy();
  });

  // Validates: Requirement 10.3 — fee, payment method, and handling fee toggle render in correct order
  it('renders fee, payment method, and handling fee toggle in correct order', () => {
    mockCurrencyCode = 'EUR';
    const { container } = render(
      <EventActivityForm
        activity={makeActivity({ fee: 50, supportedPaymentMethods: ['pm-card', 'pm-offline'], handlingFeeIncluded: false })}
        index={0}
        onChange={noop}
        onRemove={noop}
        paymentMethods={defaultPaymentMethods}
      />,
    );

    const labels = Array.from(container.querySelectorAll('label'));
    const feeIdx = labels.findIndex((l) => l.textContent?.includes('Fee (EUR)'));
    const paymentIdx = labels.findIndex((l) => l.textContent?.includes('Supported Payment Methods'));
    const handlingIdx = labels.findIndex((l) => l.textContent?.includes('Handling fee included'));

    expect(feeIdx).toBeGreaterThanOrEqual(0);
    expect(paymentIdx).toBeGreaterThanOrEqual(0);
    expect(handlingIdx).toBeGreaterThanOrEqual(0);
    expect(feeIdx).toBeLessThan(paymentIdx);
    expect(paymentIdx).toBeLessThan(handlingIdx);
  });

  // Validates: Requirement 10.4 — feeCurrency i18n key is used with currency placeholder
  it('uses events.activities.activity.feeCurrency i18n key with currency placeholder', () => {
    mockCurrencyCode = 'GBP';
    render(
      <EventActivityForm activity={makeActivity()} index={0} onChange={noop} onRemove={noop} paymentMethods={defaultPaymentMethods} />,
    );

    expect(mockT).toHaveBeenCalledWith('events.activities.activity.feeCurrency', { currency: 'GBP' });
  });
});
