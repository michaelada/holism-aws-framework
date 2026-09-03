/**
 * Unit tests for UserDetailsPage component
 * Tests user details display, role assignment for admin users, and user actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserDetailsPage from '../UserDetailsPage';
import * as useApiModule from '../../../hooks/useApi';
import { TEST_ORGANISATION } from '../../../test/renderWithProviders';
import { OrganisationProvider } from '../../../context/OrganisationContext';

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

vi.mock('@itsplainsailing/orgadmin-shell', () => ({
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

const mockAdminUser = {
  id: '1',
  email: 'admin@example.com',
  firstName: 'John',
  lastName: 'Doe',
  roleIds: ['1', '2'],
  status: 'active' as const,
  lastLogin: '2024-01-15T10:00:00Z',
  createdAt: '2024-01-01T10:00:00Z',
};

const mockAccountUser = {
  id: '2',
  email: 'user@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  phone: '+44 1234 567890',
  status: 'active' as const,
  lastLogin: '2024-01-20T10:00:00Z',
  createdAt: '2024-01-05T10:00:00Z',
};

const mockAvailableRoles = [
  { id: '1', name: 'Admin' },
  { id: '2', name: 'Event Manager' },
  { id: '3', name: 'Finance Manager' },
  { id: '4', name: 'Content Editor' },
];

describe('UserDetailsPage', () => {
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

  const renderComponent = (type: string, id: string) => {
    const initialRoute = `/orgadmin/users/${type}/${id}`;
    
    return render(
      <OrganisationProvider organisation={TEST_ORGANISATION}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/orgadmin/users/:type/:id" element={<UserDetailsPage />} />
        </Routes>
      </MemoryRouter>
      </OrganisationProvider>
    );
  };

  describe('Admin User Details', () => {
    it('should load and display admin user details', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] }) // User details
        .mockResolvedValueOnce(mockAvailableRoles); // Available roles

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/users/admins/org-1',
        });
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
        expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument();
      });
    });

    it('should display role assignment section for admin users', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByText('users.details.roleAssignment')).toBeInTheDocument();
      });
    });

    it('should display current roles as chips', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        const adminChips = screen.getAllByText('Admin');
        expect(adminChips.length).toBeGreaterThan(0);
        expect(screen.getByText('Event Manager')).toBeInTheDocument();
      });
    });

    it('should load available roles for selection', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/users/roles/org-1',
        });
      });
    });

    it('should allow changing role assignments', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      // Wait for both user and roles to load
      await waitFor(() => {
        expect(screen.getByText('users.details.roleAssignment')).toBeInTheDocument();
      });

      // Wait for the Select to render with roles
      const roleSelect = await screen.findByRole('combobox');
      fireEvent.mouseDown(roleSelect);

      // Select a new role
      const financeOption = await screen.findByRole('option', { name: /finance manager/i });
      fireEvent.click(financeOption);
    });

    it('should save role changes when save button is clicked', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles)
        .mockResolvedValueOnce({}); // Save response

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByText('users.details.roleAssignment')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /users.details.saveChanges/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/users/admins/1/roles',
          data: { roleIds: ['1', '2'] },
        });
      });
    });

    it('should disable name fields for admin users', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        const firstNameInput = screen.getByDisplayValue('John');
        const lastNameInput = screen.getByDisplayValue('Doe');
        
        expect(firstNameInput).toBeDisabled();
        expect(lastNameInput).toBeDisabled();
      });
    });
  });

  describe('Account User Details', () => {
    it('should load and display account user details', async () => {
      mockExecute.mockResolvedValueOnce({ data: [mockAccountUser] });

      renderComponent('accounts', '2');

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/users/accounts/org-1',
        });
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Smith')).toBeInTheDocument();
        expect(screen.getByDisplayValue('user@example.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('+44 1234 567890')).toBeInTheDocument();
      });
    });

    it('should not display role assignment section for account users', async () => {
      mockExecute.mockResolvedValueOnce({ data: [mockAccountUser] });

      renderComponent('accounts', '2');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
      });

      expect(screen.queryByText('users.details.roleAssignment')).not.toBeInTheDocument();
    });

    it('should allow editing name and phone for account users', async () => {
      mockExecute.mockResolvedValueOnce({ data: [mockAccountUser] });

      renderComponent('accounts', '2');

      await waitFor(() => {
        const firstNameInput = screen.getByDisplayValue('Jane');
        const lastNameInput = screen.getByDisplayValue('Smith');
        const phoneInput = screen.getByDisplayValue('+44 1234 567890');
        
        expect(firstNameInput).not.toBeDisabled();
        expect(lastNameInput).not.toBeDisabled();
        expect(phoneInput).not.toBeDisabled();
      });
    });

    it('should save account user changes when save button is clicked', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAccountUser] })
        .mockResolvedValueOnce({}); // Save response

      renderComponent('accounts', '2');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /users.details.saveChanges/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'PUT',
          url: '/api/orgadmin/users/accounts/2',
          data: {
            firstName: 'Jane',
            lastName: 'Smith',
            phone: '+44 1234 567890',
          },
        });
      });
    });
  });

  describe('User Status and Actions', () => {
    it('should display user status', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
      });
    });

    it('should display last login date', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByText(/15 Jan 2024/)).toBeInTheDocument();
      });
    });

    it('should display created date', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByText(/01 Jan 2024/)).toBeInTheDocument();
      });
    });

    it('should open deactivate dialog when deactivate button is clicked', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /users.details.deactivate/i })).toBeInTheDocument();
      });

      const deactivateButton = screen.getByRole('button', { name: /users.details.deactivate/i });
      fireEvent.click(deactivateButton);

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to deactivate/i)).toBeInTheDocument();
      });
    });

    it('should open delete dialog when delete button is clicked', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /common.actions.delete/i })).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /common.actions.delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to permanently delete/i)).toBeInTheDocument();
      });
    });

    it('should disable deactivate button for inactive users', async () => {
      const inactiveUser = { ...mockAdminUser, status: 'inactive' as const };
      mockExecute
        .mockResolvedValueOnce({ data: [inactiveUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        const deactivateButton = screen.getByRole('button', { name: /users.details.deactivate/i });
        expect(deactivateButton).toBeDisabled();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to admin users list when back button is clicked', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles);

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /common.actions.back/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /common.actions.back/i });
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/users/admins');
    });

    it('should navigate back to account users list for account users', async () => {
      mockExecute.mockResolvedValueOnce({ data: [mockAccountUser] });

      renderComponent('accounts', '2');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /common.actions.back/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /common.actions.back/i });
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/users/accounts');
    });
  });

  describe('Error Handling', () => {
    it('should display loading state while fetching user', () => {
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderComponent('admins', '1');

      expect(screen.getByText('users.loading.details')).toBeInTheDocument();
    });

    it('should display error message when user not found', async () => {
      mockExecute.mockResolvedValueOnce(null);

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByText('users.details.notFound')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('API Error'));

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByText('users.details.notFound')).toBeInTheDocument();
      });
    });

    it('should display error alert when save fails', async () => {
      mockExecute
        .mockResolvedValueOnce({ data: [mockAdminUser] })
        .mockResolvedValueOnce(mockAvailableRoles)
        .mockRejectedValueOnce(new Error('Save failed'));

      renderComponent('admins', '1');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /users.details.saveChanges/i })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /users.details.saveChanges/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save user details/i)).toBeInTheDocument();
      });
    });
  });
});
