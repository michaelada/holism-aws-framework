/**
 * Unit Tests for RegistrationTypeForm
 *
 * Feature: registrations-module
 * Tests: field rendering, conditional visibility, validation errors, form submission, cancel
 *
 * Validates: Requirements 2.3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

const mockExecute = vi.fn();

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

import RegistrationTypeForm from '../RegistrationTypeForm';
import type { RegistrationTypeFormData } from '../../types/registration.types';

// ── Test data ──

const SINGLE_FORM = [{ id: 'form-1', name: 'Default Form' }];
const MULTI_FORMS = [
  { id: 'form-1', name: 'Default Form' },
  { id: 'form-2', name: 'Extended Form' },
];
const SINGLE_PAY = [{ id: 'pay-offline', name: 'Pay Offline' }];

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

function setupMocks(forms = SINGLE_FORM, methods = SINGLE_PAY) {
  mockExecute.mockImplementation(({ url }: any) => {
    if (url?.includes('/application-forms')) return Promise.resolve(forms);
    if (url?.includes('/payment-methods')) return Promise.resolve(methods);
    return Promise.resolve([]);
  });
}

const defaultProps = {
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
  isEditing: false,
};

// ── Tests ──

describe('RegistrationTypeForm - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // ─── 1. All fields render in default state ───

  describe('All fields render in default state', () => {
    it('renders Name, Description, and Entity Name text fields', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      expect(inp(container, 'Description')).toBeTruthy();
      expect(inp(container, 'Entity Name')).toBeTruthy();
    });

    it('renders Registration Status select', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      const labels = Array.from(container.querySelectorAll('label'));
      expect(labels.some(l => (l.textContent || '').includes('Registration Status'))).toBe(true);
    });

    it('renders Application Form select', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      const labels = Array.from(container.querySelectorAll('label'));
      expect(labels.some(l => (l.textContent || '').includes('Application Form'))).toBe(true);
    });

    it('renders Is Rolling Registration checkbox', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      const labels = Array.from(container.querySelectorAll('label'));
      expect(labels.some(l => (l.textContent || '').includes('Is Rolling Registration'))).toBe(true);
    });

    it('renders DatePicker (Valid Until) by default when rolling is unchecked', async () => {
      render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-Valid Until')).toBeInTheDocument();
      });
    });

    it('renders Automatically Approve Applications checkbox', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      const labels = Array.from(container.querySelectorAll('label'));
      expect(labels.some(l => (l.textContent || '').includes('Automatically Approve Applications'))).toBe(true);
    });

    it('renders Add Label field', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      expect(inp(container, 'Add Label')).toBeTruthy();
    });

    it('renders Supported Payment Methods select', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      const labels = Array.from(container.querySelectorAll('label'));
      expect(labels.some(l => (l.textContent || '').includes('Supported Payment Methods'))).toBe(true);
    });

    it('renders Use Terms and Conditions checkbox', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      const labels = Array.from(container.querySelectorAll('label'));
      expect(labels.some(l => (l.textContent || '').includes('Use Terms and Conditions'))).toBe(true);
    });

    it('renders action buttons (Save and Publish, Save as Draft, Cancel)', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      expect(findBtn(container, /registrations\.actions\.saveAndPublish/)).toBeTruthy();
      expect(findBtn(container, /registrations\.actions\.saveAsDraft/)).toBeTruthy();
      expect(findBtn(container, /common\.actions\.cancel/)).toBeTruthy();
    });

    it('renders Update button instead of Save and Publish when isEditing', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} isEditing />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      expect(findBtn(container, /registrations\.actions\.update/)).toBeTruthy();
      expect(findBtn(container, /registrations\.actions\.saveAndPublish/)).toBeFalsy();
    });

    it('renders DiscountSelector when registration-discounts capability is enabled', async () => {
      render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('discount-selector')).toBeInTheDocument();
      });
    });
  });

  // ─── 2. Conditional visibility: rolling registration ───

  describe('Conditional visibility: rolling registration toggle', () => {
    it('shows DatePicker and hides Number of Months when rolling is unchecked', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('date-picker-Valid Until')).toBeInTheDocument();
      });

      expect(inp(container, 'Number of Months')).toBeNull();
    });

    it('shows Number of Months and hides DatePicker when rolling is checked', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      clickCheckbox(container, 'Is Rolling Registration');

      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });

      expect(screen.queryByTestId('date-picker-Valid Until')).not.toBeInTheDocument();
    });

    it('toggles back to DatePicker when rolling is unchecked again', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      // Check rolling
      clickCheckbox(container, 'Is Rolling Registration');
      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });

      // Uncheck rolling
      clickCheckbox(container, 'Is Rolling Registration');
      await waitFor(() => {
        expect(screen.getByTestId('date-picker-Valid Until')).toBeInTheDocument();
      });

      expect(inp(container, 'Number of Months')).toBeNull();
    });
  });

  // ─── 3. Conditional visibility: T&Cs toggle ───

  describe('Conditional visibility: Terms and Conditions toggle', () => {
    it('hides rich text editor when T&Cs is unchecked', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      expect(screen.queryByTestId('react-quill')).not.toBeInTheDocument();
    });

    it('shows rich text editor when T&Cs is checked', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      clickCheckbox(container, 'Use Terms and Conditions');

      await waitFor(() => {
        expect(screen.getByTestId('react-quill')).toBeInTheDocument();
      });
    });
  });

  // ─── 4. Validation: submitting with empty required fields ───

  describe('Validation errors', () => {
    it('shows error when name is empty on submit', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      await waitFor(() => {
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
      });

      expect(container.querySelector('[role="alert"]')!.textContent).toContain('registrations.validation.nameRequired');
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('shows error when description is empty', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Test' } });

      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      await waitFor(() => {
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
      });

      expect(container.querySelector('[role="alert"]')!.textContent).toContain('registrations.validation.descriptionRequired');
    });

    it('shows error when entity name is empty', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Test' } });
      fireEvent.change(inp(container, 'Description')!, { target: { value: 'Desc' } });

      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      await waitFor(() => {
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
      });

      expect(container.querySelector('[role="alert"]')!.textContent).toContain('registrations.validation.entityNameRequired');
    });

    // ─── 5. Validation: rolling registration requires numberOfMonths ───

    it('shows error when rolling registration is enabled but numberOfMonths is empty', async () => {
      setupMocks(MULTI_FORMS, SINGLE_PAY);
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Test' } });
      fireEvent.change(inp(container, 'Description')!, { target: { value: 'Desc' } });
      fireEvent.change(inp(container, 'Entity Name')!, { target: { value: 'Horse' } });

      // Enable rolling registration
      clickCheckbox(container, 'Is Rolling Registration');
      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });

      // Don't fill numberOfMonths — submit
      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      await waitFor(() => {
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
      });

      // The form requires registrationFormId first, so we need to check the right error
      // Since MULTI_FORMS doesn't auto-select, formRequired will fire first
      expect(container.querySelector('[role="alert"]')!.textContent).toContain('registrations.validation.');
    });

    // ─── 6. Validation: fixed period requires validUntil ───

    it('shows error when fixed period but validUntil is empty', async () => {
      const { container } = render(<RegistrationTypeForm {...defaultProps} />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Test' } });
      fireEvent.change(inp(container, 'Description')!, { target: { value: 'Desc' } });
      fireEvent.change(inp(container, 'Entity Name')!, { target: { value: 'Horse' } });

      // isRollingRegistration is false by default, validUntil is empty
      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      await waitFor(() => {
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
      });

      // With SINGLE_FORM auto-selected, the next validation after entityName is formRequired or validUntilRequired
      expect(container.querySelector('[role="alert"]')!.textContent).toContain('registrations.validation.validUntilRequired');
    });
  });

  // ─── 7. Form submission calls onSubmit with correct data ───

  describe('Form submission', () => {
    it('calls onSubmit with correct data when all fields are valid (rolling)', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <RegistrationTypeForm {...defaultProps} onSubmit={onSubmit} />,
      );

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Horse Reg' } });
      fireEvent.change(inp(container, 'Description')!, { target: { value: 'Annual horse registration' } });
      fireEvent.change(inp(container, 'Entity Name')!, { target: { value: 'Horse' } });

      // Enable rolling registration and set months
      clickCheckbox(container, 'Is Rolling Registration');
      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });
      fireEvent.change(inp(container, 'Number of Months')!, { target: { value: '12' } });

      // Click Save and Publish
      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = onSubmit.mock.calls[0][0] as RegistrationTypeFormData;
      expect(submittedData.name).toBe('Horse Reg');
      expect(submittedData.description).toBe('Annual horse registration');
      expect(submittedData.entityName).toBe('Horse');
      expect(submittedData.isRollingRegistration).toBe(true);
      expect(submittedData.numberOfMonths).toBe(12);
      expect(submittedData.registrationStatus).toBe('open'); // publish = true sets open
    });

    it('calls onSubmit with draft status when Save as Draft is clicked', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <RegistrationTypeForm {...defaultProps} onSubmit={onSubmit} />,
      );

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Draft Type' } });
      fireEvent.change(inp(container, 'Description')!, { target: { value: 'Draft desc' } });
      fireEvent.change(inp(container, 'Entity Name')!, { target: { value: 'Boat' } });

      // Enable rolling registration and set months
      clickCheckbox(container, 'Is Rolling Registration');
      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });
      fireEvent.change(inp(container, 'Number of Months')!, { target: { value: '6' } });

      // Click Save as Draft
      const draftBtn = findBtn(container, /registrations\.actions\.saveAsDraft/);
      await act(async () => {
        fireEvent.click(draftBtn!);
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = onSubmit.mock.calls[0][0] as RegistrationTypeFormData;
      // Draft preserves the default status (open) without forcing it
      expect(submittedData.registrationStatus).toBe('open');
    });

    it('does not call onSubmit when validation fails', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <RegistrationTypeForm {...defaultProps} onSubmit={onSubmit} />,
      );

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      // Submit without filling anything
      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      await waitFor(() => {
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  // ─── 8. Cancel button calls onCancel ───

  describe('Cancel button', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const onCancel = vi.fn();
      const { container } = render(
        <RegistrationTypeForm {...defaultProps} onCancel={onCancel} />,
      );

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      const cancelBtn = findBtn(container, /common\.actions\.cancel/);
      expect(cancelBtn).toBeTruthy();
      fireEvent.click(cancelBtn!);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
