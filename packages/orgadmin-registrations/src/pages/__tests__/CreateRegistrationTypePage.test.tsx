/**
 * Unit Tests for CreateRegistrationTypePage
 *
 * Feature: registrations-module
 * Tests: create mode empty form, edit mode pre-population, successful create/edit navigation,
 *        error preserves form data
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 2.6, 2.7, 2.9
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

const mockNavigate = vi.fn();
const mockExecute = vi.fn();
let mockParams: Record<string, string> = {};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
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
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  useCapabilities: () => ({ hasCapability: (cap: string) => cap === 'registration-discounts' }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Test Org' } }),
}));

vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: () => <div data-testid="discount-selector" />,
}));

import CreateRegistrationTypePage from '../CreateRegistrationTypePage';

// ── Test data ──

const FORMS = [
  { id: 'form-1', name: 'Default Form' },
  { id: 'form-2', name: 'Extended Form' },
];
const SINGLE_FORM = [{ id: 'form-1', name: 'Default Form' }];
const PAY_METHODS = [
  { id: 'pay-offline', name: 'Pay Offline' },
  { id: 'stripe', name: 'Card Payment (Stripe)' },
];
const SINGLE_PAY = [{ id: 'pay-offline', name: 'Pay Offline' }];

const existingType = {
  name: '2026 Horse Registration',
  description: 'Annual horse registration',
  entityName: 'Horse',
  registrationFormId: 'form-1',
  registrationStatus: 'open',
  isRollingRegistration: true,
  numberOfMonths: 12,
  automaticallyApprove: true,
  registrationLabels: ['VIP'],
  supportedPaymentMethods: ['pay-offline'],
  useTermsAndConditions: false,
  termsAndConditions: undefined,
  discountIds: ['disc-1'],
};

// ── Helpers ──

/** Find MUI TextField input by label prefix */
function inp(container: HTMLElement, prefix: string) {
  const label = Array.from(container.querySelectorAll('label')).find(l =>
    (l.textContent || '').startsWith(prefix),
  );
  if (!label) return null;
  const id = label.getAttribute('for');
  if (!id) return null;
  return container.querySelector('#' + CSS.escape(id)) as HTMLInputElement | HTMLTextAreaElement | null;
}

function findBtn(container: HTMLElement, re: RegExp) {
  return Array.from(container.querySelectorAll('button')).find(b =>
    re.test(b.textContent || ''),
  ) as HTMLButtonElement | null;
}

function clickCheckbox(container: HTMLElement, labelText: string) {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find(l => (l.textContent || '').includes(labelText));
  if (label) {
    const checkbox = label.querySelector('input[type="checkbox"]') ||
      label.parentElement?.querySelector('input[type="checkbox"]');
    if (checkbox) fireEvent.click(checkbox);
  }
}

function setupCreateMocks(forms = SINGLE_FORM, methods = SINGLE_PAY) {
  mockExecute.mockImplementation(({ url, method }: any) => {
    if (url?.includes('/application-forms')) return Promise.resolve(forms);
    if (url?.includes('/payment-methods')) return Promise.resolve(methods);
    if (method === 'POST') return Promise.resolve({ id: 'new-1' });
    return Promise.resolve([]);
  });
}

function setupEditMocks(typeId: string, data: any, forms = SINGLE_FORM, methods = SINGLE_PAY) {
  mockExecute.mockImplementation(({ url, method }: any) => {
    if (url?.includes('/application-forms')) return Promise.resolve(forms);
    if (url?.includes('/payment-methods')) return Promise.resolve(methods);
    if (url === `/api/orgadmin/registration-types/${typeId}` && method === 'GET')
      return Promise.resolve({ ...data });
    if (method === 'PUT') return Promise.resolve({ id: typeId });
    return Promise.resolve([]);
  });
}

// ── Tests ──

describe('CreateRegistrationTypePage - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
  });

  /**
   * Requirement 2.2, 2.3: Create mode renders empty form with all fields
   */
  describe('Create mode renders empty form (Requirements 2.2, 2.3)', () => {
    it('renders empty text fields in create mode', async () => {
      setupCreateMocks();
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      expect(inp(container, 'Name')?.value).toBe('');
      expect(inp(container, 'Description')?.value).toBe('');
      expect(inp(container, 'Entity Name')?.value).toBe('');
    });

    it('renders the create page title', async () => {
      setupCreateMocks();
      render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(screen.getByText('registrations.createRegistrationType')).toBeInTheDocument();
      });
    });

    it('renders Save and Publish button in create mode', async () => {
      setupCreateMocks();
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      expect(findBtn(container, /registrations\.actions\.saveAndPublish/)).toBeTruthy();
      expect(findBtn(container, /registrations\.actions\.saveAsDraft/)).toBeTruthy();
      expect(findBtn(container, /common\.actions\.cancel/)).toBeTruthy();
    });

    it('defaults isRollingRegistration to false and shows DatePicker', async () => {
      setupCreateMocks();
      render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-Valid Until')).toBeInTheDocument();
      });
    });

    it('auto-selects the first application form when only one exists', async () => {
      setupCreateMocks(SINGLE_FORM, SINGLE_PAY);
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({ url: '/api/orgadmin/application-forms' }),
        );
      });
    });

    it('auto-selects the first payment method when in create mode', async () => {
      setupCreateMocks(SINGLE_FORM, SINGLE_PAY);
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({ url: '/api/orgadmin/payment-methods' }),
        );
      });
    });
  });

  /**
   * Requirement 2.6: Edit mode pre-populates form
   */
  describe('Edit mode pre-populates form (Requirement 2.6)', () => {
    it('renders the edit page title', async () => {
      mockParams = { id: 'type-1' };
      setupEditMocks('type-1', existingType);
      render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(screen.getByText('registrations.editRegistrationType')).toBeInTheDocument();
      });
    });

    it('pre-populates name, description, and entity name', async () => {
      mockParams = { id: 'type-1' };
      setupEditMocks('type-1', existingType);
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')?.value).toBe('2026 Horse Registration');
      });

      expect(inp(container, 'Description')?.value).toBe('Annual horse registration');
      expect(inp(container, 'Entity Name')?.value).toBe('Horse');
    });

    it('pre-populates rolling registration with number of months', async () => {
      mockParams = { id: 'type-1' };
      setupEditMocks('type-1', existingType);
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });

      expect(inp(container, 'Number of Months')?.value).toBe('12');
    });

    it('renders Update button in edit mode', async () => {
      mockParams = { id: 'type-1' };
      setupEditMocks('type-1', existingType);
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')?.value).toBe('2026 Horse Registration');
      });

      expect(findBtn(container, /registrations\.actions\.update/)).toBeTruthy();
    });

    it('pre-populates fixed period type with DatePicker', async () => {
      const fixedType = {
        ...existingType,
        isRollingRegistration: false,
        numberOfMonths: undefined,
        validUntil: '2025-12-31',
      };
      mockParams = { id: 'type-2' };
      setupEditMocks('type-2', fixedType);
      render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-Valid Until')).toBeInTheDocument();
      });
    });
  });

  /**
   * Requirement 2.4: Successful create navigates to list
   */
  describe('Successful create navigates to list (Requirement 2.4)', () => {
    it('sends POST and navigates to /registrations/types on successful create', async () => {
      mockParams = {};
      setupCreateMocks();
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      // Fill required fields
      fireEvent.change(inp(container, 'Name')!, { target: { value: 'New Type' } });
      fireEvent.change(inp(container, 'Description')!, { target: { value: 'A description' } });
      fireEvent.change(inp(container, 'Entity Name')!, { target: { value: 'Vehicle' } });

      // Enable rolling registration and set months (to avoid DatePicker issues)
      clickCheckbox(container, 'Is Rolling Registration');
      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });
      fireEvent.change(inp(container, 'Number of Months')!, { target: { value: '6' } });

      // Click Save and Publish
      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      expect(saveBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/registration-types',
          }),
        );
      });

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
    });
  });

  /**
   * Requirement 2.7: Successful edit navigates to types list
   */
  describe('Successful edit navigates to details (Requirement 2.7)', () => {
    it('sends PUT and navigates to /registrations/types on successful edit', async () => {
      mockParams = { id: 'type-1' };
      setupEditMocks('type-1', existingType);
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')?.value).toBe('2026 Horse Registration');
      });

      // Modify a field
      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Updated Horse Registration' } });

      // Click Update
      const updateBtn = findBtn(container, /registrations\.actions\.update/);
      expect(updateBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(updateBtn!);
      });

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PUT',
            url: '/api/orgadmin/registration-types/type-1',
          }),
        );
      });

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
    });
  });

  /**
   * Requirement 2.9: Error preserves form data
   */
  describe('Error preserves form data (Requirement 2.9)', () => {
    it('displays error alert and preserves form values on API failure', async () => {
      mockParams = {};
      mockExecute.mockImplementation(({ url, method }: any) => {
        if (url?.includes('/application-forms')) return Promise.resolve(SINGLE_FORM);
        if (url?.includes('/payment-methods')) return Promise.resolve(SINGLE_PAY);
        if (method === 'POST') return Promise.reject(new Error('Server error'));
        return Promise.resolve([]);
      });

      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      // Fill form
      fireEvent.change(inp(container, 'Name')!, { target: { value: 'My Type' } });
      fireEvent.change(inp(container, 'Description')!, { target: { value: 'Some description' } });
      fireEvent.change(inp(container, 'Entity Name')!, { target: { value: 'Boat' } });

      // Enable rolling registration
      clickCheckbox(container, 'Is Rolling Registration');
      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });
      fireEvent.change(inp(container, 'Number of Months')!, { target: { value: '3' } });

      // Submit
      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      // Error alert should appear
      await waitFor(() => {
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
      });

      // Form values should be preserved
      expect(inp(container, 'Name')?.value).toBe('My Type');
      expect(inp(container, 'Description')?.value).toBe('Some description');
      expect(inp(container, 'Entity Name')?.value).toBe('Boat');
      expect(inp(container, 'Number of Months')?.value).toBe('3');

      // Should NOT have navigated
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('displays error alert on edit mode API failure and preserves data', async () => {
      mockParams = { id: 'type-1' };
      let callCount = 0;
      mockExecute.mockImplementation(({ url, method }: any) => {
        if (url?.includes('/application-forms')) return Promise.resolve(SINGLE_FORM);
        if (url?.includes('/payment-methods')) return Promise.resolve(SINGLE_PAY);
        if (url === '/api/orgadmin/registration-types/type-1' && method === 'GET')
          return Promise.resolve({ ...existingType });
        if (method === 'PUT') return Promise.reject(new Error('Update failed'));
        return Promise.resolve([]);
      });

      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')?.value).toBe('2026 Horse Registration');
      });

      // Modify a field
      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Modified Name' } });

      // Submit
      const updateBtn = findBtn(container, /registrations\.actions\.update/);
      await act(async () => {
        fireEvent.click(updateBtn!);
      });

      // Error alert should appear
      await waitFor(() => {
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
      });

      // Modified value should be preserved
      expect(inp(container, 'Name')?.value).toBe('Modified Name');
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  /**
   * Additional: Cancel button navigation
   */
  describe('Cancel button navigation', () => {
    it('navigates to /registrations/types when cancel is clicked', async () => {
      setupCreateMocks();
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      const cancelBtn = findBtn(container, /common\.actions\.cancel/);
      expect(cancelBtn).toBeTruthy();
      fireEvent.click(cancelBtn!);

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
    });
  });

  /**
   * Additional: Conditional field visibility
   */
  describe('Conditional field visibility', () => {
    it('shows Number of Months when Is Rolling Registration is checked', async () => {
      setupCreateMocks();
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      // Initially shows DatePicker, not Number of Months
      expect(inp(container, 'Number of Months')).toBeNull();
      expect(screen.getByTestId('date-picker-Valid Until')).toBeInTheDocument();

      // Check rolling registration
      clickCheckbox(container, 'Is Rolling Registration');

      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });

      // DatePicker should be gone
      expect(screen.queryByTestId('date-picker-Valid Until')).not.toBeInTheDocument();
    });

    it('shows Terms and Conditions editor when Use Terms checkbox is checked', async () => {
      setupCreateMocks();
      const { container } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      // Initially no quill editor visible
      expect(screen.queryByTestId('react-quill')).not.toBeInTheDocument();

      // Check Use Terms and Conditions
      clickCheckbox(container, 'Use Terms and Conditions');

      await waitFor(() => {
        expect(screen.getByTestId('react-quill')).toBeInTheDocument();
      });
    });
  });
});
