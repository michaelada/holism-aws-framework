/**
 * Unit tests for OrgAdminUsersListPage component
 * Tests admin user list rendering, filtering, and search functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OrgAdminUsersListPage from '../OrgAdminUsersListPage';
import * as useApiModule from '../../../hooks/useApi';
import { renderWithProviders } from '../../../test/renderWithProviders';

// The pages read onboarding, page-help and translations from the shell package.
// Mocking the module is simpler than standing up its providers, and the stable
// references matter: these hooks feed useEffect dependencies, and a fresh object
// per render re-triggers the effect forever (CLAUDE.md §3.4).
const shell = vi.hoisted(() => {
  const checkModuleVisit = vi.fn();
  const setCurrentModule = vi.fn();
  return {
    checkModuleVisit,
    setCurrentModule,
    onboarding: { checkModuleVisit, setCurrentModule },
  };
});

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useOnboarding: () => shell.onboarding,
  usePageHelp: () => undefined,
  // No i18next instance in tests, so t() returns the key — assertions below
  // match keys rather than English.
  useTranslation: () => ({ t: (key: string) => key }),
  useLocale: () => ({ locale: 'en-GB' }),
  formatDate: (value: string) => String(value),
  formatCurrency: (value: number) => String(value),
}));


// Mock the useApi hook
vi.mock('../../../hooks/useApi');

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAdminUsers = [
  {
    id: '1',
    email: 'admin1@example.com',
    firstName: 'John',
    lastName: 'Doe',
    roles: ['Admin', 'Event Manager'],
    status: 'active' as const,
    lastLogin: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-01T10:00:00Z',
  },
  {
    id: '2',
    email: 'admin2@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    roles: ['Admin'],
    status: 'active' as const,
    lastLogin: '2024-01-20T10:00:00Z',
    createdAt: '2024-01-05T10:00:00Z',
  },
  {
    id: '3',
    email: 'admin3@example.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    roles: [],
    status: 'inactive' as const,
    createdAt: '2024-01-10T10:00:00Z',
  },
];

describe('OrgAdminUsersListPage', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Setup default mock implementation
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
  });

  const renderComponent = () => {
    return renderWithProviders(<OrgAdminUsersListPage />);
  };

  describe('User List Rendering', () => {
    it('should render the page title and invite button', () => {
      mockExecute.mockResolvedValue({ data: [] });
      renderComponent();

      expect(screen.getByText('users.title')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /users.admins.invite/i })).toBeInTheDocument();
    });

    it('should load and display admin users on mount', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/users/admins/org-1',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching users', () => {
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();

      expect(screen.getByText('users.loading.admins')).toBeInTheDocument();
    });

    it('should display empty state when no users exist', async () => {
      mockExecute.mockResolvedValue({ data: [] });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no admin users yet/i)).toBeInTheDocument();
      });
    });

    it('should display user emails', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('admin1@example.com')).toBeInTheDocument();
        expect(screen.getByText('admin2@example.com')).toBeInTheDocument();
        expect(screen.getByText('admin3@example.com')).toBeInTheDocument();
      });
    });

    it('should display user roles as chips', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        const adminChips = screen.getAllByText('Admin');
        expect(adminChips.length).toBeGreaterThan(0);
        expect(screen.getByText('Event Manager')).toBeInTheDocument();
      });
    });

    it('should display "No roles assigned" for users without roles', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('users.noRoles')).toBeInTheDocument();
      });
    });

    it('should display user status with correct colors', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        const activeChips = screen.getAllByText('active');
        const inactiveChips = screen.getAllByText('inactive');
        
        expect(activeChips).toHaveLength(2);
        expect(inactiveChips).toHaveLength(1);
      });
    });

    it('should format last login dates correctly', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
        expect(screen.getByText('20 Jan 2024')).toBeInTheDocument();
      });
    });

    it('should display "Never" for users who have not logged in', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Never')).toBeInTheDocument();
      });
    });

    it('should display tabs for Admin Users and Account Users', () => {
      mockExecute.mockResolvedValue({ data: [] });
      renderComponent();

      expect(screen.getByRole('tab', { name: /users.tabs.admins/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /users.tabs.accounts/i })).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter users by email', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('users.search');
      fireEvent.change(searchInput, { target: { value: 'admin1' } });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('should filter users by first name', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('users.search');
      fireEvent.change(searchInput, { target: { value: 'Jane' } });

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('should filter users by last name', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('users.search');
      fireEvent.change(searchInput, { target: { value: 'Johnson' } });

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('should be case-insensitive when searching', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('users.search');
      fireEvent.change(searchInput, { target: { value: 'JOHN' } });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should show "no users match" message when search returns no results', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('users.search');
      fireEvent.change(searchInput, { target: { value: 'NonexistentUser' } });

      await waitFor(() => {
        expect(screen.getByText(/no admin users match your search/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to the invite page when the invite button is clicked', async () => {
      mockExecute.mockResolvedValue({ data: [] });
      renderComponent();

      const inviteButton = screen.getByRole('button', { name: /users.admins.invite/i });
      fireEvent.click(inviteButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/users/admins/invite');
      });
    });

    it('should navigate to user details when edit button is clicked', async () => {
      mockExecute.mockResolvedValue({ data: mockAdminUsers });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('common.actions.edit');
      fireEvent.click(editButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/users/admins/1');
    });

    it('should navigate to account users tab when clicked', async () => {
      mockExecute.mockResolvedValue({ data: [] });
      renderComponent();

      const accountUsersTab = screen.getByRole('tab', { name: /users.tabs.accounts/i });
      fireEvent.click(accountUsersTab);

      expect(mockNavigate).toHaveBeenCalledWith('/users/accounts');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValue(new Error('API Error'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no admin users yet/i)).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should set empty array when API returns null', async () => {
      mockExecute.mockResolvedValue(null);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no admin users yet/i)).toBeInTheDocument();
      });
    });
  });
});
