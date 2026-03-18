/**
 * Unit Tests for CreateMerchandiseTypePage Handling Fee Toggle
 *
 * Tests handling fee checkbox visibility based on selected payment methods.
 * Merchandise has inherent pricing (option prices), so the toggle appears
 * whenever a card-based payment method is selected (no fee > 0 check needed).
 *
 * Requirements: 6.1, 8.3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

const mockNavigate = vi.fn();
const mockExecute = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
  };
});

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === 'payment.handlingFeeIncluded') return 'Handling fee included';
      if (key === 'payment.handlingFeeIncludedHelper')
        return 'When enabled, the card processing fee is absorbed into the price.';
      if (key === 'merchandise.fields.supportedPaymentMethods')
        return 'Supported Payment Methods';
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useOrganisation: () => ({
    organisation: { id: 'org-1', currency: 'EUR' },
  }),
  useApi: () => ({
    execute: mockExecute,
  }),
}));

vi.mock('../../components/ImageGalleryUpload', () => ({
  __esModule: true,
  default: () => <div data-testid="image-gallery-upload" />,
}));

vi.mock('../../components/OptionsConfigurationSection', () => ({
  __esModule: true,
  default: () => <div data-testid="options-configuration-section" />,
}));

vi.mock('../../components/StockManagementSection', () => ({
  __esModule: true,
  default: () => <div data-testid="stock-management-section" />,
}));

vi.mock('../../components/DeliveryConfigurationSection', () => ({
  __esModule: true,
  default: () => <div data-testid="delivery-configuration-section" />,
}));

vi.mock('../../components/OrderQuantityRulesSection', () => ({
  __esModule: true,
  default: () => <div data-testid="order-quantity-rules-section" />,
}));

import CreateMerchandiseTypePage from '../CreateMerchandiseTypePage';

// ── Constants ──

const PAYMENT_METHODS = [
  { id: 'stripe', name: 'Card Payment (Stripe)' },
  { id: 'pay-offline', name: 'Pay Offline' },
];

// ── Helpers ──

function findHandlingFeeLabel(container: HTMLElement): Element | undefined {
  const labels = Array.from(container.querySelectorAll('label'));
  return labels.find((l) => l.textContent?.includes('Handling fee included'));
}

async function selectPaymentMethod(container: HTMLElement, methodName: string) {
  // MUI Select renders a div with role="combobox" — find the payment methods one
  const selects = Array.from(container.querySelectorAll('[role="combobox"]'));
  // The payment methods select is the one inside the payment section
  // Find it by looking for the select that's near the "Supported Payment Methods" label
  const paymentSelect = selects.find((el) => {
    const formControl = el.closest('.MuiFormControl-root');
    return formControl?.textContent?.includes('Supported Payment Methods');
  });

  if (!paymentSelect) throw new Error('Payment methods select not found');

  // Open the dropdown
  fireEvent.mouseDown(paymentSelect);

  // Wait for the listbox to appear and select the option
  const listbox = document.querySelector('[role="listbox"]');
  if (!listbox) throw new Error('Listbox not found');

  const option = Array.from(listbox.querySelectorAll('[role="option"]')).find(
    (el) => el.textContent === methodName,
  );
  if (!option) throw new Error(`Option "${methodName}" not found`);

  fireEvent.click(option);
}

// ── Tests ──

describe('CreateMerchandiseTypePage handling fee toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(PAYMENT_METHODS);
  });

  // Validates: Requirements 6.1, 8.3 — toggle visible when card-based payment method selected
  it('shows handling fee checkbox when payment methods include stripe', async () => {
    const { container } = render(<CreateMerchandiseTypePage />);

    // Wait for payment methods to load
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalled();
    });

    // Select stripe payment method
    await selectPaymentMethod(container, 'Card Payment (Stripe)');

    // The handling fee toggle should now be visible
    expect(findHandlingFeeLabel(container)).toBeTruthy();
  });

  // Validates: Requirement 8.3 — toggle hidden when no card-based payment method
  it('hides handling fee checkbox when payment methods are only pay-offline', async () => {
    const { container } = render(<CreateMerchandiseTypePage />);

    // Wait for payment methods to load
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalled();
    });

    // Select pay-offline payment method
    await selectPaymentMethod(container, 'Pay Offline');

    // The handling fee toggle should NOT be visible
    expect(findHandlingFeeLabel(container)).toBeFalsy();
  });
});
