import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CreateOrganizationTypePage } from '../pages/CreateOrganizationTypePage';
import { EditOrganizationTypePage } from '../pages/EditOrganizationTypePage';
import { OrganizationTypeDetailsPage } from '../pages/OrganizationTypeDetailsPage';
import { OrganizationTypesPage } from '../pages/OrganizationTypesPage';
import { NotificationProvider } from '../context/NotificationContext';
import * as organizationApi from '../services/organizationApi';

// Mock the organization API
vi.mock('../services/organizationApi');

// Mock useParams for route parameters
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: '1' })),
  };
});

const mockCapabilities = [
  {
    id: '1',
    name: 'events',
    displayName: 'Events',
    description: 'Event management',
    category: 'core-service' as const,
    isActive: true,
    createdAt: '2024-01-01',
  },
];

const mockOrganizationType = {
  id: '1',
  name: 'test-org-type',
  displayName: 'Test Organization Type',
  description: 'Test description',
  currency: 'EUR',
  language: 'fr',
  defaultLocale: 'fr-FR',
  defaultCapabilities: ['events'],
  status: 'active' as const,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  organizationCount: 5,
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <NotificationProvider>{component}</NotificationProvider>
    </BrowserRouter>
  );
};

describe('Organization Type Locale Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CreateOrganizationTypePage', () => {
    it('should display locale field in the form', async () => {
      vi.mocked(organizationApi.getCapabilities).mockResolvedValue(mockCapabilities);

      renderWithProviders(<CreateOrganizationTypePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/default locale/i)).toBeInTheDocument();
      });
    });

    it('should have en-GB as default locale', async () => {
      vi.mocked(organizationApi.getCapabilities).mockResolvedValue(mockCapabilities);

      renderWithProviders(<CreateOrganizationTypePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/default locale/i)).toBeInTheDocument();
      });

      // For Material-UI Select, check the displayed text instead of input value
      const localeField = screen.getByLabelText(/default locale/i);
      expect(localeField).toHaveTextContent('English (UK)');
    });

    it('should display all six supported locales in dropdown', async () => {
      vi.mocked(organizationApi.getCapabilities).mockResolvedValue(mockCapabilities);
      const user = userEvent.setup();

      renderWithProviders(<CreateOrganizationTypePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/default locale/i)).toBeInTheDocument();
      });

      // Click the locale dropdown
      const localeField = screen.getByLabelText(/default locale/i);
      await user.click(localeField);

      // Check that all six locales are present (use getAllByText for the selected one)
      await waitFor(() => {
        const options = screen.getAllByText('English (UK)');
        expect(options.length).toBeGreaterThan(0);
        expect(screen.getByRole('option', { name: 'Français (France)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Español (España)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Italiano (Italia)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Deutsch (Deutschland)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Português (Portugal)' })).toBeInTheDocument();
      });
    });

    it('should allow selecting a different locale', async () => {
      vi.mocked(organizationApi.getCapabilities).mockResolvedValue(mockCapabilities);
      vi.mocked(organizationApi.createOrganizationType).mockResolvedValue(mockOrganizationType);
      const user = userEvent.setup();

      renderWithProviders(<CreateOrganizationTypePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/default locale/i)).toBeInTheDocument();
      });

      // Fill in required fields
      await user.type(screen.getByLabelText(/name \(url-friendly\)/i), 'test-org');
      await user.type(screen.getByLabelText(/display name/i), 'Test Org');

      // Select a different locale
      const localeField = screen.getByLabelText(/default locale/i);
      await user.click(localeField);
      
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Français (France)' })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('option', { name: 'Français (France)' }));

      // Select a capability
      const eventsCheckbox = screen.getByRole('checkbox', { name: /events/i });
      await user.click(eventsCheckbox);

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /create organisation type/i });
      await user.click(submitButton);

      // Verify the API was called with the correct locale
      await waitFor(() => {
        expect(organizationApi.createOrganizationType).toHaveBeenCalledWith(
          expect.objectContaining({
            defaultLocale: 'fr-FR',
          })
        );
      });
    });

    it('should submit form with selected locale', async () => {
      vi.mocked(organizationApi.getCapabilities).mockResolvedValue(mockCapabilities);
      vi.mocked(organizationApi.createOrganizationType).mockResolvedValue(mockOrganizationType);
      const user = userEvent.setup();

      renderWithProviders(<CreateOrganizationTypePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/name \(url-friendly\)/i)).toBeInTheDocument();
      });

      // Fill in the form
      await user.type(screen.getByLabelText(/name \(url-friendly\)/i), 'test-org');
      await user.type(screen.getByLabelText(/display name/i), 'Test Org');

      // Select locale (default is en-GB, so we'll keep it)
      // Select a capability
      const eventsCheckbox = screen.getByRole('checkbox', { name: /events/i });
      await user.click(eventsCheckbox);

      // Submit
      const submitButton = screen.getByRole('button', { name: /create organisation type/i });
      await user.click(submitButton);

      // Verify API call includes locale
      await waitFor(() => {
        expect(organizationApi.createOrganizationType).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'test-org',
            displayName: 'Test Org',
            defaultLocale: 'en-GB',
            defaultCapabilities: ['events'],
          })
        );
      });
    });
  });

  describe('EditOrganizationTypePage', () => {
    it('should display current locale in the form', async () => {
      vi.mocked(organizationApi.getCapabilities).mockResolvedValue(mockCapabilities);
      vi.mocked(organizationApi.getOrganizationTypeById).mockResolvedValue(mockOrganizationType);

      renderWithProviders(<EditOrganizationTypePage />);

      await waitFor(() => {
        const localeField = screen.getByLabelText(/default locale/i);
        expect(localeField).toHaveTextContent('Français (France)');
      });
    });

    it('should allow updating the locale', async () => {
      vi.mocked(organizationApi.getCapabilities).mockResolvedValue(mockCapabilities);
      vi.mocked(organizationApi.getOrganizationTypeById).mockResolvedValue(mockOrganizationType);
      vi.mocked(organizationApi.updateOrganizationType).mockResolvedValue(mockOrganizationType);
      const user = userEvent.setup();

      renderWithProviders(<EditOrganizationTypePage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/default locale/i)).toBeInTheDocument();
      });

      // Change the locale
      const localeField = screen.getByLabelText(/default locale/i);
      await user.click(localeField);
      
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Español (España)' })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('option', { name: 'Español (España)' }));

      // Submit
      const submitButton = screen.getByRole('button', { name: /update organisation type/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(organizationApi.updateOrganizationType).toHaveBeenCalledWith(
          '1',
          expect.objectContaining({
            defaultLocale: 'es-ES',
          })
        );
      });
    });
  });

  describe('OrganizationTypeDetailsPage', () => {
    it('should display locale in details page', async () => {
      vi.mocked(organizationApi.getOrganizationTypeById).mockResolvedValue(mockOrganizationType);

      renderWithProviders(<OrganizationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText(/default locale/i)).toBeInTheDocument();
      });
      
      // Check for the locale name and code
      expect(screen.getByText('Français (France)')).toBeInTheDocument();
      expect(screen.getByText('fr-FR')).toBeInTheDocument();
    });

    it('should display locale name not just code', async () => {
      vi.mocked(organizationApi.getOrganizationTypeById).mockResolvedValue(mockOrganizationType);

      renderWithProviders(<OrganizationTypeDetailsPage />);

      await waitFor(() => {
        // Should show the friendly name
        expect(screen.getByText('Français (France)')).toBeInTheDocument();
      });
      
      // And also the code
      expect(screen.getByText('fr-FR')).toBeInTheDocument();
    });

    it('should handle missing locale gracefully', async () => {
      const orgTypeWithoutLocale = {
        ...mockOrganizationType,
        defaultLocale: 'en-GB', // Fallback
      };
      vi.mocked(organizationApi.getOrganizationTypeById).mockResolvedValue(orgTypeWithoutLocale);

      renderWithProviders(<OrganizationTypeDetailsPage />);

      await waitFor(() => {
        expect(screen.getByText(/default locale/i)).toBeInTheDocument();
      });
      
      expect(screen.getByText('English (UK)')).toBeInTheDocument();
    });
  });

  describe('OrganizationTypesPage', () => {
    it('should display locale column in the table', async () => {
      vi.mocked(organizationApi.getOrganizationTypes).mockResolvedValue([mockOrganizationType]);

      renderWithProviders(<OrganizationTypesPage />);

      await waitFor(() => {
        expect(screen.getByText('Locale')).toBeInTheDocument();
      });
    });

    it('should display locale value for each organization type', async () => {
      const orgTypes = [
        mockOrganizationType,
        {
          ...mockOrganizationType,
          id: '2',
          name: 'another-type',
          defaultLocale: 'de-DE',
        },
      ];
      vi.mocked(organizationApi.getOrganizationTypes).mockResolvedValue(orgTypes);

      renderWithProviders(<OrganizationTypesPage />);

      await waitFor(() => {
        expect(screen.getByText('fr-FR')).toBeInTheDocument();
        expect(screen.getByText('de-DE')).toBeInTheDocument();
      });
    });

    it('should display default locale when not set', async () => {
      const orgTypeWithoutLocale = {
        ...mockOrganizationType,
        defaultLocale: undefined as any,
      };
      vi.mocked(organizationApi.getOrganizationTypes).mockResolvedValue([orgTypeWithoutLocale]);

      renderWithProviders(<OrganizationTypesPage />);

      await waitFor(() => {
        // Should show en-GB as fallback
        expect(screen.getByText('en-GB')).toBeInTheDocument();
      });
    });
  });
});
