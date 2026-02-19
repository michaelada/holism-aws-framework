import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { CreateOrganizationPage } from '../pages/CreateOrganizationPage';
import { NotificationProvider } from '../context/NotificationContext';
import * as organizationApi from '../services/organizationApi';

// Mock the organization API
vi.mock('../services/organizationApi');

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

const mockOrganizationTypes = [
  {
    id: '1',
    name: 'test-org-type',
    displayName: 'Test Organization Type',
    description: 'Test description',
    currency: 'EUR',
    language: 'en',
    defaultLocale: 'en-GB',
    defaultCapabilities: ['events'],
    status: 'active' as const,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

const mockPaymentMethods = [
  {
    id: '1',
    name: 'pay-offline',
    displayName: 'Pay Offline',
    description: 'Payment instructions will be provided in the confirmation email.',
    requiresActivation: false,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'stripe',
    displayName: 'Pay By Card (Stripe)',
    description: 'Accept card payments through Stripe.',
    requiresActivation: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '3',
    name: 'helix-pay',
    displayName: 'Pay By Card (Helix-Pay)',
    description: 'Accept card payments through Helix-Pay.',
    requiresActivation: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const mockCreatedOrganization = {
  id: 'org-1',
  organizationTypeId: '1',
  keycloakGroupId: 'group-1',
  name: 'test-org',
  displayName: 'Test Organization',
  status: 'active' as const,
  currency: 'EUR',
  language: 'en',
  enabledCapabilities: ['events'],
  settings: {},
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <NotificationProvider>{component}</NotificationProvider>
    </BrowserRouter>
  );
};

describe('CreateOrganizationPage - Payment Methods Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(organizationApi.getCapabilities).mockResolvedValue(mockCapabilities);
    vi.mocked(organizationApi.getOrganizationTypes).mockResolvedValue(mockOrganizationTypes);
    vi.mocked(organizationApi.getPaymentMethods).mockResolvedValue(mockPaymentMethods);
  });

  it('should load and display payment methods with pay-offline selected by default', async () => {
    renderWithProviders(<CreateOrganizationPage />);

    await waitFor(() => {
      const paymentMethodsHeadings = screen.getAllByText('Payment Methods');
      expect(paymentMethodsHeadings.length).toBeGreaterThan(0);
    });

    // Check that all payment methods are displayed
    expect(screen.getByText('Pay Offline')).toBeInTheDocument();
    expect(screen.getByText('Pay By Card (Stripe)')).toBeInTheDocument();
    expect(screen.getByText('Pay By Card (Helix-Pay)')).toBeInTheDocument();

    // Find the checkbox for pay-offline - should be checked by default
    const payOfflineCheckbox = screen.getByRole('checkbox', { 
      name: /Pay Offline/i 
    });
    expect(payOfflineCheckbox).toBeChecked();
  });

  it('should allow selecting/deselecting payment methods and include them in form submission', async () => {
    vi.mocked(organizationApi.createOrganization).mockResolvedValue(mockCreatedOrganization);
    const user = userEvent.setup();
    
    renderWithProviders(<CreateOrganizationPage />);

    await waitFor(() => {
      const paymentMethodsHeadings = screen.getAllByText('Payment Methods');
      expect(paymentMethodsHeadings.length).toBeGreaterThan(0);
    });

    // Select Stripe
    const stripeCheckbox = screen.getByRole('checkbox', { 
      name: /Pay By Card \(Stripe\)/i 
    });
    await user.click(stripeCheckbox);
    expect(stripeCheckbox).toBeChecked();

    // Fill in required fields
    await user.type(screen.getByLabelText(/name \(url-friendly\)/i), 'test-org');
    await user.type(screen.getByLabelText(/display name/i), 'Test Organization');

    // Select organization type
    const orgTypeSelect = screen.getAllByRole('combobox')[0]; // First combobox is org type
    await user.click(orgTypeSelect);
    await user.click(screen.getByRole('option', { name: 'Test Organization Type' }));

    // Select a capability
    const eventsCheckbox = screen.getByRole('checkbox', { name: /events/i });
    await user.click(eventsCheckbox);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /create organisation/i });
    await user.click(submitButton);

    // Verify the API was called with selected payment methods
    await waitFor(() => {
      expect(organizationApi.createOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'testorg', // Name is sanitized by the form (hyphens removed)
          displayName: 'Test Organization',
          organizationTypeId: '1',
          enabledCapabilities: ['events'],
          enabledPaymentMethods: ['pay-offline', 'stripe'],
        })
      );
    });
  });
});
