/**
 * Property-Based Tests for RegistrationDetailsPage
 *
 * Feature: registrations-module
 * Property 9: Registration details page displays all required fields
 *
 * For any registration, the page should display the registration number,
 * entity name, owner name, registration type, status, valid until date,
 * date last renewed, labels, processed flag, payment status, and form
 * submission data.
 *
 * **Validates: Requirements 4.2**
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import fc from 'fast-check';

// ── Mock setup (hoisted before component import) ──

const mockNavigate = vi.fn();
const mockParams: { id: string } = { id: 'reg-1' };
const mockLocation = { state: null, pathname: '/registrations/reg-1' };
const mockExecute = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
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

// ── Import component after mocks ──
import RegistrationDetailsPage from '../RegistrationDetailsPage';
import type { Registration } from '../../types/registration.types';

// ── Generators ──

const registrationStatusArb = fc.constantFrom('active' as const, 'pending' as const, 'elapsed' as const);
const paymentStatusArb = fc.constantFrom('pending' as const, 'paid' as const, 'refunded' as const);

const registrationArb = fc.record({
  id: fc.uuid(),
  organisationId: fc.constant('org-1'),
  registrationTypeId: fc.constant('type-1'),
  userId: fc.uuid(),
  registrationNumber: fc.stringMatching(/^REG-[A-Z0-9]{4,8}$/),
  entityName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  ownerName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  formSubmissionId: fc.constant('form-1'),
  dateLastRenewed: fc.constant(new Date('2025-01-01')),
  status: registrationStatusArb,
  validUntil: fc.constant(new Date('2026-01-01')),
  labels: fc.array(
    fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
    { minLength: 0, maxLength: 3 },
  ),
  processed: fc.boolean(),
  paymentStatus: paymentStatusArb,
  paymentMethod: fc.option(fc.constant('card'), { nil: undefined }),
  createdAt: fc.constant(new Date('2025-01-01')),
  updatedAt: fc.constant(new Date('2025-01-01')),
});


// ── Helper: configure mockExecute for a given registration ──

function setupMockExecute(registration: Registration) {
  mockExecute.mockImplementation(({ url }: { url: string }) => {
    if (url.includes('/registrations/') && !url.includes('/registration-types')) {
      return Promise.resolve(registration);
    }
    if (url.includes('/registration-types/')) {
      return Promise.resolve({ id: 'type-1', name: 'Horse Registration' });
    }
    if (url.includes('/form-submissions/')) {
      return Promise.resolve({
        id: 'form-1',
        submissionData: { breed: 'Thoroughbred', color: 'Bay' },
      });
    }
    return Promise.resolve(null);
  });
}

// ── Property 9: Registration details page displays all required fields ──

describe('Feature: registrations-module, Property 9: Registration details page displays all required fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 9: For any registration, the Registration Details Page should display
   * the registration number, entity name, owner name, registration type, status,
   * valid until date, date last renewed, labels, processed flag, payment status,
   * and form submission data.
   *
   * **Validates: Requirements 4.2**
   */
  it('displays all required fields for any registration', async () => {
    await fc.assert(
      fc.asyncProperty(registrationArb, async (registration) => {
        vi.clearAllMocks();
        mockParams.id = registration.id;
        setupMockExecute(registration);

        const { unmount } = render(<RegistrationDetailsPage />);

        // Wait for loading to complete
        await waitFor(() => {
          expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
        });

        // Registration number
        const regNumber = screen.getByTestId('registration-number');
        expect(regNumber.textContent).toBe(registration.registrationNumber);

        // Entity name
        const entityName = screen.getByTestId('entity-name');
        expect(entityName.textContent).toBe(registration.entityName);

        // Owner name
        const ownerName = screen.getByTestId('owner-name');
        expect(ownerName.textContent).toBe(registration.ownerName);

        // Registration type
        const regType = screen.getByTestId('registration-type');
        expect(regType.textContent).toBe('Horse Registration');

        // Status
        const status = screen.getByTestId('status');
        expect(status).toBeInTheDocument();

        // Valid until (formatted date)
        const validUntil = screen.getByTestId('valid-until');
        expect(validUntil.textContent).toBe('01 Jan 2025');

        // Date last renewed (formatted date)
        const dateLastRenewed = screen.getByTestId('date-last-renewed');
        expect(dateLastRenewed.textContent).toBe('01 Jan 2025');

        // Labels
        const labelsContainer = screen.getByTestId('labels');
        if (registration.labels.length > 0) {
          for (const label of registration.labels) {
            expect(labelsContainer.textContent).toContain(label);
          }
        } else {
          expect(labelsContainer.textContent).toContain('registrations.labels.noLabelsAssigned');
        }

        // Processed flag
        const processedFlag = screen.getByTestId('processed-flag');
        if (registration.processed) {
          expect(processedFlag.querySelector('[data-testid="processed-icon"]')).toBeTruthy();
        } else {
          expect(processedFlag.querySelector('[data-testid="unprocessed-icon"]')).toBeTruthy();
        }

        // Payment status
        const paymentStatus = screen.getByTestId('payment-status');
        expect(paymentStatus).toBeInTheDocument();

        // Form submission data
        const formData = screen.getByTestId('form-submission-data');
        expect(formData).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 20 },
    );
  });
});
