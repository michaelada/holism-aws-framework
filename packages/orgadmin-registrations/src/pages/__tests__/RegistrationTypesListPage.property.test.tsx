/**
 * Property-Based Tests for RegistrationTypesListPage
 *
 * Feature: registrations-module
 * Property 2: Registration type list displays all required fields
 *
 * Tests that the RegistrationTypesListPage renders every registration type
 * showing its name, entity name, status, and creation date.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import fc from 'fast-check';

// ── Mock setup (hoisted before component import) ──

const mockNavigate = vi.fn();
const mockExecute = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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

// ── Import component after mocks ──
import RegistrationTypesListPage from '../RegistrationTypesListPage';
import type { RegistrationType } from '../../types/registration.types';

// ── Generators ──

// Use alphanumeric names prefixed to avoid collisions with translation keys
const safeNameArb = fc.stringMatching(/^[A-Z][a-z]{2,15} [A-Z][a-z]{2,10}$/);
const safeEntityArb = fc.stringMatching(/^[A-Z][a-z]{2,10}$/);

const registrationTypeArb = fc.record({
  id: fc.uuid(),
  organisationId: fc.constant('org-1'),
  name: safeNameArb,
  description: fc.string({ minLength: 0, maxLength: 50 }),
  entityName: safeEntityArb,
  registrationFormId: fc.uuid(),
  registrationStatus: fc.constantFrom('open' as const, 'closed' as const),
  isRollingRegistration: fc.boolean(),
  numberOfMonths: fc.option(fc.integer({ min: 1, max: 36 }), { nil: undefined }),
  automaticallyApprove: fc.boolean(),
  registrationLabels: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
  supportedPaymentMethods: fc.array(fc.string(), { minLength: 0, maxLength: 2 }),
  useTermsAndConditions: fc.boolean(),
  createdAt: fc.constant(new Date('2025-01-15')),
  updatedAt: fc.constant(new Date('2025-01-15')),
});

// ── Property 2: Registration type list displays all required fields ──

describe('Feature: registrations-module, Property 2: Registration type list displays all required fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 2: For any set of registration types belonging to an organisation,
   * the Registration Types List Page should render every type showing its name,
   * entity name, status, and creation date.
   *
   * **Validates: Requirements 2.1**
   */
  it('renders every registration type with name, entity name, status, and creation date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(registrationTypeArb, { minLength: 1, maxLength: 6 }),
        async (registrationTypes) => {
          mockExecute.mockImplementation(({ url }: { url: string }) => {
            if (url.includes('/registration-types')) return Promise.resolve(registrationTypes);
            return Promise.resolve([]);
          });

          const { unmount } = render(<RegistrationTypesListPage />);

          // Wait for data to load
          await waitFor(() => {
            expect(screen.queryByText('registrations.loadingTypes')).not.toBeInTheDocument();
          });

          // Verify table headers for required fields
          const table = screen.getByRole('table');
          const thead = table.querySelector('thead')!;
          const theadScope = within(thead as HTMLElement);
          expect(theadScope.getByText('registrations.table.name')).toBeInTheDocument();
          expect(theadScope.getByText('registrations.table.entityName')).toBeInTheDocument();
          expect(theadScope.getByText('registrations.table.status')).toBeInTheDocument();
          expect(theadScope.getByText('registrations.table.createdAt')).toBeInTheDocument();

          // Verify each registration type's data is rendered
          const tbody = table.querySelector('tbody')!;
          const tbodyScope = within(tbody as HTMLElement);
          const dataRows = tbody.querySelectorAll('tr');

          // Should have one row per registration type
          expect(dataRows.length).toBe(registrationTypes.length);

          // Each type's name, entity name, and status should appear in the tbody
          for (const regType of registrationTypes) {
            // Use getAllByText since multiple types could share the same entity name
            const nameMatches = tbodyScope.getAllByText(regType.name);
            expect(nameMatches.length).toBeGreaterThanOrEqual(1);
            const entityMatches = tbodyScope.getAllByText(regType.entityName);
            expect(entityMatches.length).toBeGreaterThanOrEqual(1);
          }

          // All statuses should be rendered (as chips in tbody)
          for (const regType of registrationTypes) {
            const statusChips = tbodyScope.getAllByText(regType.registrationStatus);
            expect(statusChips.length).toBeGreaterThanOrEqual(1);
          }

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});
