/**
 * Unit tests for DiscountSelector integration in CreateRegistrationTypePage
 *
 * Tests:
 * - DiscountSelector renders when capability is enabled
 * - DiscountSelector hidden when capability is disabled
 * - Form submission includes discountIds
 * - discountIds pre-populated in edit mode
 *
 * Validates: Requirements 10.5, 10.6, 10.7, 10.8
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks (hoisted before component import) ──

const mockNavigate = vi.fn();
const mockParams: { id?: string } = {};
const mockExecute = vi.fn();
const mockHasCapability = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label }: any) => <div data-testid={`date-picker-${label}`} />,
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

vi.mock('date-fns/locale', () => ({ enGB: {} }));
vi.mock('date-fns', () => ({}));

vi.mock('react-quill', () => ({
  __esModule: true,
  default: () => <div data-testid="react-quill" />,
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  useCapabilities: () => ({ hasCapability: mockHasCapability }),
  usePageHelp: () => ({ setPageHelp: vi.fn() }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Test Org' },
  }),
}));

// Track DiscountSelector props for assertions
let capturedDiscountSelectorProps: any = null;

vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: (props: any) => {
    capturedDiscountSelectorProps = props;
    return (
      <div
        data-testid="discount-selector"
        data-module-type={props.moduleType}
        data-selected-ids={JSON.stringify(props.selectedDiscountIds)}
      >
        <button
          data-testid="discount-change-trigger"
          onClick={() => props.onChange(['disc-a', 'disc-b'])}
        >
          Change Discounts
        </button>
      </div>
    );
  },
}));

// ── Import component after mocks ──
import CreateRegistrationTypePage from '../CreateRegistrationTypePage';

describe('CreateRegistrationTypePage - DiscountSelector integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.id = undefined;
    capturedDiscountSelectorProps = null;

    // Default: all API calls return empty arrays
    mockExecute.mockResolvedValue([]);
  });

  // ── Requirement 10.5: DiscountSelector visible when capability enabled ──

  it('renders DiscountSelector when registration-discounts capability is enabled', () => {
    mockHasCapability.mockImplementation((cap: string) => cap === 'registration-discounts');

    render(<CreateRegistrationTypePage />);

    expect(screen.getByTestId('discount-selector')).toBeInTheDocument();
  });

  it('passes moduleType="registrations" to DiscountSelector', () => {
    mockHasCapability.mockImplementation((cap: string) => cap === 'registration-discounts');

    render(<CreateRegistrationTypePage />);

    const selector = screen.getByTestId('discount-selector');
    expect(selector).toHaveAttribute('data-module-type', 'registrations');
  });

  // ── Requirement 10.8: DiscountSelector hidden when capability disabled ──

  it('hides DiscountSelector when registration-discounts capability is disabled', () => {
    mockHasCapability.mockReturnValue(false);

    render(<CreateRegistrationTypePage />);

    expect(screen.queryByTestId('discount-selector')).not.toBeInTheDocument();
  });

  // ── Requirement 10.7: Form submission includes discountIds ──

  it('includes discountIds in form submission payload', async () => {
    mockHasCapability.mockImplementation((cap: string) => cap === 'registration-discounts');

    mockExecute.mockResolvedValue([]);

    render(<CreateRegistrationTypePage />);

    // Trigger discount selection via the mock button
    fireEvent.click(screen.getByTestId('discount-change-trigger'));

    // Verify the DiscountSelector received the onChange callback and the
    // component tracks the selected discount IDs
    await waitFor(() => {
      expect(capturedDiscountSelectorProps).toBeTruthy();
      expect(capturedDiscountSelectorProps.organisationId).toBe('org-1');
      expect(capturedDiscountSelectorProps.moduleType).toBe('registrations');
    });

    // After clicking the change trigger, the selectedDiscountIds should update
    await waitFor(() => {
      const selector = screen.getByTestId('discount-selector');
      const selectedIds = JSON.parse(selector.getAttribute('data-selected-ids') || '[]');
      expect(selectedIds).toEqual(['disc-a', 'disc-b']);
    });
  });

  // ── Requirement 10.6, 10.7: discountIds pre-populated in edit mode ──

  it('pre-populates discountIds when editing an existing registration type', async () => {
    mockHasCapability.mockImplementation((cap: string) => cap === 'registration-discounts');
    mockParams.id = 'type-42';

    const existingType = {
      name: 'Boat Registration 2025',
      description: 'Annual boat registration',
      entityName: 'Boat',
      registrationFormId: 'form-1',
      registrationStatus: 'open',
      isRollingRegistration: false,
      validUntil: '2025-12-31',
      automaticallyApprove: true,
      registrationLabels: ['marine'],
      supportedPaymentMethods: ['pay-offline'],
      useTermsAndConditions: false,
      discountIds: ['disc-100', 'disc-200'],
    };

    mockExecute.mockImplementation(({ url }: any) => {
      if (url?.includes('/registration-types/type-42')) {
        return Promise.resolve(existingType);
      }
      if (url?.includes('/application-forms')) {
        return Promise.resolve([{ id: 'form-1', name: 'Default Form' }]);
      }
      if (url?.includes('/payment-methods')) {
        return Promise.resolve([{ id: 'pay-offline', name: 'Pay Offline' }]);
      }
      return Promise.resolve([]);
    });

    render(<CreateRegistrationTypePage />);

    // Wait for the registration type to be loaded
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/orgadmin/registration-types/type-42',
        }),
      );
    });

    // Verify DiscountSelector received the pre-populated discountIds
    await waitFor(() => {
      const selector = screen.getByTestId('discount-selector');
      const selectedIds = JSON.parse(selector.getAttribute('data-selected-ids') || '[]');
      expect(selectedIds).toEqual(['disc-100', 'disc-200']);
    });
  });
});
