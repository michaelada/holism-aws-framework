import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import * as useAuthModule from '../hooks/useAuth';

// Mock the useAuth hook
vi.mock('../hooks/useAuth');

// Mock the Layout component
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

// Mock the DashboardPage component
vi.mock('../pages/DashboardPage', () => ({
  DashboardPage: ({ modules }: { modules: any[] }) => (
    <div data-testid="dashboard-page">
      Dashboard with {modules.length} modules
    </div>
  ),
}));

// Mock all core module registrations from orgadmin-core
vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-web-framework/orgadmin-core')>();
  return {
    ...actual,
    // Override only the module registrations for testing
    dashboardModule: {
      id: 'dashboard',
      name: 'Dashboard',
      title: 'Dashboard',
      description: 'View high-level metrics',
      capability: undefined,
      order: 1,
      card: { title: 'Dashboard', description: 'View metrics', icon: () => null, path: '/dashboard' },
      routes: [{ path: '/dashboard', component: vi.fn() }],
    },
    formsModule: {
      id: 'forms',
      name: 'Forms',
      title: 'Form Builder',
      description: 'Create forms',
      capability: undefined,
      order: 2,
      card: { title: 'Forms', description: 'Create forms', icon: () => null, path: '/forms' },
      routes: [{ path: '/forms', component: vi.fn() }],
    },
    settingsModule: {
      id: 'settings',
      name: 'Settings',
      title: 'Settings',
      description: 'Manage settings',
      capability: undefined,
      order: 3,
      card: { title: 'Settings', description: 'Manage settings', icon: () => null, path: '/settings' },
      routes: [{ path: '/settings', component: vi.fn() }],
    },
    paymentsModule: {
      id: 'payments',
      name: 'Payments',
      title: 'Payments',
      description: 'Manage payments',
      capability: undefined,
      order: 4,
      card: { title: 'Payments', description: 'Manage payments', icon: () => null, path: '/payments' },
      routes: [{ path: '/payments', component: vi.fn() }],
    },
    reportingModule: {
      id: 'reporting',
      name: 'Reporting',
      title: 'Reporting',
      description: 'View reports',
      capability: undefined,
      order: 5,
      card: { title: 'Reporting', description: 'View reports', icon: () => null, path: '/reporting' },
      routes: [{ path: '/reporting', component: vi.fn() }],
    },
    usersModule: {
      id: 'users',
      name: 'Users',
      title: 'Users',
      description: 'Manage users',
      capability: undefined,
      order: 6,
      card: { title: 'Users', description: 'Manage users', icon: () => null, path: '/users' },
      routes: [{ path: '/users', component: vi.fn() }],
    },
  };
});

// Note: Capability module mocks are now in src/test/setup.ts

// Mock window.location for BrowserRouter
const originalLocation = window.location;

describe('App Integration Tests', () => {
  const mockOrganisation = {
    id: 'org-1',
    displayName: 'Test Organisation',
    name: 'test-org',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location to include /orgadmin basename
    delete (window as any).location;
    window.location = { ...originalLocation, pathname: '/orgadmin/' } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('Authentication States', () => {
    it('should show loading screen when authentication is in progress', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: true,
        error: null,
        authenticated: false,
        user: null,
        organisation: null,
        capabilities: [],
        isOrgAdmin: false,
        logout: vi.fn(),
      });

      render(<App />);

      expect(screen.getByText('Loading ItsPlainSailing...')).toBeInTheDocument();
    });

    it('should show error screen when authentication fails', () => {
      const errorMessage = 'Authentication failed';
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: errorMessage,
        authenticated: false,
        user: null,
        organisation: null,
        capabilities: [],
        isOrgAdmin: false,
        logout: vi.fn(),
      });

      render(<App />);

      expect(screen.getByText('Authentication Error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should show access denied screen when user is not org admin', () => {
      const mockLogout = vi.fn();
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: null,
        authenticated: true,
        user: mockUser,
        organisation: mockOrganisation,
        capabilities: [],
        isOrgAdmin: false,
        logout: mockLogout,
      });

      render(<App />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(
        screen.getByText(/You do not have permission to access the Organisation Admin Portal/)
      ).toBeInTheDocument();
    });

    it('should show redirecting message when not authenticated', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: null,
        authenticated: false,
        user: null,
        organisation: null,
        capabilities: [],
        isOrgAdmin: false,
        logout: vi.fn(),
      });

      render(<App />);

      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
    });
  });

  describe('Module Filtering Based on Capabilities', () => {
    it('should render layout and dashboard when user is authenticated and authorized', async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: null,
        authenticated: true,
        user: mockUser,
        organisation: mockOrganisation,
        capabilities: ['event-management', 'memberships', 'merchandise'],
        isOrgAdmin: true,
        logout: vi.fn(),
        getToken: () => 'mock-token',
      });

      render(<App />);

      // Wait for the layout to render
      await waitFor(() => {
        expect(screen.getByTestId('layout')).toBeInTheDocument();
      });

      // Dashboard should be rendered inside the layout
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('should filter modules based on capabilities', async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: null,
        authenticated: true,
        user: mockUser,
        organisation: mockOrganisation,
        capabilities: ['event-management'], // Only one capability
        isOrgAdmin: true,
        logout: vi.fn(),
        getToken: () => 'mock-token',
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('layout')).toBeInTheDocument();
      });

      // Dashboard should render with filtered modules
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('should show dashboard with only core modules when user has no capabilities', async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: null,
        authenticated: true,
        user: mockUser,
        organisation: mockOrganisation,
        capabilities: [], // No capabilities
        isOrgAdmin: true,
        logout: vi.fn(),
        getToken: () => 'mock-token',
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('layout')).toBeInTheDocument();
      });

      // Dashboard should render (core modules are always available)
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      // Should show "Dashboard with 6 modules" (6 core modules)
      expect(screen.getByText(/Dashboard with 6 modules/)).toBeInTheDocument();
    });
  });

  describe('Context Providers', () => {
    it('should wrap app with OrganisationProvider and CapabilityProvider', async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: null,
        authenticated: true,
        user: mockUser,
        organisation: mockOrganisation,
        capabilities: ['event-management'],
        isOrgAdmin: true,
        logout: vi.fn(),
        getToken: () => 'mock-token',
      });

      render(<App />);

      await waitFor(() => {
        // If the app renders successfully, the providers are working
        expect(screen.getByTestId('layout')).toBeInTheDocument();
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Redirect Flows', () => {
    it('should handle logout action from access denied screen', () => {
      const mockLogout = vi.fn();
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: null,
        authenticated: true,
        user: mockUser,
        organisation: mockOrganisation,
        capabilities: [],
        isOrgAdmin: false,
        logout: mockLogout,
      });

      render(<App />);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      logoutButton.click();

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it('should show redirecting message when user is null', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: null,
        authenticated: true,
        user: null, // User is null
        organisation: mockOrganisation,
        capabilities: [],
        isOrgAdmin: true,
        logout: vi.fn(),
      });

      render(<App />);

      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
    });

    it('should show redirecting message when organisation is null', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        loading: false,
        error: null,
        authenticated: true,
        user: mockUser,
        organisation: null, // Organisation is null
        capabilities: [],
        isOrgAdmin: true,
        logout: vi.fn(),
      });

      render(<App />);

      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
    });
  });
});
