import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../../App';

/**
 * End-to-End tests for critical user paths in OrgAdmin
 * 
 * These tests verify complete user journeys:
 * - Admin login and dashboard access
 * - Creating event with activities
 * - Creating membership type and viewing members
 * - Payment viewing and refund request
 * 
 * Validates: Requirements 3.5.3
 */

// Mock Keycloak
const mockKeycloak = {
  init: vi.fn().mockResolvedValue(true),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  accountManagement: vi.fn(),
  createLoginUrl: vi.fn(),
  createLogoutUrl: vi.fn(),
  createRegisterUrl: vi.fn(),
  createAccountUrl: vi.fn(),
  isTokenExpired: vi.fn().mockReturnValue(false),
  updateToken: vi.fn().mockResolvedValue(true),
  clearToken: vi.fn(),
  hasRealmRole: vi.fn().mockReturnValue(true),
  hasResourceRole: vi.fn().mockReturnValue(true),
  loadUserProfile: vi.fn().mockResolvedValue({
    id: 'test-user-id',
    username: 'testadmin',
    email: 'admin@test.com',
    firstName: 'Test',
    lastName: 'Admin',
  }),
  authenticated: true,
  token: 'mock-token',
  tokenParsed: {
    sub: 'test-user-id',
    preferred_username: 'testadmin',
    email: 'admin@test.com',
    realm_access: { roles: ['org-admin'] },
  },
  subject: 'test-user-id',
  idToken: 'mock-id-token',
  idTokenParsed: {},
  realmAccess: { roles: ['org-admin'] },
  resourceAccess: {},
  refreshToken: 'mock-refresh-token',
  refreshTokenParsed: {},
  timeSkew: 0,
  responseMode: 'fragment',
  responseType: 'code',
  flow: 'standard',
  onReady: vi.fn(),
  onAuthSuccess: vi.fn(),
  onAuthError: vi.fn(),
  onAuthRefreshSuccess: vi.fn(),
  onAuthRefreshError: vi.fn(),
  onAuthLogout: vi.fn(),
  onTokenExpired: vi.fn(),
};

vi.mock('keycloak-js', () => ({
  default: vi.fn(() => mockKeycloak),
}));

// Mock API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OrgAdmin E2E Critical Paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/organisations/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'org-123',
            name: 'test-org',
            displayName: 'Test Organisation',
            status: 'active',
          }),
        });
      }
      
      if (url.includes('/api/capabilities')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            'event-management',
            'memberships',
            'merchandise',
            'calendar-bookings',
          ]),
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  describe('Admin Login and Dashboard Access', () => {
    it('should authenticate admin user and display dashboard with available modules', async () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Wait for authentication to complete
      await waitFor(() => {
        expect(mockKeycloak.init).toHaveBeenCalled();
      });

      // Verify dashboard is displayed
      await waitFor(() => {
        expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
      });

      // Verify module cards are displayed based on capabilities
      expect(screen.getByText(/Event Management/i)).toBeInTheDocument();
      expect(screen.getByText(/Membership Management/i)).toBeInTheDocument();
      expect(screen.getByText(/Merchandise/i)).toBeInTheDocument();
      expect(screen.getByText(/Calendar Bookings/i)).toBeInTheDocument();

      // Verify core modules are always visible
      expect(screen.getByText(/Forms/i)).toBeInTheDocument();
      expect(screen.getByText(/Settings/i)).toBeInTheDocument();
      expect(screen.getByText(/Payments/i)).toBeInTheDocument();
      expect(screen.getByText(/Reporting/i)).toBeInTheDocument();
      expect(screen.getByText(/Users/i)).toBeInTheDocument();
    });

    it('should navigate to module when card is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
      });

      // Click on Events module card
      const eventsCard = screen.getByText(/Event Management/i).closest('div');
      if (eventsCard) {
        await user.click(eventsCard);
      }

      // Verify navigation occurred (URL should change)
      await waitFor(() => {
        expect(window.location.pathname).toContain('/events');
      });
    });
  });

  describe('Creating Event with Activities', () => {
    it('should complete full event creation workflow', async () => {
      const user = userEvent.setup();
      
      // Mock API responses for event creation
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/application-forms') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'form-123',
              name: 'Event Entry Form',
            }),
          });
        }
        
        if (url.includes('/api/events') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'event-123',
              name: 'Annual Competition',
              status: 'published',
            }),
          });
        }
        
        if (url.includes('/api/events/event-123/activities') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'activity-123',
              name: 'Under 18 Category',
            }),
          });
        }
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Navigate to events
      await waitFor(() => {
        expect(screen.getByText(/Event Management/i)).toBeInTheDocument();
      });
      
      const eventsCard = screen.getByText(/Event Management/i).closest('div');
      if (eventsCard) {
        await user.click(eventsCard);
      }

      // Wait for events page to load
      await waitFor(() => {
        expect(screen.getByText(/Create Event/i)).toBeInTheDocument();
      });

      // Click create event button
      await user.click(screen.getByText(/Create Event/i));

      // Fill in event details
      await user.type(screen.getByLabelText(/Event Name/i), 'Annual Competition');
      await user.type(screen.getByLabelText(/Description/i), 'Annual sailing competition event');
      
      // Add event activity
      await user.click(screen.getByText(/Add Activity/i));
      await user.type(screen.getByLabelText(/Activity Name/i), 'Under 18 Category');
      await user.type(screen.getByLabelText(/Fee/i), '25.00');

      // Submit event
      await user.click(screen.getByText(/Save and Publish/i));

      // Verify success message
      await waitFor(() => {
        expect(screen.getByText(/Event created successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Creating Membership Type and Viewing Members', () => {
    it('should complete full membership type creation and member viewing workflow', async () => {
      const user = userEvent.setup();
      
      // Mock API responses
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/application-forms') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'form-456',
              name: 'Membership Application Form',
            }),
          });
        }
        
        if (url.includes('/api/memberships/types') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'membership-type-123',
              name: 'Adult Membership',
              membershipStatus: 'open',
            }),
          });
        }
        
        if (url.includes('/api/memberships/members')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 'member-1',
                firstName: 'John',
                lastName: 'Doe',
                membershipNumber: 'MEM-2024-001',
                status: 'active',
              },
              {
                id: 'member-2',
                firstName: 'Jane',
                lastName: 'Smith',
                membershipNumber: 'MEM-2024-002',
                status: 'active',
              },
            ]),
          });
        }
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Navigate to memberships
      await waitFor(() => {
        expect(screen.getByText(/Membership Management/i)).toBeInTheDocument();
      });
      
      const membershipsCard = screen.getByText(/Membership Management/i).closest('div');
      if (membershipsCard) {
        await user.click(membershipsCard);
      }

      // Wait for memberships page
      await waitFor(() => {
        expect(screen.getByText(/Create Membership Type/i)).toBeInTheDocument();
      });

      // Click create membership type
      await user.click(screen.getByText(/Create Membership Type/i));

      // Fill in membership type details
      await user.type(screen.getByLabelText(/Name/i), 'Adult Membership');
      await user.type(screen.getByLabelText(/Description/i), 'Annual membership for adults');

      // Submit membership type
      await user.click(screen.getByText(/Save and Publish/i));

      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/Membership type created successfully/i)).toBeInTheDocument();
      });

      // Navigate to members database
      await user.click(screen.getByText(/Members Database/i));

      // Verify members are displayed
      await waitFor(() => {
        expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
        expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
        expect(screen.getByText(/MEM-2024-001/i)).toBeInTheDocument();
        expect(screen.getByText(/MEM-2024-002/i)).toBeInTheDocument();
      });
    });
  });

  describe('Payment Viewing and Refund Request', () => {
    it('should view payment details and request refund', async () => {
      const user = userEvent.setup();
      
      // Mock API responses
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/payments') && !url.includes('/refunds')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 'payment-1',
                amount: 50.00,
                currency: 'EUR',
                paymentStatus: 'paid',
                paymentMethod: 'card',
                paymentType: 'event_entry',
                createdAt: '2024-01-15T10:00:00Z',
              },
              {
                id: 'payment-2',
                amount: 75.00,
                currency: 'EUR',
                paymentStatus: 'paid',
                paymentMethod: 'card',
                paymentType: 'membership',
                createdAt: '2024-01-16T11:00:00Z',
              },
            ]),
          });
        }
        
        if (url.includes('/api/payments/payment-1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'payment-1',
              amount: 50.00,
              currency: 'EUR',
              paymentStatus: 'paid',
              paymentMethod: 'card',
              paymentType: 'event_entry',
              metadata: {
                eventName: 'Annual Competition',
              },
            }),
          });
        }
        
        if (url.includes('/api/payments/refunds') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'refund-1',
              paymentId: 'payment-1',
              amount: 50.00,
              status: 'pending',
            }),
          });
        }
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Navigate to payments
      await waitFor(() => {
        expect(screen.getByText(/Payments/i)).toBeInTheDocument();
      });
      
      const paymentsCard = screen.getByText(/Payments/i).closest('div');
      if (paymentsCard) {
        await user.click(paymentsCard);
      }

      // Wait for payments list
      await waitFor(() => {
        expect(screen.getByText(/€50.00/i)).toBeInTheDocument();
        expect(screen.getByText(/€75.00/i)).toBeInTheDocument();
      });

      // Click on first payment to view details
      const firstPayment = screen.getByText(/€50.00/i).closest('tr');
      if (firstPayment) {
        const viewButton = within(firstPayment).getByRole('button', { name: /view/i });
        await user.click(viewButton);
      }

      // Verify payment details are displayed
      await waitFor(() => {
        expect(screen.getByText(/Payment Details/i)).toBeInTheDocument();
        expect(screen.getByText(/Annual Competition/i)).toBeInTheDocument();
      });

      // Request refund
      await user.click(screen.getByText(/Request Refund/i));

      // Confirm refund
      await user.type(screen.getByLabelText(/Reason/i), 'Event cancelled');
      await user.click(screen.getByText(/Confirm Refund/i));

      // Verify success message
      await waitFor(() => {
        expect(screen.getByText(/Refund requested successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and Layout', () => {
    it('should display navigation drawer with all available modules', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
      });

      // Open navigation drawer (if not already open)
      const menuButton = screen.queryByRole('button', { name: /menu/i });
      if (menuButton) {
        await user.click(menuButton);
      }

      // Verify navigation items
      await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
        expect(screen.getByText(/Events/i)).toBeInTheDocument();
        expect(screen.getByText(/Members/i)).toBeInTheDocument();
        expect(screen.getByText(/Forms/i)).toBeInTheDocument();
        expect(screen.getByText(/Settings/i)).toBeInTheDocument();
      });
    });

    it('should logout user when logout button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
      });

      // Find and click logout button
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      // Verify Keycloak logout was called
      await waitFor(() => {
        expect(mockKeycloak.logout).toHaveBeenCalled();
      });
    });
  });
});
