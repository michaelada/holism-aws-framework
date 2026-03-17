/**
 * Unit Tests for RegistrationTypeDetailsPage
 *
 * Feature: registrations-module
 * Tests: field rendering, edit navigation, delete dialog flow, loading/error states
 *
 * Requirements: 2.5, 2.6, 2.8
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock setup (MUST be before component imports) ──

const mockNavigate = vi.fn();
const mockExecute = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'type-1' }),
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

import RegistrationTypeDetailsPage from '../RegistrationTypeDetailsPage';
import type { RegistrationType } from '../../types/registration.types';

// ── Test data ──

const sampleRollingType: RegistrationType = {
  id: 'type-1',
  organisationId: 'org-1',
  name: '2026 Horse Registration',
  description: 'Annual horse registration for the 2026 season',
  entityName: 'Horse',
  registrationFormId: 'form-1',
  registrationStatus: 'open',
  isRollingRegistration: true,
  numberOfMonths: 12,
  automaticallyApprove: true,
  registrationLabels: ['VIP', 'Premium'],
  supportedPaymentMethods: ['card', 'bank_transfer'],
  useTermsAndConditions: true,
  termsAndConditions: '<p>By registering you agree to our terms.</p>',
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
};

const sampleFixedType: RegistrationType = {
  id: 'type-2',
  organisationId: 'org-1',
  name: 'Boat Registration 2025',
  description: 'Seasonal boat registration',
  entityName: 'Boat',
  registrationFormId: 'form-2',
  registrationStatus: 'closed',
  isRollingRegistration: false,
  validUntil: new Date('2025-12-31'),
  automaticallyApprove: false,
  registrationLabels: [],
  supportedPaymentMethods: ['card'],
  useTermsAndConditions: false,
  createdAt: new Date('2025-02-01'),
  updatedAt: new Date('2025-02-01'),
};

function setupMockExecute(type: RegistrationType | null = sampleRollingType) {
  mockExecute.mockImplementation(({ url, method }: { url: string; method: string }) => {
    if (method === 'DELETE') return Promise.resolve({});
    if (url.includes('/registration-types/')) return Promise.resolve(type);
    return Promise.resolve(null);
  });
}

// ── Tests ──

describe('RegistrationTypeDetailsPage - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 2.5: All fields render correctly
   */
  describe('Field rendering (Requirement 2.5)', () => {
    it('renders the registration type name in the header', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        // Name appears in h4 header and in the Name field
        const nameElements = screen.getAllByText('2026 Horse Registration');
        expect(nameElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders the entity name', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Horse')).toBeInTheDocument();
      });
    });

    it('renders the description', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Annual horse registration for the 2026 season')).toBeInTheDocument();
      });
    });

    it('renders the status as a chip for open type', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });
      expect(screen.getByText('open')).toBeInTheDocument();
    });

    it('renders the status as a chip for closed type', async () => {
      setupMockExecute(sampleFixedType);
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('closed')).toBeInTheDocument();
      });
    });

    it('renders rolling registration duration settings', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Rolling Registration')).toBeInTheDocument();
      });
      expect(screen.getByText('12 months from payment date')).toBeInTheDocument();
    });

    it('renders fixed-period registration duration settings', async () => {
      setupMockExecute(sampleFixedType);
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Fixed-Period Registration')).toBeInTheDocument();
      });
    });

    it('renders automatic approval message when enabled', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(
          screen.getByText('Applications are automatically approved and marked as Active')
        ).toBeInTheDocument();
      });
    });

    it('renders manual approval message when disabled', async () => {
      setupMockExecute(sampleFixedType);
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(
          screen.getByText('Applications require manual review and are marked as Pending')
        ).toBeInTheDocument();
      });
    });

    it('renders registration labels when present', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('VIP')).toBeInTheDocument();
      });
      expect(screen.getByText('Premium')).toBeInTheDocument();
    });

    it('does not render labels section when labels are empty', async () => {
      setupMockExecute(sampleFixedType);
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });
      expect(screen.queryByText('Registration Labels')).not.toBeInTheDocument();
    });

    it('renders supported payment methods', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('card')).toBeInTheDocument();
      });
      expect(screen.getByText('bank_transfer')).toBeInTheDocument();
    });

    it('renders terms and conditions when enabled', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Terms and Conditions')).toBeInTheDocument();
      });
      expect(screen.getByText('By registering you agree to our terms.')).toBeInTheDocument();
    });

    it('does not render terms and conditions section when disabled', async () => {
      setupMockExecute(sampleFixedType);
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });
      expect(screen.queryByText('Terms and Conditions')).not.toBeInTheDocument();
    });
  });

  /**
   * Requirement 2.6: Edit button navigation
   */
  describe('Edit button navigation (Requirement 2.6)', () => {
    it('navigates to /registrations/types/:id/edit when edit button is clicked', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      const editButton = screen.getByText('common.actions.edit');
      fireEvent.click(editButton);

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types/type-1/edit');
    });
  });

  /**
   * Requirement 2.8: Delete confirmation dialog flow
   */
  describe('Delete confirmation dialog (Requirement 2.8)', () => {
    it('opens delete confirmation dialog when delete button is clicked', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('common.actions.delete');
      fireEvent.click(deleteButton);

      expect(screen.getByText('registrations.delete.title')).toBeInTheDocument();
      expect(screen.getByText('registrations.delete.message')).toBeInTheDocument();
    });

    it('closes dialog when cancel is clicked', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      // Open dialog
      fireEvent.click(screen.getByText('common.actions.delete'));
      expect(screen.getByText('registrations.delete.title')).toBeInTheDocument();

      // Cancel
      fireEvent.click(screen.getByText('common.actions.cancel'));

      await waitFor(() => {
        expect(screen.queryByText('registrations.delete.title')).not.toBeInTheDocument();
      });
    });

    it('sends DELETE request and navigates to types list on confirm', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      // Open dialog
      fireEvent.click(screen.getByText('common.actions.delete'));

      // Find the confirm delete button inside the dialog (the second "delete" button)
      const dialogButtons = screen.getAllByText('common.actions.delete');
      const confirmButton = dialogButtons[dialogButtons.length - 1];
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'DELETE',
            url: '/api/orgadmin/registration-types/type-1',
          })
        );
      });

      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
    });
  });

  /**
   * Loading and error states
   */
  describe('Loading and error states', () => {
    it('shows loading state while fetching registration type', () => {
      mockExecute.mockReturnValue(new Promise(() => {}));
      render(<RegistrationTypeDetailsPage />);

      expect(screen.getByText('registrations.loadingType')).toBeInTheDocument();
    });

    it('shows not found state when registration type is null', async () => {
      setupMockExecute(null);
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('registrations.typeNotFound')).toBeInTheDocument();
      });
    });

    it('shows back button in not found state that navigates to types list', async () => {
      setupMockExecute(null);
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('registrations.typeNotFound')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('registrations.details.backToTypes'));
      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
    });
  });

  /**
   * Back button navigation
   */
  describe('Back button navigation', () => {
    it('navigates back to types list when back button is clicked', async () => {
      setupMockExecute();
      render(<RegistrationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('common.actions.back'));
      expect(mockNavigate).toHaveBeenCalledWith('/registrations/types');
    });
  });
});
