/**
 * Preservation Property Tests (BEFORE implementing fix)
 * Feature: event-activity-payment-methods-standardization
 * Property 2: Preservation — Fee-Zero Hides Payment UI and Other Fields Unchanged
 *
 * **Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6**
 *
 * These tests capture baseline behavior on UNFIXED code.
 * They MUST PASS on the current code and continue to pass after the fix.
 *
 * Observations on unfixed code:
 * - When fee = 0, the payment method selection UI (Select for allowedPaymentMethod) is NOT rendered
 * - When fee = 0, the handling fee toggle is NOT rendered
 * - When fee = 0, the cheque payment instructions field is NOT rendered
 * - Name, description, showPublicly, applicationForm, limitApplicants, allowSpecifyQuantity,
 *   useTermsAndConditions fields all render and function correctly regardless of payment method changes
 * - handlingFeeIncluded boolean value is stored correctly when checkbox is toggled
 * - chequePaymentInstructions text value is stored correctly when entered
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
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
      if (key === 'events.activities.activity.allowedPaymentMethod') return 'Allowed Payment Methods';
      if (key === 'events.activities.activity.supportedPaymentMethods') return 'Supported Payment Methods';
      if (key === 'events.activities.activity.handlingFeeIncluded') return 'Handling fee included';
      if (key === 'events.activities.activity.chequePaymentInstructions') return 'Cheque payment instructions';
      if (key === 'events.activities.activity.chequePaymentInstructionsHelper') return 'Instructions for cheque payments';
      if (key === 'events.activities.activity.name') return 'Activity Name';
      if (key === 'events.activities.activity.description') return 'Description';
      if (key === 'events.activities.activity.showPublicly') return 'Show Publicly';
      if (key === 'events.activities.activity.limitApplicants') return 'Limit Applicants';
      if (key === 'events.activities.activity.allowSpecifyQuantity') return 'Allow Specify Quantity';
      if (key === 'events.activities.activity.useTermsAndConditions') return 'Use Terms and Conditions';
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

// ── Test payment methods (simulating API data) ──

const CARD_METHOD = { id: 'pm-card-001', name: 'Card Payment (Stripe)' };
const OFFLINE_METHOD = { id: 'pm-offline-001', name: 'Pay Offline' };
const ALL_PAYMENT_METHODS = [CARD_METHOD, OFFLINE_METHOD];

// ── Generators ──

/** Base activity with fee = 0 and random field values */
const feeZeroActivityArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  showPublicly: fc.boolean(),
  applicationFormId: fc.constant(''),
  limitApplicants: fc.boolean(),
  allowSpecifyQuantity: fc.boolean(),
  useTermsAndConditions: fc.boolean(),
  fee: fc.constant(0),
  supportedPaymentMethods: fc.constant([] as string[]),
  handlingFeeIncluded: fc.boolean(),
  chequePaymentInstructions: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
});

/** Activity with fee > 0 and a card-based payment method selected (shows handling fee toggle) */
const cardPaymentActivityArb = fc.record({
  name: fc.constant('Test Activity'),
  description: fc.constant('Test Description'),
  showPublicly: fc.constant(true),
  applicationFormId: fc.constant(''),
  limitApplicants: fc.constant(false),
  allowSpecifyQuantity: fc.constant(false),
  useTermsAndConditions: fc.constant(false),
  fee: fc.integer({ min: 1, max: 999999 }).map((cents) => cents / 100),
  supportedPaymentMethods: fc.constantFrom(
    [CARD_METHOD.id],
    [CARD_METHOD.id, OFFLINE_METHOD.id],
  ),
  handlingFeeIncluded: fc.boolean(),
  chequePaymentInstructions: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
});

/** Activity with fee > 0 and an offline payment method selected (shows cheque instructions) */
const chequePaymentActivityArb = fc.record({
  name: fc.constant('Test Activity'),
  description: fc.constant('Test Description'),
  showPublicly: fc.constant(true),
  applicationFormId: fc.constant(''),
  limitApplicants: fc.constant(false),
  allowSpecifyQuantity: fc.constant(false),
  useTermsAndConditions: fc.constant(false),
  fee: fc.integer({ min: 1, max: 999999 }).map((cents) => cents / 100),
  supportedPaymentMethods: fc.constantFrom(
    [OFFLINE_METHOD.id],
    [CARD_METHOD.id, OFFLINE_METHOD.id],
  ),
  handlingFeeIncluded: fc.constant(false),
  chequePaymentInstructions: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
});

describe('Feature: event-activity-payment-methods-standardization, Property 2: Preservation — Fee-Zero Hides Payment UI and Other Fields Unchanged', () => {
  const noop = vi.fn();

  beforeEach(() => {
    noop.mockClear();
    cleanup();
  });

  /**
   * Property: For all fee values where fee === 0, no payment method UI is rendered.
   * Generates random activity data with fee=0, asserts no payment Select/dropdown,
   * no handling fee toggle, and no cheque instructions field exist.
   *
   * **Validates: Requirements 3.1**
   */
  it('should NOT render payment method UI, handling fee toggle, or cheque instructions when fee = 0', () => {
    fc.assert(
      fc.property(feeZeroActivityArb, (activityData) => {
        const activity: EventActivityFormData = activityData;

        const { container } = render(
          <EventActivityForm
            activity={activity}
            index={0}
            onChange={noop}
            onRemove={noop}
            paymentMethods={ALL_PAYMENT_METHODS}
          />,
        );

        const allText = container.textContent || '';
        const labels = Array.from(container.querySelectorAll('label'));

        // Payment method selection UI should NOT be rendered
        const paymentLabel = labels.find(
          (l) =>
            l.textContent?.includes('Allowed Payment Methods') ||
            l.textContent?.includes('Supported Payment Methods'),
        );
        expect(paymentLabel).toBeFalsy();

        // Handling fee toggle should NOT be rendered
        const handlingFeeLabel = labels.find((l) =>
          l.textContent?.includes('Handling fee included'),
        );
        expect(handlingFeeLabel).toBeFalsy();

        // Cheque payment instructions should NOT be rendered
        const chequeLabel = labels.find((l) =>
          l.textContent?.includes('Cheque payment instructions'),
        );
        expect(chequeLabel).toBeFalsy();

        cleanup();
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property: For all non-payment fields (name, description, showPublicly, limitApplicants,
   * allowSpecifyQuantity, useTermsAndConditions), changing the field value via onChange
   * produces the correct updated activity object regardless of payment method configuration.
   *
   * **Validates: Requirements 3.5**
   */
  it('should correctly update non-payment fields via onChange regardless of payment method config', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          [CARD_METHOD.id],
          [OFFLINE_METHOD.id],
          [CARD_METHOD.id, OFFLINE_METHOD.id],
        ),
        fc.string({ minLength: 1, maxLength: 50 }),
        (paymentMethods, newName) => {
          let capturedActivity: EventActivityFormData | null = null;
          const captureOnChange = (updated: EventActivityFormData) => {
            capturedActivity = updated;
          };

          const activity: EventActivityFormData = {
            name: 'Original Name',
            description: 'Original Description',
            showPublicly: true,
            applicationFormId: '',
            limitApplicants: false,
            allowSpecifyQuantity: false,
            useTermsAndConditions: false,
            fee: 10,
            supportedPaymentMethods: paymentMethods,
            handlingFeeIncluded: false,
          };

          const { container } = render(
            <EventActivityForm
              activity={activity}
              index={0}
              onChange={captureOnChange}
              onRemove={noop}
              paymentMethods={ALL_PAYMENT_METHODS}
            />,
          );

          // Find the name input and change it
          const nameInput = container.querySelector('input[value="Original Name"]') as HTMLInputElement;
          expect(nameInput).toBeTruthy();
          fireEvent.change(nameInput, { target: { value: newName } });

          // Verify onChange was called with the correct updated activity
          expect(capturedActivity).toBeTruthy();
          expect(capturedActivity!.name).toBe(newName);
          // All other fields should remain unchanged
          expect(capturedActivity!.description).toBe('Original Description');
          expect(capturedActivity!.showPublicly).toBe(true);
          expect(capturedActivity!.fee).toBe(10);
          expect(capturedActivity!.supportedPaymentMethods).toEqual(paymentMethods);

          cleanup();
        },
      ),
      { numRuns: 30 },
    );
  });

  /**
   * Property: For boolean checkbox fields (showPublicly, limitApplicants, allowSpecifyQuantity,
   * useTermsAndConditions), toggling produces the correct updated value in onChange.
   *
   * **Validates: Requirements 3.5**
   */
  it('should correctly toggle boolean checkbox fields regardless of payment method config', () => {
    const booleanFields = [
      { field: 'showPublicly' as const, label: 'Show Publicly' },
      { field: 'limitApplicants' as const, label: 'Limit Applicants' },
      { field: 'allowSpecifyQuantity' as const, label: 'Allow Specify Quantity' },
      { field: 'useTermsAndConditions' as const, label: 'Use Terms and Conditions' },
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...booleanFields),
        fc.boolean(),
        fc.constantFrom(
          [CARD_METHOD.id],
          [OFFLINE_METHOD.id],
          [CARD_METHOD.id, OFFLINE_METHOD.id],
        ),
        (fieldInfo, initialValue, paymentMethods) => {
          let capturedActivity: EventActivityFormData | null = null;
          const captureOnChange = (updated: EventActivityFormData) => {
            capturedActivity = updated;
          };

          const activity: EventActivityFormData = {
            name: 'Test Activity',
            description: 'Test Description',
            showPublicly: fieldInfo.field === 'showPublicly' ? initialValue : true,
            applicationFormId: '',
            limitApplicants: fieldInfo.field === 'limitApplicants' ? initialValue : false,
            allowSpecifyQuantity: fieldInfo.field === 'allowSpecifyQuantity' ? initialValue : false,
            useTermsAndConditions: fieldInfo.field === 'useTermsAndConditions' ? initialValue : false,
            fee: 10,
            supportedPaymentMethods: paymentMethods,
            handlingFeeIncluded: false,
          };

          const { container } = render(
            <EventActivityForm
              activity={activity}
              index={0}
              onChange={captureOnChange}
              onRemove={noop}
              paymentMethods={ALL_PAYMENT_METHODS}
            />,
          );

          // Find the checkbox by its label text
          const labels = Array.from(container.querySelectorAll('.MuiFormControlLabel-root'));
          const targetLabel = labels.find((l) => l.textContent?.includes(fieldInfo.label));
          expect(targetLabel).toBeTruthy();

          const checkbox = targetLabel!.querySelector('input[type="checkbox"]') as HTMLInputElement;
          expect(checkbox).toBeTruthy();

          // Toggle the checkbox
          fireEvent.click(checkbox);

          // Verify onChange was called with the toggled value
          expect(capturedActivity).toBeTruthy();
          expect(capturedActivity![fieldInfo.field]).toBe(!initialValue);

          cleanup();
        },
      ),
      { numRuns: 30 },
    );
  });

  /**
   * Property: For all boolean values of handlingFeeIncluded, toggling the checkbox
   * produces the correct value in onChange.
   *
   * **Validates: Requirements 3.3**
   */
  it('should correctly store handlingFeeIncluded boolean when checkbox is toggled', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom(
          [CARD_METHOD.id],
          [CARD_METHOD.id, OFFLINE_METHOD.id],
        ),
        (initialHandlingFee, selectedMethods) => {
          let capturedActivity: EventActivityFormData | null = null;
          const captureOnChange = (updated: EventActivityFormData) => {
            capturedActivity = updated;
          };

          const activity: EventActivityFormData = {
            name: 'Test Activity',
            description: 'Test Description',
            showPublicly: true,
            applicationFormId: '',
            limitApplicants: false,
            allowSpecifyQuantity: false,
            useTermsAndConditions: false,
            fee: 50,
            supportedPaymentMethods: selectedMethods,
            handlingFeeIncluded: initialHandlingFee,
          };

          const { container } = render(
            <EventActivityForm
              activity={activity}
              index={0}
              onChange={captureOnChange}
              onRemove={noop}
              paymentMethods={ALL_PAYMENT_METHODS}
            />,
          );

          // Find the handling fee checkbox
          const labels = Array.from(container.querySelectorAll('.MuiFormControlLabel-root'));
          const handlingFeeLabel = labels.find((l) =>
            l.textContent?.includes('Handling fee included'),
          );
          expect(handlingFeeLabel).toBeTruthy();

          const checkbox = handlingFeeLabel!.querySelector('input[type="checkbox"]') as HTMLInputElement;
          expect(checkbox).toBeTruthy();

          // Toggle the checkbox
          fireEvent.click(checkbox);

          // Verify onChange was called with the toggled value
          expect(capturedActivity).toBeTruthy();
          expect(capturedActivity!.handlingFeeIncluded).toBe(!initialHandlingFee);

          cleanup();
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * Property: For all string values of chequePaymentInstructions, entering text
   * produces the correct value in onChange.
   *
   * **Validates: Requirements 3.4**
   */
  it('should correctly store chequePaymentInstructions text when entered', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          [OFFLINE_METHOD.id],
          [CARD_METHOD.id, OFFLINE_METHOD.id],
        ),
        fc.string({ minLength: 1, maxLength: 200 }),
        (selectedMethods, instructionsText) => {
          let capturedActivity: EventActivityFormData | null = null;
          const captureOnChange = (updated: EventActivityFormData) => {
            capturedActivity = updated;
          };

          const activity: EventActivityFormData = {
            name: 'Test Activity',
            description: 'Test Description',
            showPublicly: true,
            applicationFormId: '',
            limitApplicants: false,
            allowSpecifyQuantity: false,
            useTermsAndConditions: false,
            fee: 50,
            supportedPaymentMethods: selectedMethods,
            handlingFeeIncluded: false,
            chequePaymentInstructions: '',
          };

          const { container } = render(
            <EventActivityForm
              activity={activity}
              index={0}
              onChange={captureOnChange}
              onRemove={noop}
              paymentMethods={ALL_PAYMENT_METHODS}
            />,
          );

          // Find the cheque payment instructions textarea
          const textareas = Array.from(container.querySelectorAll('textarea'));
          // The cheque instructions field is a multiline TextField — find it by looking
          // for the textarea within the cheque instructions form control
          const labels = Array.from(container.querySelectorAll('label'));
          const chequeLabel = labels.find((l) =>
            l.textContent?.includes('Cheque payment instructions'),
          );
          expect(chequeLabel).toBeTruthy();

          // Get the textarea associated with this label (in the same form control)
          const formControl = chequeLabel!.closest('.MuiFormControl-root');
          expect(formControl).toBeTruthy();
          const textarea = formControl!.querySelector('textarea') as HTMLTextAreaElement;
          expect(textarea).toBeTruthy();

          // Enter text
          fireEvent.change(textarea, { target: { value: instructionsText } });

          // Verify onChange was called with the correct text
          expect(capturedActivity).toBeTruthy();
          expect(capturedActivity!.chequePaymentInstructions).toBe(instructionsText);

          cleanup();
        },
      ),
      { numRuns: 30 },
    );
  });
});
