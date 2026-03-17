/**
 * Unit Tests for RegistrationsDatabasePage
 *
 * Feature: registrations-module
 * Tests: table columns, loading/empty states, export button, custom filter dropdown
 *
 * Requirements: 3.1, 3.4, 3.5, 3.6
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
  default: (props: any) => (
    <div data-testid="create-custom-filter-dialog" data-open={props.open}>
      {props.open && <span>Filter Dialog Open</span>}
    </div>
  ),
}));

vi.mock('../../components/BatchOperationsDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="batch-operations-dialog" />,
}));

import RegistrationsDatabasePage from '../RegistrationsDatabasePage';
import type { Registration } from '../../types/registration.types';

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
    labels: ['VIP', 'Verified'],
    processed: true,
    paymentStatus: 'paid',
    paymentMethod: 'card',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'reg-2',
    organisationId: 'org-1',
    registrationTypeId: 'type-2',
    userId: 'user-2',
    registrationNumber: 'REG-0002',
    entityName: 'Lightning',
    ownerName: 'Bob Jones',
    formSubmissionId: 'form-2',
    dateLastRenewed: new Date('2025-02-01'),
    status: 'pending',
    validUntil: new Date('2026-02-01'),
    labels: [],
    processed: false,
    paymentStatus: 'pending',
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
    dateLastRenewed: new Date('2024-06-01'),
    status: 'elapsed',
    validUntil: new Date('2025-06-01'),
    labels: ['Renewal'],
    processed: true,
    paymentStatus: 'paid',
    paymentMethod: 'bank',
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
  },
];

const sampleTypes = [
  { id: 'type-1', name: 'Horse Registration' },
  { id: 'type-2', name: 'Boat Registration' },
];

const sampleFilters = [
  {
    id: 'filter-1',
    organisationId: 'org-1',
    userId: 'user-1',
    name: 'Active Only',
    registrationStatus: ['active'],
    registrationLabels: [],
    registrationTypes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'filter-2',
    organisationId: 'org-1',
    userId: 'user-1',
    name: 'VIP Members',
    registrationStatus: [],
    registrationLabels: ['VIP'],
    registrationTypes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];


function setupMockExecute(
  registrations: Registration[] = sampleRegistrations,
  filters: any[] = [],
) {
  mockExecute.mockImplementation(({ url, responseType }: { url: string; responseType?: string }) => {
    if (url.includes('/registrations/filters')) return Promise.resolve(filters);
    if (url.includes('/registrations/export')) return Promise.resolve(new Blob(['test'], { type: 'application/octet-stream' }));
    if (url.includes('/registrations') && !url.includes('/registration-types')) return Promise.resolve(registrations);
    if (url.includes('/registration-types')) return Promise.resolve(sampleTypes);
    if (url.includes('/auth/me')) return Promise.resolve({ roles: [{ id: 'r1', name: 'admin', displayName: 'Admin' }] });
    return Promise.resolve([]);
  });
}

// ── Tests ──

describe('RegistrationsDatabasePage - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.state = null;
  });

  /**
   * Requirement 3.1: Table renders all required columns
   */
  describe('Table columns (Requirement 3.1)', () => {
    it('renders all required column headers', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalled();
      });

      // Check all required column headers
      expect(screen.getByText('registrations.table.registrationType')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.entityName')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.ownerName')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.registrationNumber')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.dateLastRenewed')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.status')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.validUntil')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.labels')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.processed')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.actions')).toBeInTheDocument();
    });

    it('renders registration data in table rows', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);

      // Switch to "all" to see all registrations
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByText('registrations.statusOptions.all'));

      await waitFor(() => {
        // Check entity names are rendered
        expect(screen.getByText('Thunder')).toBeInTheDocument();
        expect(screen.getByText('Lightning')).toBeInTheDocument();
        expect(screen.getByText('Storm')).toBeInTheDocument();
      });

      // Check owner names
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.getByText('Carol White')).toBeInTheDocument();

      // Check registration numbers
      expect(screen.getByText('REG-0001')).toBeInTheDocument();
      expect(screen.getByText('REG-0002')).toBeInTheDocument();
      expect(screen.getByText('REG-0003')).toBeInTheDocument();
    });
  });

  /**
   * Loading and empty states
   */
  describe('Loading and empty states', () => {
    it('shows loading state while fetching registrations', () => {
      // Make execute never resolve to keep loading state
      mockExecute.mockReturnValue(new Promise(() => {}));
      render(<RegistrationsDatabasePage />);

      expect(screen.getByText('registrations.loadingRegistrations')).toBeInTheDocument();
    });

    it('shows empty state when no registrations match', async () => {
      setupMockExecute([]);
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(screen.getByText('registrations.noRegistrationsFound')).toBeInTheDocument();
      });
    });
  });

  /**
   * Requirement 3.6: Export button triggers download
   */
  describe('Export button (Requirement 3.6)', () => {
    it('export button is present and triggers API call on click', async () => {
      setupMockExecute();

      // Mock URL.createObjectURL and revokeObjectURL
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalled();
      });

      const exportButton = screen.getByTestId('export-button');
      expect(exportButton).toBeInTheDocument();

      fireEvent.click(exportButton);

      await waitFor(() => {
        const exportCall = mockExecute.mock.calls.find(
          (call: any[]) => call[0]?.url?.includes('/registrations/export'),
        );
        expect(exportCall).toBeTruthy();
      });
    });
  });

  /**
   * Requirement 3.4, 3.5: Custom filter dropdown
   */
  describe('Custom filter dropdown (Requirements 3.4, 3.5)', () => {
    it('renders custom filter dropdown with saved filters', async () => {
      setupMockExecute(sampleRegistrations, sampleFilters);
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalled();
      });

      // The custom filter select should be present
      const filterSelect = screen.getByTestId('custom-filter-select');
      expect(filterSelect).toBeInTheDocument();
    });

    it('renders Create Filter button that opens dialog', async () => {
      setupMockExecute();
      render(<RegistrationsDatabasePage />);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalled();
      });

      const createFilterButton = screen.getByTestId('create-filter-button');
      expect(createFilterButton).toBeInTheDocument();

      fireEvent.click(createFilterButton);

      // The dialog should now be open
      await waitFor(() => {
        expect(screen.getByText('Filter Dialog Open')).toBeInTheDocument();
      });
    });
  });
});
