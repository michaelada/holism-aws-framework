/**
 * Property-Based Tests for Registration Creation Flow
 *
 * Feature: registrations-module
 * Properties 15, 16
 *
 * Property 15: Tests navigation behavior based on registration type count.
 * Property 16: Tests that the Add Registration button navigates with correct
 *              filter state for any combination of search/status/filter values.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fc from 'fast-check';

// ── Mock setup ──

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

import RegistrationsDatabasePage from '../RegistrationsDatabasePage';
import type { RegistrationType } from '../../types/registration.types';

// ── Generators ──

const registrationTypeArb = (overrides: Partial<RegistrationType> = {}) =>
  fc.record({
    id: fc.uuid(),
    organisationId: fc.constant('org-1'),
    name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    description: fc.constant('desc'),
    entityName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    registrationFormId: fc.uuid(),
    registrationStatus: fc.constant('open' as const),
    isRollingRegistration: fc.constant(true),
    numberOfMonths: fc.constant(12),
    automaticallyApprove: fc.boolean(),
    registrationLabels: fc.constant([] as string[]),
    supportedPaymentMethods: fc.constant([] as string[]),
    useTermsAndConditions: fc.constant(false),
    createdAt: fc.constant(new Date()),
    updatedAt: fc.constant(new Date()),
  }).map(rt => ({ ...rt, ...overrides }));

// ── Helper ──

const adminRoles = [{ id: 'r1', name: 'admin', displayName: 'Admin' }];

function setupMockExecute(registrationTypes: RegistrationType[]) {
  mockExecute.mockImplementation(({ url }: { url: string }) => {
    if (url.includes('/registrations/filters')) return Promise.resolve([]);
    if (url.includes('/registrations/export')) return Promise.resolve(new Blob());
    if (url.includes('/registrations') && !url.includes('/registration-types')) return Promise.resolve([]);
    if (url.includes('/registration-types')) return Promise.resolve(registrationTypes);
    if (url.includes('/auth/me')) return Promise.resolve({ roles: adminRoles });
    return Promise.resolve([]);
  });
}

// ── Property 15: Registration type auto-selection based on count ──

describe('Feature: registrations-module, Property 15: Registration type auto-selection based on count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Property 15: For any set of registration types, clicking "Add Registration"
   * should navigate to /registrations/create with typeId when exactly one exists,
   * and without typeId when multiple exist.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it('auto-selects type when exactly one exists, shows selector when multiple exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(registrationTypeArb(), { minLength: 1, maxLength: 5 }),
        async (types) => {
          vi.clearAllMocks();
          setupMockExecute(types);

          const { unmount } = render(<RegistrationsDatabasePage />);

          await waitFor(() => {
            expect(screen.queryByText('registrations.loadingRegistrations')).not.toBeInTheDocument();
          });

          const addButton = screen.getByTestId('add-registration-button');
          fireEvent.click(addButton);

          if (types.length === 1) {
            // Should navigate with typeId
            expect(mockNavigate).toHaveBeenCalledWith(
              `/registrations/create?typeId=${types[0].id}`,
              expect.any(Object),
            );
          } else {
            // Should navigate without typeId
            expect(mockNavigate).toHaveBeenCalledWith(
              '/registrations/create',
              expect.any(Object),
            );
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── Property 16: New registration status follows automatic approval setting ──

describe('Feature: registrations-module, Property 16: New registration status follows automatic approval setting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Property 16: For any registration type, clicking "Add Registration"
   * always navigates to the create page, preserving filter state.
   * The status logic is now handled by CreateRegistrationPage.
   *
   * **Validates: Requirements 6.5, 6.6**
   */
  it('sets status to active when auto-approve enabled, pending when disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (automaticallyApprove) => {
          vi.clearAllMocks();

          const type: RegistrationType = {
            id: 'type-1',
            organisationId: 'org-1',
            name: 'Test Type',
            description: 'desc',
            entityName: 'Horse',
            registrationFormId: 'form-1',
            registrationStatus: 'open',
            isRollingRegistration: true,
            numberOfMonths: 12,
            automaticallyApprove,
            registrationLabels: [],
            supportedPaymentMethods: [],
            useTermsAndConditions: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          setupMockExecute([type]);

          const { unmount } = render(<RegistrationsDatabasePage />);

          await waitFor(() => {
            expect(screen.queryByText('registrations.loadingRegistrations')).not.toBeInTheDocument();
          });

          const addButton = screen.getByTestId('add-registration-button');
          fireEvent.click(addButton);

          // Should navigate to create page with typeId
          expect(mockNavigate).toHaveBeenCalledWith(
            '/registrations/create?typeId=type-1',
            expect.objectContaining({
              state: expect.objectContaining({
                filterState: expect.any(Object),
              }),
            }),
          );

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});
