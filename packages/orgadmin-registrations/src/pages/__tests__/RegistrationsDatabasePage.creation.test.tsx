/**
 * Unit Tests for Registration Creation Flow (Navigation)
 *
 * Feature: registrations-module
 * Tests: Add Registration button navigates to the CreateRegistrationPage
 *        with correct query params based on number of registration types.
 *
 * Requirements: 6.2, 6.3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

// ── Test data ──

const makeType = (overrides: Partial<RegistrationType> = {}): RegistrationType => ({
  id: 'type-1',
  organisationId: 'org-1',
  name: 'Horse Registration',
  description: 'Register your horse',
  entityName: 'Horse',
  registrationFormId: 'form-1',
  registrationStatus: 'open',
  isRollingRegistration: true,
  numberOfMonths: 12,
  automaticallyApprove: true,
  registrationLabels: [],
  supportedPaymentMethods: [],
  useTermsAndConditions: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const singleType = [makeType()];
const multipleTypes = [
  makeType({ id: 'type-1', name: 'Horse Registration', entityName: 'Horse' }),
  makeType({ id: 'type-2', name: 'Boat Registration', entityName: 'Boat', automaticallyApprove: false }),
];

const adminRoles = [{ id: 'r1', name: 'admin', displayName: 'Admin' }];

function setupMockExecute(types: RegistrationType[]) {
  mockExecute.mockImplementation(({ method, url }: { method: string; url: string }) => {
    if (url.includes('/registrations/filters')) return Promise.resolve([]);
    if (url.includes('/registrations/export')) return Promise.resolve(new Blob());
    if (url.includes('/registrations') && !url.includes('/registration-types')) return Promise.resolve([]);
    if (url.includes('/registration-types')) return Promise.resolve(types);
    if (url.includes('/auth/me')) return Promise.resolve({ roles: adminRoles });
    return Promise.resolve([]);
  });
}

// ── Tests ──

describe('RegistrationsDatabasePage - Registration Creation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Requirement 6.2: Auto-selection with single type
   * When only one type exists, navigates directly with typeId
   */
  describe('Auto-selection with single type (Requirement 6.2)', () => {
    it('navigates to create page with typeId when only one type exists', async () => {
      setupMockExecute(singleType);
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingRegistrations')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('add-registration-button'));

      expect(mockNavigate).toHaveBeenCalledWith(
        '/registrations/create?typeId=type-1',
        expect.objectContaining({ state: expect.any(Object) }),
      );
    });
  });

  /**
   * Requirement 6.3: Type selector with multiple types
   * When multiple types exist, navigates without typeId (page shows selector)
   */
  describe('Type selector with multiple types (Requirement 6.3)', () => {
    it('navigates to create page without typeId when multiple types exist', async () => {
      setupMockExecute(multipleTypes);
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingRegistrations')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('add-registration-button'));

      expect(mockNavigate).toHaveBeenCalledWith(
        '/registrations/create',
        expect.objectContaining({ state: expect.any(Object) }),
      );
    });
  });

  /**
   * Requirement 6.2/6.3: Filter state is preserved in navigation
   */
  describe('Filter state preservation', () => {
    it('passes current filter state when navigating to create page', async () => {
      setupMockExecute(singleType);
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingRegistrations')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('add-registration-button'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          state: expect.objectContaining({
            filterState: expect.objectContaining({
              searchTerm: '',
              statusFilter: 'current',
              selectedCustomFilter: '',
            }),
          }),
        }),
      );
    });
  });

  /**
   * Add Registration button visibility
   */
  describe('Add Registration button visibility', () => {
    it('shows Add Registration button when types exist and user has admin role', async () => {
      setupMockExecute(singleType);
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(screen.getByTestId('add-registration-button')).toBeInTheDocument();
      });
    });

    it('hides Add Registration button when no types exist', async () => {
      setupMockExecute([]);
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingRegistrations')).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('add-registration-button')).not.toBeInTheDocument();
    });

    it('hides Add Registration button when user has no admin role', async () => {
      mockExecute.mockImplementation(({ url }: { url: string }) => {
        if (url.includes('/registration-types')) return Promise.resolve(singleType);
        if (url.includes('/auth/me')) return Promise.resolve({ roles: [{ id: 'r1', name: 'viewer', displayName: 'Viewer' }] });
        if (url.includes('/registrations/filters')) return Promise.resolve([]);
        if (url.includes('/registrations')) return Promise.resolve([]);
        return Promise.resolve([]);
      });
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingRegistrations')).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('add-registration-button')).not.toBeInTheDocument();
    });
  });
});
