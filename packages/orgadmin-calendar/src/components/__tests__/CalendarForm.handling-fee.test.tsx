/**
 * Unit Tests for CalendarForm Handling Fee Toggle
 *
 * Tests handling fee checkbox visibility based on selected payment methods.
 * Calendar has inherent pricing (time slot prices), so the toggle appears
 * whenever a card-based payment method is selected (no fee > 0 check needed).
 *
 * Requirements: 5.1, 8.3
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === 'payment.handlingFeeIncluded') return 'Handling fee included';
      if (key === 'payment.handlingFeeIncludedHelper')
        return 'When enabled, the card processing fee is absorbed into the price. When disabled, the processing fee is added on top at checkout.';
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../ScheduleRulesSection', () => ({
  __esModule: true,
  default: () => <div data-testid="schedule-rules-section" />,
}));

import CalendarForm from '../CalendarForm';
import type { CalendarFormData } from '../../types/calendar.types';

// ── Constants ──

const PAYMENT_METHODS = [
  { id: 'stripe', name: 'Stripe' },
  { id: 'pay-offline', name: 'Pay Offline' },
  { id: 'card', name: 'Card' },
];

const defaultFormData: CalendarFormData = {
  name: 'Test Calendar',
  description: 'A test calendar',
  displayColour: '#000000',
  status: 'open',
  enableAutomatedSchedule: false,
  scheduleRules: [],
  minDaysInAdvance: 0,
  maxDaysInAdvance: 90,
  useTermsAndConditions: false,
  supportedPaymentMethods: [],
  handlingFeeIncluded: false,
  allowCancellations: false,
  refundPaymentAutomatically: false,
  sendReminderEmails: false,
};

const noop = vi.fn();

function renderForm(overrides: Partial<CalendarFormData> = {}) {
  return render(
    <CalendarForm
      formData={{ ...defaultFormData, ...overrides }}
      onChange={noop}
      paymentMethods={PAYMENT_METHODS}
      organisation={{ id: 'org-1', currency: 'EUR' }}
    />,
  );
}

// ── Tests ──

describe('CalendarForm handling fee toggle', () => {
  // Validates: Requirements 5.1, 8.3 — toggle visible when card-based payment method selected
  it('shows handling fee checkbox when payment methods include stripe', () => {
    const { container } = renderForm({ supportedPaymentMethods: ['stripe'] });

    const labels = Array.from(container.querySelectorAll('label'));
    const handlingFeeLabel = labels.find((l) => l.textContent?.includes('Handling fee included'));
    expect(handlingFeeLabel).toBeTruthy();
  });

  // Validates: Requirement 8.3 — toggle hidden when no card-based payment method
  it('hides handling fee checkbox when payment methods are only pay-offline', () => {
    const { container } = renderForm({ supportedPaymentMethods: ['pay-offline'] });

    const labels = Array.from(container.querySelectorAll('label'));
    const handlingFeeLabel = labels.find((l) => l.textContent?.includes('Handling fee included'));
    expect(handlingFeeLabel).toBeFalsy();
  });
});
