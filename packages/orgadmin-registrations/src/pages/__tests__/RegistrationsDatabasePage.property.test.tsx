/**
 * Property-Based Tests for RegistrationsDatabasePage
 *
 * Feature: registrations-module
 * Properties 7, 8, 10, 14, 17
 *
 * Tests the core filtering logic, button visibility, and processed flag behaviour
 * of the RegistrationsDatabasePage component.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import fc from 'fast-check';

// ── Mock setup (hoisted before component import) ──

const mockNavigate = vi.fn();
const mockLocation = { state: null, pathname: '/registrations' };
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

vi.mock('react-quill', () => ({
  __esModule: true,
  default: () => <div data-testid="react-quill" />,
}));

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
  formatDate: (_d: any, _f: string, _l: string) => '01 Jan 2025',
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({ execute: mockExecute }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Test Org' },
  }),
}));

vi.mock('../../components/CreateCustomFilterDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="create-custom-filter-dialog" />,
}));

vi.mock('../../components/BatchOperationsDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="batch-operations-dialog" />,
}));

// ── Import component after mocks ──
import RegistrationsDatabasePage from '../RegistrationsDatabasePage';
import type { Registration, RegistrationType } from '../../types/registration.types';

// ── Generators ──

const registrationStatusArb = fc.constantFrom('active' as const, 'pending' as const, 'elapsed' as const);

const registrationArb = fc.record({
  id: fc.uuid(),
  organisationId: fc.constant('org-1'),
  registrationTypeId: fc.constant('type-1'),
  userId: fc.uuid(),
  registrationNumber: fc.stringMatching(/^REG-[A-Z0-9]{4,8}$/),
  entityName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  ownerName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  formSubmissionId: fc.uuid(),
  dateLastRenewed: fc.constant(new Date('2025-01-01')),
  status: registrationStatusArb,
  validUntil: fc.constant(new Date('2026-01-01')),
  labels: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
  processed: fc.boolean(),
  paymentStatus: fc.constantFrom('pending' as const, 'paid' as const, 'refunded' as const),
  paymentMethod: fc.constant('card'),
  createdAt: fc.constant(new Date('2025-01-01')),
  updatedAt: fc.constant(new Date('2025-01-01')),
});


// ── Helper: configure mockExecute for a given set of registrations, types, and roles ──

function setupMockExecute(
  registrations: Registration[],
  registrationTypes: RegistrationType[] = [],
  roles: Array<{ id: string; name: string; displayName: string }> = [],
) {
  mockExecute.mockImplementation(({ url }: { url: string }) => {
    if (url.includes('/registrations/filters')) return Promise.resolve([]);
    if (url.includes('/registrations/export')) return Promise.resolve(new Blob());
    if (url.includes('/registrations') && !url.includes('/registration-types')) return Promise.resolve(registrations);
    if (url.includes('/registration-types')) return Promise.resolve(registrationTypes);
    if (url.includes('/auth/me')) return Promise.resolve({ roles });
    return Promise.resolve([]);
  });
}

// ── Property 7: Search filters by entity name, owner name, or registration number ──

describe('Feature: registrations-module, Property 7: Search filters by entity name, owner name, or registration number', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Property 7: For any set of registrations and any non-empty search term,
   * the filtered results should contain exactly those registrations where the
   * entity name, owner name, or registration number contains the search term
   * (case-insensitive).
   *
   * We test the filtering logic directly extracted from the component behaviour:
   * render with "all" status filter, type a search term, and verify the visible rows.
   *
   * **Validates: Requirements 3.2**
   */
  it('search filters registrations by entity name, owner name, or registration number (case-insensitive)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(registrationArb, { minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
        async (registrations, searchTerm) => {
          setupMockExecute(registrations);

          const { unmount } = render(<RegistrationsDatabasePage />);

          // Wait for data to load
          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalled();
          });

          // Switch to "all" status filter so status doesn't interfere
          const allButton = screen.getByText('registrations.statusOptions.all');
          fireEvent.click(allButton);

          // Type search term
          const searchField = screen.getByTestId('search-field').querySelector('input')!;
          fireEvent.change(searchField, { target: { value: searchTerm } });

          // Compute expected matches
          const term = searchTerm.toLowerCase();
          const expectedMatches = registrations.filter(
            r =>
              r.entityName.toLowerCase().includes(term) ||
              r.ownerName.toLowerCase().includes(term) ||
              r.registrationNumber.toLowerCase().includes(term),
          );

          // Count visible data rows (exclude header row and loading/empty rows)
          const table = screen.getByRole('table');
          const tbody = table.querySelector('tbody')!;
          const dataRows = tbody.querySelectorAll('tr');

          if (expectedMatches.length === 0) {
            // Should show "no registrations found" row
            expect(dataRows.length).toBe(1);
            expect(dataRows[0].textContent).toContain('registrations.noRegistrationsFound');
          } else {
            // Each expected match should have a row with its registration number
            expect(dataRows.length).toBe(expectedMatches.length);
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── Property 8: Status filter partitions registrations correctly ──

describe('Feature: registrations-module, Property 8: Status filter partitions registrations correctly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Property 8: Selecting "current" shows only active + pending,
   * "elapsed" shows only elapsed, "all" shows all.
   *
   * **Validates: Requirements 3.3, 8.2**
   */
  it('status filter partitions registrations into current (active+pending), elapsed, and all', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(registrationArb, { minLength: 1, maxLength: 10 }),
        fc.constantFrom('current' as const, 'elapsed' as const, 'all' as const),
        async (registrations, statusFilterValue) => {
          setupMockExecute(registrations);

          const { unmount } = render(<RegistrationsDatabasePage />);

          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalled();
          });

          // Click the desired status filter
          const buttonLabel =
            statusFilterValue === 'current'
              ? 'registrations.statusOptions.current'
              : statusFilterValue === 'elapsed'
                ? 'registrations.statusOptions.elapsed'
                : 'registrations.statusOptions.all';
          fireEvent.click(screen.getByText(buttonLabel));

          // Compute expected
          let expected: Registration[];
          if (statusFilterValue === 'current') {
            expected = registrations.filter(r => r.status === 'active' || r.status === 'pending');
          } else if (statusFilterValue === 'elapsed') {
            expected = registrations.filter(r => r.status === 'elapsed');
          } else {
            expected = registrations;
          }

          const table = screen.getByRole('table');
          const tbody = table.querySelector('tbody')!;
          const dataRows = tbody.querySelectorAll('tr');

          if (expected.length === 0) {
            expect(dataRows.length).toBe(1);
            expect(dataRows[0].textContent).toContain('registrations.noRegistrationsFound');
          } else {
            expect(dataRows.length).toBe(expected.length);
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});


// ── Property 10: Batch operation buttons visibility follows selection state ──

describe('Feature: registrations-module, Property 10: Batch operation buttons visibility follows selection state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Property 10: Batch buttons visible iff at least one registration is selected.
   *
   * **Validates: Requirements 5.1**
   */
  it('batch operation buttons are visible iff at least one registration is selected', async () => {
    // Use a fixed set of registrations so we can select/deselect
    const fixedRegistrations: Registration[] = Array.from({ length: 5 }, (_, i) => ({
      id: `reg-${i}`,
      organisationId: 'org-1',
      registrationTypeId: 'type-1',
      userId: `user-${i}`,
      registrationNumber: `REG-${String(i).padStart(4, '0')}`,
      entityName: `Entity ${i}`,
      ownerName: `Owner ${i}`,
      formSubmissionId: `form-${i}`,
      dateLastRenewed: new Date('2025-01-01'),
      status: 'active' as const,
      validUntil: new Date('2026-01-01'),
      labels: [],
      processed: false,
      paymentStatus: 'paid' as const,
      paymentMethod: 'card',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    }));

    await fc.assert(
      fc.asyncProperty(
        // Generate a random subset of indices to select (0..4)
        fc.subarray([0, 1, 2, 3, 4]),
        async (selectedIndices) => {
          setupMockExecute(fixedRegistrations);

          const { unmount } = render(<RegistrationsDatabasePage />);

          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalled();
          });

          // Click "all" to see all registrations
          fireEvent.click(screen.getByText('registrations.statusOptions.all'));

          // Wait for rows to appear
          await waitFor(() => {
            const table = screen.getByRole('table');
            const tbody = table.querySelector('tbody')!;
            const rows = tbody.querySelectorAll('tr');
            expect(rows.length).toBe(5);
          });

          // Select the specified registrations by clicking their checkboxes
          for (const idx of selectedIndices) {
            const table = screen.getByRole('table');
            const tbody = table.querySelector('tbody')!;
            const rows = tbody.querySelectorAll('tr');
            const checkbox = rows[idx].querySelector('input[type="checkbox"]');
            if (checkbox) fireEvent.click(checkbox);
          }

          // Check batch operations visibility
          const batchOps = screen.queryByTestId('batch-operations');

          if (selectedIndices.length > 0) {
            expect(batchOps).toBeInTheDocument();
          } else {
            expect(batchOps).not.toBeInTheDocument();
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── Property 14: Add Registration button visibility ──

describe('Feature: registrations-module, Property 14: Add Registration button visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Property 14: Button visible iff at least one registration type exists AND user has admin role.
   *
   * **Validates: Requirements 6.1**
   */
  it('Add Registration button is visible iff at least one registration type exists AND user has admin role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }),
        fc.boolean(),
        async (typeCount, isAdmin) => {
          const types: RegistrationType[] = Array.from({ length: typeCount }, (_, i) => ({
            id: `type-${i}`,
            organisationId: 'org-1',
            name: `Type ${i}`,
            description: 'desc',
            entityName: 'Horse',
            registrationFormId: 'form-1',
            registrationStatus: 'open' as const,
            isRollingRegistration: true,
            numberOfMonths: 12,
            automaticallyApprove: true,
            registrationLabels: [],
            supportedPaymentMethods: [],
            useTermsAndConditions: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          const roles = isAdmin
            ? [{ id: 'r1', name: 'admin', displayName: 'Administrator' }]
            : [{ id: 'r2', name: 'viewer', displayName: 'Viewer' }];

          setupMockExecute([], types, roles);

          const { unmount } = render(<RegistrationsDatabasePage />);

          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalled();
          });

          // Wait for loading to complete
          await waitFor(() => {
            expect(screen.queryByText('registrations.loadingRegistrations')).not.toBeInTheDocument();
          });

          const addButton = screen.queryByTestId('add-registration-button');

          if (typeCount > 0 && isAdmin) {
            expect(addButton).toBeInTheDocument();
          } else {
            expect(addButton).not.toBeInTheDocument();
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});


// ── Property 17: Processed flag toggle and icon consistency ──

describe('Feature: registrations-module, Property 17: Processed flag toggle and icon consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Property 17: Filled check icon when processed=true, empty circle when false;
   * clicking toggles via PATCH.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it('displays correct icon for processed state and toggles via PATCH on click', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (initialProcessed) => {
          vi.clearAllMocks();

          const reg: Registration = {
            id: 'reg-test',
            organisationId: 'org-1',
            registrationTypeId: 'type-1',
            userId: 'user-1',
            registrationNumber: 'REG-0001',
            entityName: 'Test Entity',
            ownerName: 'Test Owner',
            formSubmissionId: 'form-1',
            dateLastRenewed: new Date('2025-01-01'),
            status: 'active',
            validUntil: new Date('2026-01-01'),
            labels: [],
            processed: initialProcessed,
            paymentStatus: 'paid',
            paymentMethod: 'card',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
          };

          // For PATCH calls, resolve but don't return data; for reload, return same reg
          mockExecute.mockImplementation(({ method, url }: { method: string; url: string }) => {
            if (method === 'PATCH') return Promise.resolve({});
            if (url.includes('/registrations/filters')) return Promise.resolve([]);
            if (url.includes('/registrations/export')) return Promise.resolve(new Blob());
            if (url.includes('/registrations') && !url.includes('/registration-types')) return Promise.resolve([reg]);
            if (url.includes('/registration-types')) return Promise.resolve([]);
            if (url.includes('/auth/me')) return Promise.resolve({ roles: [] });
            return Promise.resolve([]);
          });

          const { unmount } = render(<RegistrationsDatabasePage />);

          // Wait for loading to finish (default filter is "current" which includes "active")
          await waitFor(() => {
            expect(screen.queryByText('registrations.loadingRegistrations')).not.toBeInTheDocument();
          });

          // The toggle button should exist (only one row, so only one toggle)
          const toggleButtons = screen.getAllByTestId('processed-toggle-reg-test');
          expect(toggleButtons.length).toBe(1);
          const toggleButton = toggleButtons[0];

          // Check icon: ProcessedIcon (CheckCircle) vs UnprocessedIcon (RadioButtonUnchecked)
          if (initialProcessed) {
            expect(toggleButton.querySelector('[data-testid="CheckCircleIcon"]')).toBeTruthy();
          } else {
            expect(toggleButton.querySelector('[data-testid="RadioButtonUncheckedIcon"]')).toBeTruthy();
          }

          // Click the toggle
          fireEvent.click(toggleButton);

          // Verify PATCH was called with toggled value
          await waitFor(() => {
            const patchCall = mockExecute.mock.calls.find(
              (call: any[]) => call[0]?.method === 'PATCH' && call[0]?.url?.includes('reg-test'),
            );
            expect(patchCall).toBeTruthy();
            expect(patchCall![0].data).toEqual({ processed: !initialProcessed });
          });

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});
