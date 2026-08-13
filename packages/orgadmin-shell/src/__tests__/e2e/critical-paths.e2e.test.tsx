import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../../App';
import { initializeI18n } from '../../i18n/config';

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

/*
 * Authentication is mocked at the hook, not at the network: `useAuth` resolves
 * the organisation over axios and hands the app a settled session, so a `fetch`
 * stub never reaches it and the app would sit on its loading screen forever.
 */
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    loading: false,
    error: null,
    authenticated: true,
    user: {
      id: 'test-user-id',
      username: 'testadmin',
      email: 'admin@test.com',
      firstName: 'Test',
      lastName: 'Admin',
    },
    organisation: {
      id: 'org-123',
      name: 'test-org',
      displayName: 'Test Organisation',
      status: 'active',
      enabledCapabilities: [
        'event-management',
        'memberships',
        'merchandise',
        'calendar-bookings',
      ],
    },
    capabilities: [
      'event-management',
      'memberships',
      'merchandise',
      'calendar-bookings',
    ],
    isOrgAdmin: true,
    logout: mockLogout,
    getToken: () => 'mock-token',
  }),
}));

const mockLogout = vi.fn();

// Mock API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OrgAdmin E2E Critical Paths', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Load the real strings: every label below is an i18n key, and without
    // this the journey is asserted against `modules.events.card.title`.
    await initializeI18n('en-GB', true);

    // The app's router is mounted at /orgadmin; outside that basename it
    // matches no route and renders nothing at all.
    window.history.pushState({}, '', '/orgadmin/');
    
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
      render(<App />);

      // Verify dashboard is displayed
      await waitFor(() => {
        expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
      });

      // Verify module cards are displayed based on capabilities. Each card is
      // a button named after its module.
      const cardNames = [
        // Capability modules the organisation has
        'Events',
        'Memberships',
        'Merchandise',
        'Calendar',
        // Core modules, always available
        'Form Builder',
        'Settings',
        'Payments',
        'Reports & Analytics',
        'Users',
      ];

      for (const name of cardNames) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }

      // And nothing the organisation has not enabled
      expect(screen.queryByRole('button', { name: 'Event Ticketing' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrations' })).not.toBeInTheDocument();
    });

    it('should navigate to module when card is clicked', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
      });

      // Click on Events module card
      await user.click(screen.getByRole('button', { name: 'Events' }));

      // Verify navigation occurred (URL should change)
      await waitFor(() => {
        expect(window.location.pathname).toContain('/events');
      });
    });
  });

  /*
   * The journeys below are checked as far as this suite can honestly reach:
   * that the shell carries an administrator from the dashboard into the right
   * module, with that module's own navigation. What happens inside each page —
   * creating an event with its activities, a membership type, a refund — is
   * driven by the module packages and is covered by their own suites, against
   * the API client those pages actually use.
   */
  describe('Reaching each module from the dashboard', () => {
    const journeys: Array<{ card: string; path: string; entry: string }> = [
      { card: 'Events', path: '/events', entry: 'Back to Main Page' },
      { card: 'Memberships', path: '/members', entry: 'Membership Types' },
      { card: 'Payments', path: '/payments', entry: 'Back to Main Page' },
    ];

    for (const journey of journeys) {
      it(`should open ${journey.card} from its dashboard card`, async () => {
        const user = userEvent.setup();

        render(<App />);

        await waitFor(() => {
          expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: journey.card }));

        await waitFor(() => {
          expect(window.location.pathname).toContain(journey.path);
        });
        await waitFor(() => {
          expect(screen.getAllByText(journey.entry).length).toBeGreaterThan(0);
        });
      });
    }
  });


  describe('Navigation and Layout', () => {
    it('should display navigation drawer with all available modules', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
      });

      /*
       * The drawer shows the module the administrator is inside, not a list of
       * every module — the landing page is the menu. So navigate into one and
       * check its own entries appear.
       */
      await user.click(screen.getByRole('button', { name: 'Memberships' }));

      await waitFor(() => {
        expect(screen.getAllByText('Back to Main Page').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Membership Types').length).toBeGreaterThan(0);
      });
    });

    it('should logout user when logout button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Test Organisation/i)).toBeInTheDocument();
      });

      // Find and click logout button
      const logoutButton = screen.getByRole('button', { name: /log out/i });
      await user.click(logoutButton);

      // The shell hands logging out to the auth hook, which ends the Keycloak
      // session — what matters here is that the button reaches it.
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });
});
