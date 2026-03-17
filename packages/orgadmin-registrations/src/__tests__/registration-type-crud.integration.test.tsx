/**
 * Integration Test: End-to-end Registration Type CRUD Workflow
 *
 * Feature: registrations-module
 * Tests the full lifecycle: Create → List → View Details → Edit → Delete
 *
 * Validates: Requirements 2.1-2.9
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
    <textarea
      data-testid="react-quill"
      value={value || ''}
      onChange={(e: any) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
  useCapabilities: () => ({ hasCapability: () => false }),
  formatDate: (_d: any, _f: string, _l: string) => '01 Jan 2025',
  usePageHelp: () => ({ setPageHelp: vi.fn() }),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Test Org' },
  }),
}));

vi.mock('@aws-web-framework/components', () => ({
  DiscountSelector: () => <div data-testid="discount-selector" />,
}));

import RegistrationTypesListPage from '../pages/RegistrationTypesListPage';
import RegistrationTypeDetailsPage from '../pages/RegistrationTypeDetailsPage';
import CreateRegistrationTypePage from '../pages/CreateRegistrationTypePage';
import type { RegistrationType } from '../types/registration.types';

// ── Shared test data ──

const FORMS = [{ id: 'form-1', name: 'Default Form' }];
const PAY_METHODS = [{ id: 'pay-offline', name: 'Pay Offline' }];

const createdType: RegistrationType = {
  id: 'type-new',
  organisationId: 'org-1',
  name: 'Horse Registration 2026',
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
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
};

const editedType: RegistrationType = {
  ...createdType,
  name: 'Horse Registration 2026 Updated',
  description: 'Updated annual horse registration',
};

// ── Helpers ──

function inp(container: HTMLElement, prefix: string) {
  const label = Array.from(container.querySelectorAll('label')).find((l) =>
    (l.textContent || '').startsWith(prefix),
  );
  if (!label) return null;
  const id = label.getAttribute('for');
  if (!id) return null;
  return container.querySelector('#' + CSS.escape(id)) as HTMLInputElement | HTMLTextAreaElement | null;
}

function findBtn(container: HTMLElement, re: RegExp) {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    re.test(b.textContent || ''),
  ) as HTMLButtonElement | null;
}

function clickCheckbox(container: HTMLElement, labelText: string) {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((l) => (l.textContent || '').includes(labelText));
  if (label) {
    const checkbox =
      label.querySelector('input[type="checkbox"]') ||
      label.parentElement?.querySelector('input[type="checkbox"]');
    if (checkbox) fireEvent.click(checkbox);
  }
}

// ── Tests ──

describe('Registration Type CRUD Integration Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
  });

  /**
   * Step 1: Create a registration type via the form (POST), verify it appears in the list
   * Validates: Requirements 2.2, 2.3, 2.4
   */
  describe('Step 1: Create registration type and verify in list', () => {
    it('creates a registration type via form submission and the new type appears in the list', async () => {
      // --- Phase A: Create via form ---
      mockParams = {};
      mockExecute.mockImplementation(({ url, method }: any) => {
        if (url?.includes('/application-forms')) return Promise.resolve(FORMS);
        if (url?.includes('/payment-methods')) return Promise.resolve(PAY_METHODS);
        if (method === 'POST') return Promise.resolve({ id: 'type-new' });
        return Promise.resolve([]);
      });

      const { container, unmount } = render(<CreateRegistrationTypePage />);

      await waitFor(() => {
        expect(inp(container, 'Name')).toBeTruthy();
      });

      // Fill required fields
      fireEvent.change(inp(container, 'Name')!, { target: { value: 'Horse Registration 2026' } });
      fireEvent.change(inp(container, 'Description')!, { target: { value: 'Annual horse registration' } });
      fireEvent.change(inp(container, 'Entity Name')!, { target: { value: 'Horse' } });

      // Enable rolling registration and set months
      clickCheckbox(container, 'Is Rolling Registration');
      await waitFor(() => {
        expect(inp(container, 'Number of Months')).toBeTruthy();
      });
      fireEvent.change(inp(container, 'Number of Months')!, { target: { value: '12' } });

      // Submit the form
      const saveBtn = findBtn(container, /registrations\.actions\.saveAndPublish/);
      expect(saveBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(saveBtn!);
      });

      // Verify POST was sent
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/orgadmin/registration-types',
          }),
        );
      });

      // Verify navigation to list
      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
      unmount();

      // --- Phase B: Verify the new type appears in the list ---
      vi.clearAllMocks();
      mockExecute.mockImplementation(({ url }: any) => {
        if (url?.includes('/registration-types')) return Promise.resolve([createdType]);
        return Promise.resolve([]);
      });

      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingTypes')).not.toBeInTheDocument();
      });

      // Verify the created type appears in the list
      expect(screen.getByText('Horse Registration 2026')).toBeInTheDocument();
      expect(screen.getByText('Horse')).toBeInTheDocument();
      expect(screen.getByText('open')).toBeInTheDocument();
    });
  });

  /**
   * Step 2: Click on the type to view details, verify all fields displayed
   * Validates: Requirements 2.1, 2.5
   */
  describe('Step 2: View registration type details', () => {
    it('clicking a type in the list navigates to details, and details page shows all fields', async () => {
      // --- Phase A: Click on type in list ---
      mockExecute.mockImplementation(({ url }: any) => {
        if (url?.includes('/registration-types')) return Promise.resolve([createdType]);
        return Promise.resolve([]);
      });

      const { unmount } = render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.getByText('Horse Registration 2026')).toBeInTheDocument();
      });

      // Click the row
      const row = screen.getByText('Horse Registration 2026').closest('tr')!;
      fireEvent.click(row);

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types/type-new');
      unmount();

      // --- Phase B: Render details page and verify all fields ---
      vi.clearAllMocks();
      mockParams = { id: 'type-new' };
      mockExecute.mockImplementation(({ url, method }: any) => {
        if (url?.includes('/registration-types/type-new') && method === 'GET')
          return Promise.resolve(createdType);
        return Promise.resolve(null);
      });

      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      // Verify all key fields are displayed
      const nameElements = screen.getAllByText('Horse Registration 2026');
      expect(nameElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Horse')).toBeInTheDocument();
      expect(screen.getByText('Annual horse registration')).toBeInTheDocument();
      expect(screen.getByText('open')).toBeInTheDocument();
      expect(screen.getByText('Rolling Registration')).toBeInTheDocument();
      expect(screen.getByText('12 months from payment date')).toBeInTheDocument();
      expect(
        screen.getByText('Applications are automatically approved and marked as Active'),
      ).toBeInTheDocument();
      expect(screen.getByText('VIP')).toBeInTheDocument();
      expect(screen.getByText('pay-offline')).toBeInTheDocument();
    });
  });

  /**
   * Step 3: Edit the type (PUT), verify changes saved
   * Validates: Requirements 2.6, 2.7
   */
  describe('Step 3: Edit registration type', () => {
    it('navigates to edit from details, modifies fields, submits PUT, and verifies changes', async () => {
      // --- Phase A: Click edit on details page ---
      mockParams = { id: 'type-new' };
      mockExecute.mockImplementation(({ url, method }: any) => {
        if (url?.includes('/registration-types/type-new') && method === 'GET')
          return Promise.resolve(createdType);
        return Promise.resolve(null);
      });

      const { unmount: unmountDetails } = render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      // Click edit button
      fireEvent.click(screen.getByText('common.actions.edit'));
      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types/type-new/edit');
      unmountDetails();

      // --- Phase B: Edit form pre-populated, modify, and submit ---
      vi.clearAllMocks();
      mockParams = { id: 'type-new' };
      mockExecute.mockImplementation(({ url, method }: any) => {
        if (url?.includes('/application-forms')) return Promise.resolve(FORMS);
        if (url?.includes('/payment-methods')) return Promise.resolve(PAY_METHODS);
        if (url === '/api/orgadmin/registration-types/type-new' && method === 'GET')
          return Promise.resolve({
            name: 'Horse Registration 2026',
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
            discountIds: [],
          });
        if (method === 'PUT') return Promise.resolve({ id: 'type-new' });
        return Promise.resolve([]);
      });

      const { container, unmount: unmountEdit } = render(<CreateRegistrationTypePage />);

      // Wait for pre-population
      await waitFor(() => {
        expect(inp(container, 'Name')?.value).toBe('Horse Registration 2026');
      });

      // Verify pre-populated fields
      expect(inp(container, 'Description')?.value).toBe('Annual horse registration');
      expect(inp(container, 'Entity Name')?.value).toBe('Horse');
      expect(inp(container, 'Number of Months')?.value).toBe('12');

      // Modify fields
      fireEvent.change(inp(container, 'Name')!, {
        target: { value: 'Horse Registration 2026 Updated' },
      });
      fireEvent.change(inp(container, 'Description')!, {
        target: { value: 'Updated annual horse registration' },
      });

      // Submit via Update button
      const updateBtn = findBtn(container, /registrations\.actions\.update/);
      expect(updateBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(updateBtn!);
      });

      // Verify PUT was sent with correct URL
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PUT',
            url: '/api/orgadmin/registration-types/type-new',
          }),
        );
      });

      // Verify navigation after edit
      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
      unmountEdit();

      // --- Phase C: Verify updated data in details page ---
      vi.clearAllMocks();
      mockParams = { id: 'type-new' };
      mockExecute.mockImplementation(({ url, method }: any) => {
        if (url?.includes('/registration-types/type-new') && method === 'GET')
          return Promise.resolve(editedType);
        return Promise.resolve(null);
      });

      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      // Verify updated fields
      const updatedNames = screen.getAllByText('Horse Registration 2026 Updated');
      expect(updatedNames.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Updated annual horse registration')).toBeInTheDocument();
    });
  });

  /**
   * Step 4: Delete the type (DELETE with confirmation dialog), verify removed from list
   * Validates: Requirements 2.8
   */
  describe('Step 4: Delete registration type with confirmation', () => {
    it('opens confirmation dialog, confirms delete, sends DELETE request, and type is removed from list', async () => {
      // --- Phase A: Delete from details page ---
      mockParams = { id: 'type-new' };
      mockExecute.mockImplementation(({ url, method }: any) => {
        if (method === 'DELETE') return Promise.resolve({});
        if (url?.includes('/registration-types/type-new') && method === 'GET')
          return Promise.resolve(createdType);
        return Promise.resolve(null);
      });

      const { unmount: unmountDetails } = render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      // Click delete button - opens confirmation dialog
      const deleteButton = screen.getByText('common.actions.delete');
      fireEvent.click(deleteButton);

      // Verify confirmation dialog appears
      expect(screen.getByText('registrations.delete.title')).toBeInTheDocument();
      expect(screen.getByText('registrations.delete.message')).toBeInTheDocument();

      // Confirm deletion (the second delete button in the dialog)
      const dialogButtons = screen.getAllByText('common.actions.delete');
      const confirmButton = dialogButtons[dialogButtons.length - 1];
      fireEvent.click(confirmButton);

      // Verify DELETE request was sent
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'DELETE',
            url: '/api/orgadmin/registration-types/type-new',
          }),
        );
      });

      // Verify navigation back to list
      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
      unmountDetails();

      // --- Phase B: Verify type is no longer in the list ---
      vi.clearAllMocks();
      mockParams = {};
      mockExecute.mockImplementation(({ url }: any) => {
        if (url?.includes('/registration-types')) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.getByText('registrations.noTypesFound')).toBeInTheDocument();
      });

      // Verify the deleted type is not present
      expect(screen.queryByText('Horse Registration 2026')).not.toBeInTheDocument();
    });

    it('cancelling the delete dialog does not send DELETE request', async () => {
      mockParams = { id: 'type-new' };
      mockExecute.mockImplementation(({ url, method }: any) => {
        if (url?.includes('/registration-types/type-new') && method === 'GET')
          return Promise.resolve(createdType);
        return Promise.resolve(null);
      });

      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      // Open delete dialog
      fireEvent.click(screen.getByText('common.actions.delete'));
      expect(screen.getByText('registrations.delete.title')).toBeInTheDocument();

      // Cancel
      fireEvent.click(screen.getByText('common.actions.cancel'));

      await waitFor(() => {
        expect(screen.queryByText('registrations.delete.title')).not.toBeInTheDocument();
      });

      // Verify no DELETE request was sent
      const deleteCalls = mockExecute.mock.calls.filter(
        (call: any) => call[0]?.method === 'DELETE',
      );
      expect(deleteCalls).toHaveLength(0);

      // Verify no navigation occurred (only the initial GET)
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
