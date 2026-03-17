/**
 * Unit Tests for RegistrationDetailsPage
 *
 * Feature: registrations-module
 * Tests: field rendering, back button navigation, loading and error states
 *
 * Requirements: 4.1, 4.2, 4.3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock setup ──

const mockNavigate = vi.fn();
const mockParams: { id: string } = { id: 'reg-1' };
const mockLocationState: { state: any; pathname: string } = {
  state: { statusFilter: 'current', searchTerm: 'Thunder' },
  pathname: '/registrations/reg-1',
};
const mockExecute = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useLocation: () => mockLocationState,
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

import RegistrationDetailsPage from '../RegistrationDetailsPage';
import type { Registration } from '../../types/registration.types';

// ── Test data ──

const sampleRegistration: Registration = {
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
};

const sampleRegistrationType = {
  id: 'type-1',
  name: 'Horse Registration',
};

const sampleFormSubmission = {
  id: 'form-1',
  submissionData: {
    breed: 'Thoroughbred',
    color: 'Bay',
  },
};

function setupMockExecute(
  registration: Registration | null = sampleRegistration,
  registrationType: any = sampleRegistrationType,
  formSubmission: any = sampleFormSubmission,
) {
  mockExecute.mockImplementation(({ url }: { url: string }) => {
    if (url.includes('/registrations/') && !url.includes('/registration-types')) {
      return Promise.resolve(registration);
    }
    if (url.includes('/registration-types/')) {
      return Promise.resolve(registrationType);
    }
    if (url.includes('/form-submissions/')) {
      return Promise.resolve(formSubmission);
    }
    return Promise.resolve(null);
  });
}

// ── Tests ──

describe('RegistrationDetailsPage - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.id = 'reg-1';
    mockLocationState.state = { statusFilter: 'current', searchTerm: 'Thunder' };
  });

  /**
   * Requirement 4.2: All fields render correctly
   */
  describe('Field rendering (Requirement 4.2)', () => {
    it('renders registration number', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('registration-number')).toBeInTheDocument();
      });
      expect(screen.getByTestId('registration-number').textContent).toBe('REG-0001');
    });

    it('renders entity name', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('entity-name')).toBeInTheDocument();
      });
      expect(screen.getByTestId('entity-name').textContent).toBe('Thunder');
    });

    it('renders owner name', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('owner-name')).toBeInTheDocument();
      });
      expect(screen.getByTestId('owner-name').textContent).toBe('Alice Smith');
    });

    it('renders registration type name', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('registration-type')).toBeInTheDocument();
      });
      expect(screen.getByTestId('registration-type').textContent).toBe('Horse Registration');
    });

    it('renders status chip', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('status')).toBeInTheDocument();
      });
    });

    it('renders valid until date', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('valid-until')).toBeInTheDocument();
      });
      expect(screen.getByTestId('valid-until').textContent).toBe('01 Jan 2025');
    });

    it('renders date last renewed', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('date-last-renewed')).toBeInTheDocument();
      });
      expect(screen.getByTestId('date-last-renewed').textContent).toBe('01 Jan 2025');
    });

    it('renders labels', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('labels')).toBeInTheDocument();
      });
      expect(screen.getByText('VIP')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders no labels message when labels are empty', async () => {
      const regNoLabels = { ...sampleRegistration, labels: [] };
      setupMockExecute(regNoLabels);
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('labels')).toBeInTheDocument();
      });
      expect(screen.getByText('registrations.labels.noLabelsAssigned')).toBeInTheDocument();
    });

    it('renders processed flag with correct icon', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('processed-flag')).toBeInTheDocument();
      });
      expect(screen.getByTestId('processed-icon')).toBeInTheDocument();
    });

    it('renders unprocessed icon when not processed', async () => {
      const regUnprocessed = { ...sampleRegistration, processed: false };
      setupMockExecute(regUnprocessed);
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('processed-flag')).toBeInTheDocument();
      });
      expect(screen.getByTestId('unprocessed-icon')).toBeInTheDocument();
    });

    it('renders payment status', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('payment-status')).toBeInTheDocument();
      });
    });

    it('renders form submission data', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('form-submission-data')).toBeInTheDocument();
      });
      expect(screen.getByText('Breed')).toBeInTheDocument();
      expect(screen.getByText('Thoroughbred')).toBeInTheDocument();
      expect(screen.getByText('Color')).toBeInTheDocument();
      expect(screen.getByText('Bay')).toBeInTheDocument();
    });
  });

  /**
   * Requirement 4.1: Back button navigation
   */
  describe('Back button navigation (Requirement 4.1, 4.3)', () => {
    it('navigates back to registrations database on back button click', async () => {
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      expect(mockNavigate).toHaveBeenCalledWith('/registrations', {
        state: { statusFilter: 'current', searchTerm: 'Thunder' },
      });
    });

    it('preserves filter state when navigating back', async () => {
      mockLocationState.state = { statusFilter: 'elapsed', searchTerm: 'Storm', customFilterId: 'f-1' };
      setupMockExecute();
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      expect(mockNavigate).toHaveBeenCalledWith('/registrations', {
        state: { statusFilter: 'elapsed', searchTerm: 'Storm', customFilterId: 'f-1' },
      });
    });
  });

  /**
   * Loading and error states
   */
  describe('Loading and error states', () => {
    it('shows loading state while fetching registration', () => {
      mockExecute.mockReturnValue(new Promise(() => {}));
      render(<RegistrationDetailsPage />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('registrations.loadingRegistration')).toBeInTheDocument();
    });

    it('shows error state when registration not found', async () => {
      mockExecute.mockRejectedValue(new Error('Not found'));
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('registrations.failedToLoad')).toBeInTheDocument();
    });

    it('shows error state with back button when registration is null', async () => {
      setupMockExecute(null);
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('registrations.registrationNotFound')).toBeInTheDocument();
      expect(screen.getByText('registrations.details.backToRegistrations')).toBeInTheDocument();
    });

    it('back button in error state navigates to registrations', async () => {
      setupMockExecute(null);
      render(<RegistrationDetailsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('registrations.details.backToRegistrations'));
      expect(mockNavigate).toHaveBeenCalledWith('/registrations', expect.anything());
    });
  });
});
