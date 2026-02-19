import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { EditOrganizationPage } from '../pages/EditOrganizationPage';
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
  {
    id: '2',
    name: 'memberships',
    displayName: 'Memberships',
    description: 'Membership management',
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

const mockOrganization = {
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
  paymentMethods: [
    {
      id: 'pm-1',
      organizationId: 'org-1',
      paymentMethodId: '1',
      status: 'active' as const,
      paymentData: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      paymentMethod: {
        id: '1',
        name: 'pay-offline',
        displayName: 'Pay Offline',
        description: 'Payment instructions will be provided in the confirmation email.',
        requiresActivation: false,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    },
  ],
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <NotificationProvider>
        <Routes>
          <Route path="/organizations/:id/edit" element={component} />
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
};

describe('EditOrganizationPage - Payment Methods Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(organizationApi.getCapabilities).mockResolvedValue(mockCapabilities);
    vi.mocked(organizationApi.getOrganizationTypes).mockResolvedValue(mockOrganizationTypes);
    vi.mocked(organizationApi.getPaymentMethods).mockResolvedValue(mockPaymentMethods);
    vi.mocked(organizationApi.getOrganizationById).mockResolvedValue(mockOrganization);
  });

  it('should load and display payment methods with current selections pre-selected', async () => {
    // Navigate to the edit page
    window.history.pushState({}, '', '/organizations/org-1/edit');
    
    renderWithProviders(<EditOrganizationPage />);

    await waitFor(() => {
      const paymentMethodsHeadings = screen.getAllByText('Payment Methods');
      expect(paymentMethodsHeadings.length).toBeGreaterThan(0);
    });

    // Check that all payment methods are displayed
    expect(screen.getByText('Pay Offline')).toBeInTheDocument();
    expect(screen.getByText('Pay By Card (Stripe)')).toBeInTheDocument();
    expect(screen.getByText('Pay By Card (Helix-Pay)')).toBeInTheDocument();

    // Find the checkbox for pay-offline - should be checked (current association)
    const payOfflineCheckbox = screen.getByRole('checkbox', { 
      name: /Pay Offline/i 
    });
    expect(payOfflineCheckbox).toBeChecked();

    // Stripe should not be checked
    const stripeCheckbox = screen.getByRole('checkbox', { 
      name: /Pay By Card \(Stripe\)/i 
    });
    expect(stripeCheckbox).not.toBeChecked();
  });

  it('should allow selecting/deselecting payment methods and include them in update submission', async () => {
    const updatedOrganization = { ...mockOrganization };
    vi.mocked(organizationApi.updateOrganization).mockResolvedValue(updatedOrganization);
    const user = userEvent.setup();
    
    // Navigate to the edit page
    window.history.pushState({}, '', '/organizations/org-1/edit');
    
    renderWithProviders(<EditOrganizationPage />);

    await waitFor(() => {
      const paymentMethodsHeadings = screen.getAllByText('Payment Methods');
      expect(paymentMethodsHeadings.length).toBeGreaterThan(0);
    });

    // Select Stripe (add new payment method)
    const stripeCheckbox = screen.getByRole('checkbox', { 
      name: /Pay By Card \(Stripe\)/i 
    });
    await user.click(stripeCheckbox);
    expect(stripeCheckbox).toBeChecked();

    // Deselect pay-offline (remove existing payment method)
    const payOfflineCheckbox = screen.getByRole('checkbox', { 
      name: /Pay Offline/i 
    });
    await user.click(payOfflineCheckbox);
    expect(payOfflineCheckbox).not.toBeChecked();

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /update organisation/i });
    await user.click(submitButton);

    // Verify the API was called with updated payment methods
    await waitFor(() => {
      expect(organizationApi.updateOrganization).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          enabledPaymentMethods: ['stripe'],
        })
      );
    });
  });

  it('should persist payment method selections when updating organization', async () => {
    const updatedOrganization = { ...mockOrganization };
    vi.mocked(organizationApi.updateOrganization).mockResolvedValue(updatedOrganization);
    const user = userEvent.setup();
    
    // Navigate to the edit page
    window.history.pushState({}, '', '/organizations/org-1/edit');
    
    renderWithProviders(<EditOrganizationPage />);

    await waitFor(() => {
      const paymentMethodsHeadings = screen.getAllByText('Payment Methods');
      expect(paymentMethodsHeadings.length).toBeGreaterThan(0);
    });

    // Select Helix-Pay (add new payment method)
    const helixPayCheckbox = screen.getByRole('checkbox', { 
      name: /Pay By Card \(Helix-Pay\)/i 
    });
    await user.click(helixPayCheckbox);
    expect(helixPayCheckbox).toBeChecked();

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /update organisation/i });
    await user.click(submitButton);

    // Verify the API was called with both pay-offline and helix-pay
    await waitFor(() => {
      expect(organizationApi.updateOrganization).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          enabledPaymentMethods: ['pay-offline', 'helix-pay'],
        })
      );
    });
  });

  it('should display current payment methods correctly when organization has multiple payment methods', async () => {
    const orgWithMultiplePaymentMethods = {
      ...mockOrganization,
      paymentMethods: [
        {
          id: 'pm-1',
          organizationId: 'org-1',
          paymentMethodId: '1',
          status: 'active' as const,
          paymentData: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          paymentMethod: {
            id: '1',
            name: 'pay-offline',
            displayName: 'Pay Offline',
            description: 'Payment instructions will be provided in the confirmation email.',
            requiresActivation: false,
            isActive: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        },
        {
          id: 'pm-2',
          organizationId: 'org-1',
          paymentMethodId: '2',
          status: 'inactive' as const,
          paymentData: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          paymentMethod: {
            id: '2',
            name: 'stripe',
            displayName: 'Pay By Card (Stripe)',
            description: 'Accept card payments through Stripe.',
            requiresActivation: true,
            isActive: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        },
      ],
    };

    vi.mocked(organizationApi.getOrganizationById).mockResolvedValue(orgWithMultiplePaymentMethods);
    
    // Navigate to the edit page
    window.history.pushState({}, '', '/organizations/org-1/edit');
    
    renderWithProviders(<EditOrganizationPage />);

    await waitFor(() => {
      const paymentMethodsHeadings = screen.getAllByText('Payment Methods');
      expect(paymentMethodsHeadings.length).toBeGreaterThan(0);
    });

    // Both pay-offline and stripe should be checked
    const payOfflineCheckbox = screen.getByRole('checkbox', { 
      name: /Pay Offline/i 
    });
    expect(payOfflineCheckbox).toBeChecked();

    const stripeCheckbox = screen.getByRole('checkbox', { 
      name: /Pay By Card \(Stripe\)/i 
    });
    expect(stripeCheckbox).toBeChecked();

    // Helix-Pay should not be checked
    const helixPayCheckbox = screen.getByRole('checkbox', { 
      name: /Pay By Card \(Helix-Pay\)/i 
    });
    expect(helixPayCheckbox).not.toBeChecked();
  });
});
