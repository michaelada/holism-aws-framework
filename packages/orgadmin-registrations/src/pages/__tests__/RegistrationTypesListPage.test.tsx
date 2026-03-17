/**
 * Unit Tests for RegistrationTypesListPage
 *
 * Feature: registrations-module
 * Tests: list columns, create button navigation, row click navigation, loading/empty states
 *
 * Requirements: 2.1, 2.2, 2.5
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock setup ──

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

import RegistrationTypesListPage from '../RegistrationTypesListPage';
import type { RegistrationType } from '../../types/registration.types';

// ── Test data ──

const sampleTypes: RegistrationType[] = [
  {
    id: 'type-1',
    organisationId: 'org-1',
    name: '2026 Horse Registration',
    description: 'Annual horse registration',
    entityName: 'Horse',
    registrationFormId: 'form-1',
    registrationStatus: 'open',
    isRollingRegistration: true,
    numberOfMonths: 12,
    automaticallyApprove: true,
    registrationLabels: ['VIP'],
    supportedPaymentMethods: ['card'],
    useTermsAndConditions: false,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  },
  {
    id: 'type-2',
    organisationId: 'org-1',
    name: 'Boat Registration 2025',
    description: 'Boat registration for the season',
    entityName: 'Boat',
    registrationFormId: 'form-2',
    registrationStatus: 'closed',
    isRollingRegistration: false,
    validUntil: new Date('2025-12-31'),
    automaticallyApprove: false,
    registrationLabels: [],
    supportedPaymentMethods: [],
    useTermsAndConditions: true,
    termsAndConditions: '<p>Terms</p>',
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-02-01'),
  },
];

function setupMockExecute(types: RegistrationType[] = sampleTypes) {
  mockExecute.mockImplementation(({ url }: { url: string }) => {
    if (url.includes('/registration-types')) return Promise.resolve(types);
    return Promise.resolve([]);
  });
}

// ── Tests ──

describe('RegistrationTypesListPage - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 2.1: List renders all required columns
   */
  describe('List columns (Requirement 2.1)', () => {
    it('renders all required column headers', async () => {
      setupMockExecute();
      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingTypes')).not.toBeInTheDocument();
      });

      expect(screen.getByText('registrations.table.name')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.entityName')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.status')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.createdAt')).toBeInTheDocument();
      expect(screen.getByText('registrations.table.actions')).toBeInTheDocument();
    });

    it('renders registration type data in rows', async () => {
      setupMockExecute();
      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingTypes')).not.toBeInTheDocument();
      });

      // Names
      expect(screen.getByText('2026 Horse Registration')).toBeInTheDocument();
      expect(screen.getByText('Boat Registration 2025')).toBeInTheDocument();

      // Entity names
      expect(screen.getByText('Horse')).toBeInTheDocument();
      expect(screen.getByText('Boat')).toBeInTheDocument();

      // Statuses
      expect(screen.getByText('open')).toBeInTheDocument();
      expect(screen.getByText('closed')).toBeInTheDocument();
    });
  });

  /**
   * Requirement 2.2: Create button navigation
   */
  describe('Create button navigation (Requirement 2.2)', () => {
    it('navigates to /registrations/types/new when create button is clicked', async () => {
      setupMockExecute();
      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingTypes')).not.toBeInTheDocument();
      });

      const createButton = screen.getByText('registrations.createRegistrationType');
      fireEvent.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types/new');
    });
  });

  /**
   * Requirement 2.5: Row click navigation
   */
  describe('Row click navigation (Requirement 2.5)', () => {
    it('navigates to /registrations/types/:id when a row is clicked', async () => {
      setupMockExecute();
      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingTypes')).not.toBeInTheDocument();
      });

      // Click on the first registration type row
      const row = screen.getByText('2026 Horse Registration').closest('tr')!;
      fireEvent.click(row);

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types/type-1');
    });

    it('navigates to /registrations/types/:id when view icon is clicked', async () => {
      setupMockExecute();
      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingTypes')).not.toBeInTheDocument();
      });

      // Find view buttons by title
      const viewButtons = screen.getAllByTitle('registrations.tooltips.viewDetails');
      fireEvent.click(viewButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types/type-1');
    });

    it('navigates to edit page when edit icon is clicked', async () => {
      setupMockExecute();
      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingTypes')).not.toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('registrations.tooltips.edit');
      fireEvent.click(editButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types/type-1/edit');
    });
  });

  /**
   * Loading and empty states
   */
  describe('Loading and empty states', () => {
    it('shows loading state while fetching registration types', () => {
      mockExecute.mockReturnValue(new Promise(() => {}));
      render(<RegistrationTypesListPage />);

      expect(screen.getByText('registrations.loadingTypes')).toBeInTheDocument();
    });

    it('shows empty state when no registration types exist', async () => {
      setupMockExecute([]);
      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.getByText('registrations.noTypesFound')).toBeInTheDocument();
      });
    });

    it('shows no matching types message when search/filter yields no results', async () => {
      setupMockExecute();
      render(<RegistrationTypesListPage />);

      await waitFor(() => {
        expect(screen.queryByText('registrations.loadingTypes')).not.toBeInTheDocument();
      });

      // Type a search term that won't match anything
      const searchInput = screen.getByPlaceholderText('registrations.searchPlaceholder');
      fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });

      expect(screen.getByText('registrations.noMatchingTypes')).toBeInTheDocument();
    });
  });
});
