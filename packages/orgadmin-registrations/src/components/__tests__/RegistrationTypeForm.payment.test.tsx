/**
 * Unit Tests for RegistrationTypeForm Payment Configuration
 *
 * Tests specific examples and edge cases for fee field rendering,
 * handling fee checkbox visibility, and default values.
 *
 * Requirements: 3.1, 3.2, 4.1, 8.1, 8.3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

const mockExecute = vi.fn();
let mockOrganisation = { id: 'org-1', currency: 'EUR' };

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

vi.mock('date-fns', () => ({}));
vi.mock('date-fns/locale', () => ({ enGB: {} }));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label, value, onChange }: any) => (
    <div data-testid={`date-picker-${label}`}>
      <input
        data-testid={`date-input-${label}`}
        value={value || ''}
        onChange={(e: any) => onChange?.(e.target.value)}
      />
    </div>
  ),
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

vi.mock('react-quill', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea data-testid="react-quill" value={value || ''} onChange={(e: any) => onChange?.(e.target.value)} />
  ),
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === 'payment.fee' && opts?.currency) return `Fee (${opts.currency})`;
      if (key === 'payment.feeHelper') return 'The amount to charge for this type';
      if (key === 'payment.handlingFeeIncluded') return 'Handling fee included';
      if (key === 'payment.handlingFeeIncludedHelper')
        return 'When enabled, the card processing fee is absorbed into the price. When disabled, the processing fee is added on top at checkout.';
      return key;
    },
    i18n: { language: 'en' },
  }),
  useCapabilities: () => ({ hasCapability: () => false }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({ organisation: mockOrganisation }),
}));

vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: () => <div data-testid="discount-selector" />,
}));

import RegistrationTypeForm from '../RegistrationTypeForm';
import type { RegistrationTypeFormData } from '../../types/registration.types';

// ── Constants ──

const PAYMENT_METHODS = [
  { id: 'stripe', name: 'Stripe' },
  { id: 'pay-offline', name: 'Pay Offline' },
  { id: 'card', name: 'Card' },
];

const defaultProps = {
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
  isEditing: false,
};

// ── Helpers ──

function setupMocks(methods = PAYMENT_METHODS) {
  mockExecute.mockImplementation(({ url }: any) => {
    if (url?.includes('/application-forms')) return Promise.resolve([{ id: 'form-1', name: 'Default Form' }]);
    if (url?.includes('/payment-methods')) return Promise.resolve(methods);
    return Promise.resolve([]);
  });
}

function renderForm(initialOverrides: Partial<RegistrationTypeFormData> = {}, currency = 'EUR') {
  mockOrganisation = { id: 'org-1', currency };

  const initialValues: RegistrationTypeFormData = {
    name: 'Test Registration',
    description: 'Test description',
    entityName: 'Horse',
    registrationFormId: 'form-1',
    registrationStatus: 'open',
    isRollingRegistration: true,
    numberOfMonths: 12,
    automaticallyApprove: false,
    registrationLabels: [],
    supportedPaymentMethods: [],
    fee: 0,
    handlingFeeIncluded: false,
    useTermsAndConditions: false,
    discountIds: [],
    ...initialOverrides,
  };

  return render(
    <RegistrationTypeForm {...defaultProps} initialValues={initialValues} />,
  );
}

// ── Tests ──

describe('RegistrationTypeForm payment configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // Validates: Requirement 3.1 — fee field labelled with organisation currency code
  it('renders fee field with "EUR" label when org currency is EUR', async () => {
    const { container } = renderForm({}, 'EUR');

    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('label'));
      const feeLabel = labels.find((label) => label.textContent?.includes('Fee (EUR)'));
      expect(feeLabel).toBeTruthy();
    });
  });

  // Validates: Requirement 8.3 — handling fee hidden when fee is 0
  it('hides handling fee checkbox when fee is 0', async () => {
    const { container } = renderForm({ fee: 0, supportedPaymentMethods: ['stripe'] });

    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('label'));
      const feeLabel = labels.find((l) => l.textContent?.includes('Fee (EUR)'));
      expect(feeLabel).toBeTruthy();
    });

    const labels = Array.from(container.querySelectorAll('label'));
    const handlingFeeLabel = labels.find((l) => l.textContent?.includes('Handling fee included'));
    expect(handlingFeeLabel).toBeFalsy();
  });

  // Validates: Requirements 4.1, 8.3 — handling fee visible when fee > 0 and card payment selected
  it('shows handling fee checkbox when fee is 50 and payment methods include stripe', async () => {
    const { container } = renderForm({ fee: 50, supportedPaymentMethods: ['stripe'] });

    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('label'));
      const handlingFeeLabel = labels.find((l) => l.textContent?.includes('Handling fee included'));
      expect(handlingFeeLabel).toBeTruthy();
    });
  });

  // Validates: Requirement 8.3 — handling fee hidden when no card-based payment method
  it('hides handling fee checkbox when payment methods are only pay-offline', async () => {
    const { container } = renderForm({ fee: 50, supportedPaymentMethods: ['pay-offline'] });

    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('label'));
      const feeLabel = labels.find((l) => l.textContent?.includes('Fee (EUR)'));
      expect(feeLabel).toBeTruthy();
    });

    const labels = Array.from(container.querySelectorAll('label'));
    const handlingFeeLabel = labels.find((l) => l.textContent?.includes('Handling fee included'));
    expect(handlingFeeLabel).toBeFalsy();
  });

  // Validates: Requirements 3.2, 8.1 — default values for fee and handlingFeeIncluded
  it('uses default values of fee 0.00 and handlingFeeIncluded false', async () => {
    const { container } = renderForm();

    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('label'));
      const feeLabel = labels.find((l) => l.textContent?.includes('Fee'));
      expect(feeLabel).toBeTruthy();
    });

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
