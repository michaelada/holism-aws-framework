/**
 * Integration Test: Batch Operations Workflow
 *
 * Feature: registrations-module
 * Tests the full batch operations workflow on the RegistrationsDatabasePage:
 * - Select registrations via checkboxes, verify batch buttons appear
 * - Mark Processed / Mark Unprocessed batch operations
 * - Add Labels / Remove Labels batch operations (with label dialog)
 * - Selection cleared after successful batch operation
 *
 * Validates: Requirements 5.1-5.6
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

const mockNavigate = vi.fn();
const mockLocation: { state: any; pathname: string } = { state: null, pathname: '/registrations' };
const mockExecute = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

vi.mock('date-fns', () => ({}));
vi.mock('date-fns/locale', () => ({ enGB: {} }));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label }: any) => <div data-testid={`date-picker-${label}`} />,
}));
vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (k: string, params?: any) => (params ? `${k} ${JSON.stringify(params)}` : k),
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

import RegistrationsDatabasePage from '../pages/RegistrationsDatabasePage';
import type { Registration } from '../types/registration.types';

// ── Test data ──

const sampleRegistrations: Registration[] = [
  {
    id: 'reg-1',
    organisationId: 'org-1',
    registrationTypeId: 'type-1',
    userId: 'user-1',
    registrationNumber: 'REG-0001',
    entityName: 'Thunder',
    ownerName: 'Alice Smith',
    formSubmissionId: 'form-1',
    dateLastRenewed: new Date('2025-01-15'),
    status: 'active',
    validUntil: new Date('2026-01-15'),
    labels: ['VIP'],
    processed: false,
    paymentStatus: 'paid',
    paymentMethod: 'card',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'reg-2',
    organisationId: 'org-1',
    registrationTypeId: 'type-1',
    userId: 'user-2',
    registrationNumber: 'REG-0002',
    entityName: 'Lightning',
    ownerName: 'Bob Jones',
    formSubmissionId: 'form-2',
    dateLastRenewed: new Date('2025-02-01'),
    status: 'active',
    validUntil: new Date('2026-02-01'),
    labels: [],
    processed: true,
    paymentStatus: 'paid',
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-02-01'),
  },
  {
    id: 'reg-3',
    organisationId: 'org-1',
    registrationTypeId: 'type-1',
    userId: 'user-3',
    registrationNumber: 'REG-0003',
    entityName: 'Storm',
    ownerName: 'Carol White',
    formSubmissionId: 'form-3',
    dateLastRenewed: new Date('2025-03-01'),
    status: 'pending',
    validUntil: new Date('2026-03-01'),
    labels: ['Renewal'],
    processed: false,
    paymentStatus: 'pending',
    createdAt: new Date('2025-03-01'),
    updatedAt: new Date('2025-03-01'),
  },
];

const sampleTypes = [
  { id: 'type-1', name: 'Horse Registration', organisationId: 'org-1', entityName: 'Horse', registrationFormId: 'form-1', registrationStatus: 'open', isRollingRegistration: true, numberOfMonths: 12, automaticallyApprove: true, registrationLabels: [], supportedPaymentMethods: [], useTermsAndConditions: false, createdAt: new Date(), updatedAt: new Date() },
];

function setupMockExecute(registrations: Registration[] = sampleRegistrations) {
  mockExecute.mockImplementation(({ url, method }: { url: string; method: string }) => {
    if (url.includes('/registrations/filters')) return Promise.resolve([]);
    if (url.includes('/registrations/export')) return Promise.resolve(new Blob(['test']));
    if (url.includes('/registrations/batch/')) return Promise.resolve({});
    if (url.includes('/registrations') && !url.includes('/registration-types'))
      return Promise.resolve(registrations);
    if (url.includes('/registration-types')) return Promise.resolve(sampleTypes);
    if (url.includes('/auth/me'))
      return Promise.resolve({ roles: [{ id: 'r1', name: 'admin', displayName: 'Admin' }] });
    return Promise.resolve([]);
  });
}


/**
 * Helper: wait for registrations to load and render in the table.
 * The default status filter is "current" (active + pending), so all 3 sample registrations show.
 */
async function waitForRegistrationsToLoad() {
  await waitFor(() => {
    expect(screen.getByText('Thunder')).toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
    expect(screen.getByText('Storm')).toBeInTheDocument();
  });
}

/**
 * Helper: select registrations by clicking their row checkboxes.
 * Each registration row has a checkbox; we find the row by entity name and click its checkbox.
 */
function selectRegistrationByEntityName(entityName: string) {
  const row = screen.getByText(entityName).closest('tr')!;
  const checkbox = within(row).getByRole('checkbox');
  fireEvent.click(checkbox);
}

// ── Tests ──

describe('Batch Operations Integration Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Requirement 5.1: Batch operation buttons appear when registrations are selected
   */
  describe('Step 1: Select registrations and verify batch buttons appear (Requirement 5.1)', () => {
    it('batch operation buttons are hidden when no registrations are selected', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);
      await waitForRegistrationsToLoad();

      // Batch operations container should not be present
      expect(screen.queryByTestId('batch-operations')).not.toBeInTheDocument();
      expect(screen.queryByText('registrations.actions.markProcessed')).not.toBeInTheDocument();
    });

    it('batch operation buttons appear when registrations are selected via checkboxes', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);
      await waitForRegistrationsToLoad();

      // Select two registrations
      selectRegistrationByEntityName('Thunder');
      selectRegistrationByEntityName('Lightning');

      // Batch operation buttons should now be visible
      await waitFor(() => {
        expect(screen.getByTestId('batch-operations')).toBeInTheDocument();
      });
      expect(screen.getByText('registrations.actions.markProcessed')).toBeInTheDocument();
      expect(screen.getByText('registrations.actions.markUnprocessed')).toBeInTheDocument();
      expect(screen.getByText('registrations.actions.addLabels')).toBeInTheDocument();
      expect(screen.getByText('registrations.actions.removeLabels')).toBeInTheDocument();
    });

    it('batch operation buttons disappear when all registrations are deselected', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);
      await waitForRegistrationsToLoad();

      // Select then deselect
      selectRegistrationByEntityName('Thunder');
      expect(screen.getByTestId('batch-operations')).toBeInTheDocument();

      selectRegistrationByEntityName('Thunder'); // deselect
      expect(screen.queryByTestId('batch-operations')).not.toBeInTheDocument();
    });
  });

  /**
   * Requirement 5.2: Mark Processed batch operation
   */
  describe('Step 2: Mark Processed batch operation (Requirement 5.2)', () => {
    it('selects registrations, triggers Mark Processed, verifies POST with selected IDs', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);
      await waitForRegistrationsToLoad();

      // Select registrations
      selectRegistrationByEntityName('Thunder');
      selectRegistrationByEntityName('Storm');

      // Click Mark Processed button
      fireEvent.click(screen.getByText('registrations.actions.markProcessed'));

      // The BatchOperationsDialog should open - find and click the execute button
      await waitFor(() => {
        expect(screen.getByTestId('execute-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('execute-button'));

      // Verify POST to mark-processed endpoint with selected IDs
      await waitFor(() => {
        const batchCall = mockExecute.mock.calls.find(
          (call: any[]) => call[0]?.url === '/api/orgadmin/registrations/batch/mark-processed',
        );
        expect(batchCall).toBeTruthy();
        expect(batchCall![0].method).toBe('POST');
        expect(batchCall![0].data.registrationIds).toEqual(
          expect.arrayContaining(['reg-1', 'reg-3']),
        );
        expect(batchCall![0].data.registrationIds).toHaveLength(2);
      });
    });
  });

  /**
   * Requirement 5.3: Mark Unprocessed batch operation
   */
  describe('Step 3: Mark Unprocessed batch operation (Requirement 5.3)', () => {
    it('selects registrations, triggers Mark Unprocessed, verifies POST with selected IDs', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);
      await waitForRegistrationsToLoad();

      // Select registrations
      selectRegistrationByEntityName('Lightning');
      selectRegistrationByEntityName('Storm');

      // Click Mark Unprocessed button
      fireEvent.click(screen.getByText('registrations.actions.markUnprocessed'));

      // The BatchOperationsDialog should open
      await waitFor(() => {
        expect(screen.getByTestId('execute-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('execute-button'));

      // Verify POST to mark-unprocessed endpoint
      await waitFor(() => {
        const batchCall = mockExecute.mock.calls.find(
          (call: any[]) => call[0]?.url === '/api/orgadmin/registrations/batch/mark-unprocessed',
        );
        expect(batchCall).toBeTruthy();
        expect(batchCall![0].method).toBe('POST');
        expect(batchCall![0].data.registrationIds).toEqual(
          expect.arrayContaining(['reg-2', 'reg-3']),
        );
        expect(batchCall![0].data.registrationIds).toHaveLength(2);
      });
    });
  });

  /**
   * Requirement 5.4: Add Labels batch operation
   */
  describe('Step 4: Add Labels batch operation (Requirement 5.4)', () => {
    it('selects registrations, triggers Add Labels, adds labels in dialog, verifies POST with IDs and labels', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);
      await waitForRegistrationsToLoad();

      // Select registrations
      selectRegistrationByEntityName('Thunder');
      selectRegistrationByEntityName('Lightning');
      selectRegistrationByEntityName('Storm');

      // Click Add Labels button
      fireEvent.click(screen.getByText('registrations.actions.addLabels'));

      // The BatchOperationsDialog should open with label input
      await waitFor(() => {
        expect(screen.getByTestId('label-input')).toBeInTheDocument();
      });

      // Execute button should be disabled until labels are added
      expect(screen.getByTestId('execute-button')).toBeDisabled();

      // Add labels via the label input
      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      fireEvent.change(labelInput, { target: { value: 'Premium' } });
      fireEvent.click(screen.getByTestId('add-label-button'));

      fireEvent.change(labelInput, { target: { value: 'Verified' } });
      fireEvent.click(screen.getByTestId('add-label-button'));

      // Labels should appear as chips
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();

      // Execute button should now be enabled
      expect(screen.getByTestId('execute-button')).not.toBeDisabled();

      fireEvent.click(screen.getByTestId('execute-button'));

      // Verify POST to add-labels endpoint with IDs and labels
      await waitFor(() => {
        const batchCall = mockExecute.mock.calls.find(
          (call: any[]) => call[0]?.url === '/api/orgadmin/registrations/batch/add-labels',
        );
        expect(batchCall).toBeTruthy();
        expect(batchCall![0].method).toBe('POST');
        expect(batchCall![0].data.registrationIds).toEqual(
          expect.arrayContaining(['reg-1', 'reg-2', 'reg-3']),
        );
        expect(batchCall![0].data.registrationIds).toHaveLength(3);
        expect(batchCall![0].data.labels).toEqual(['Premium', 'Verified']);
      });
    });
  });

  /**
   * Requirement 5.5: Remove Labels batch operation
   */
  describe('Step 5: Remove Labels batch operation (Requirement 5.5)', () => {
    it('selects registrations, triggers Remove Labels, adds labels in dialog, verifies POST with IDs and labels', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);
      await waitForRegistrationsToLoad();

      // Select registrations
      selectRegistrationByEntityName('Thunder');
      selectRegistrationByEntityName('Storm');

      // Click Remove Labels button
      fireEvent.click(screen.getByText('registrations.actions.removeLabels'));

      // The BatchOperationsDialog should open with label input
      await waitFor(() => {
        expect(screen.getByTestId('label-input')).toBeInTheDocument();
      });

      // Add labels to remove
      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      fireEvent.change(labelInput, { target: { value: 'Outdated' } });
      fireEvent.click(screen.getByTestId('add-label-button'));

      fireEvent.change(labelInput, { target: { value: 'Expired' } });
      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByText('Outdated')).toBeInTheDocument();
      expect(screen.getByText('Expired')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('execute-button'));

      // Verify POST to remove-labels endpoint with IDs and labels
      await waitFor(() => {
        const batchCall = mockExecute.mock.calls.find(
          (call: any[]) => call[0]?.url === '/api/orgadmin/registrations/batch/remove-labels',
        );
        expect(batchCall).toBeTruthy();
        expect(batchCall![0].method).toBe('POST');
        expect(batchCall![0].data.registrationIds).toEqual(
          expect.arrayContaining(['reg-1', 'reg-3']),
        );
        expect(batchCall![0].data.registrationIds).toHaveLength(2);
        expect(batchCall![0].data.labels).toEqual(['Outdated', 'Expired']);
      });
    });
  });

  /**
   * Requirement 5.6: Selection cleared after successful batch operation
   */
  describe('Step 6: Selection cleared after successful batch operation (Requirement 5.6)', () => {
    it('selection is cleared and batch buttons disappear after successful Mark Processed', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);
      await waitForRegistrationsToLoad();

      // Select registrations
      selectRegistrationByEntityName('Thunder');
      selectRegistrationByEntityName('Lightning');

      // Batch buttons should be visible
      expect(screen.getByTestId('batch-operations')).toBeInTheDocument();

      // Trigger Mark Processed
      fireEvent.click(screen.getByText('registrations.actions.markProcessed'));

      await waitFor(() => {
        expect(screen.getByTestId('execute-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('execute-button'));

      // After successful operation, batch buttons should disappear (selection cleared)
      await waitFor(() => {
        expect(screen.queryByTestId('batch-operations')).not.toBeInTheDocument();
      });
    });

    it('selection is cleared after successful Add Labels operation', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);
      await waitForRegistrationsToLoad();

      // Select a registration
      selectRegistrationByEntityName('Storm');
      expect(screen.getByTestId('batch-operations')).toBeInTheDocument();

      // Trigger Add Labels
      fireEvent.click(screen.getByText('registrations.actions.addLabels'));

      await waitFor(() => {
        expect(screen.getByTestId('label-input')).toBeInTheDocument();
      });

      // Add a label
      const labelInput = screen.getByTestId('label-input').querySelector('input')!;
      fireEvent.change(labelInput, { target: { value: 'NewLabel' } });
      fireEvent.click(screen.getByTestId('add-label-button'));

      fireEvent.click(screen.getByTestId('execute-button'));

      // After successful operation, batch buttons should disappear
      await waitFor(() => {
        expect(screen.queryByTestId('batch-operations')).not.toBeInTheDocument();
      });
    });
  });
});
