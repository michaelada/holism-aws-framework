import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UsersPage } from '../UsersPage';
import { NotificationProvider } from '../../context';
import { User, Role } from '../../types/admin.types';
import type { Organization } from '../../types/organization.types';

// Mock the API service
const mockApi = {
  getUsers: vi.fn(),
  getRoles: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  resetPassword: vi.fn(),
} as any;

const mockGetOrganizations = vi.hoisted(() => vi.fn());

vi.mock('../../services/organizationApi', () => ({
  getOrganizations: mockGetOrganizations,
}));

vi.mock('../../context', async () => {
  const actual = await vi.importActual('../../context');
  return {
    ...actual,
    useApi: () => ({ api: mockApi }),
  };
});

describe('UsersPage', () => {
  const mockUsers: User[] = [
    {
      id: 'user-1',
      keycloakUserId: 'kc-user-1',
      username: 'john.doe',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      enabled: true,
      emailVerified: true,
      roles: ['admin'],
      classifications: ['super-admin'] as const,
      organizations: ['organisation-1'],
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockOrganisations: Organization[] = [
    {
      id: 'organisation-1',
      organizationTypeId: 'organisation-type-1',
      keycloakGroupId: 'kc-organisation-1',
      name: 'organisation-one',
      displayName: 'Organisation One',
      urlCode: 'organisation-one',
      currency: 'GBP',
      language: 'en-GB',
      enabledCapabilities: [],
      settings: {},
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockRoles: Role[] = [
    {
      id: 'role-1',
      name: 'admin',
      displayName: 'Admin',
      composite: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getUsers.mockResolvedValue(mockUsers);
    mockGetOrganizations.mockResolvedValue(mockOrganisations);
    mockApi.getRoles.mockResolvedValue(mockRoles);
    mockApi.createUser.mockResolvedValue(mockUsers[0]);
    mockApi.updateUser.mockResolvedValue(mockUsers[0]);
    mockApi.deleteUser.mockResolvedValue(undefined);
    mockApi.resetPassword.mockResolvedValue(undefined);
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <NotificationProvider>
        {component}
      </NotificationProvider>
    );
  };

  it('should load and display users on mount', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(mockApi.getUsers).toHaveBeenCalled();
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });
  });

  it('should load organizations and roles on mount', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(mockGetOrganizations).toHaveBeenCalled();
      expect(mockApi.getRoles).toHaveBeenCalled();
    });
  });

  it('should show create form when create button is clicked', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });
  });

  it('should show edit form when edit button is clicked', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /^Edit / });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });
  });

  it('should create user and refresh list', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'jane.doe' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
      target: { value: 'jane.doe@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    });
    
    // Use more specific selector for password field (type="password")
    const passwordInputs = screen.getAllByLabelText(/password/i);
    const passwordField = passwordInputs.find(input => (input as HTMLInputElement).type === 'password');
    if (passwordField) {
      fireEvent.change(passwordField, {
        target: { value: 'password123' },
      });
    }

    const submitButton = screen.getByRole('button', { name: /^create$/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApi.createUser).toHaveBeenCalled();
    });
  });

  it('should update user and refresh list', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /^Edit / });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
      target: { value: 'newemail@example.com' },
    });

    const submitButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApi.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          email: 'newemail@example.com',
        })
      );
    });
  });

  it('should delete user and refresh list', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /^Delete / });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete User')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockApi.deleteUser).toHaveBeenCalledWith('user-1');
    });
  });

  it('should show password reset dialog when reset button is clicked', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: /^Reset password for / });
    fireEvent.click(resetButton);

    await waitFor(() => {
      // Use heading role to specifically target the dialog title
      expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    });
  });

  it('should reset password', async () => {
    // TODO: Fix dialog rendering issue in test environment
    // The dialog opens correctly in actual usage but has timing issues in tests
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: /^Reset password for / });
    fireEvent.click(resetButton);

    /*
     * `/new password/i`, unanchored. MUI renders a required field's label as
     * "New Password *", so an anchored `/^new password$/i` matched nothing and
     * the test was skipped as a "dialog rendering issue" — the dialog was there
     * all along.
     */
    const newPasswordField = await screen.findByLabelText(/new password/i, {}, { timeout: 3000 });
    expect(newPasswordField).toBeInTheDocument();

    fireEvent.change(newPasswordField, {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'newpassword123' },
    });

    // Find the button specifically within the dialog actions
    const submitButtons = screen.getAllByRole('button', { name: /reset password/i });
    const submitButton = submitButtons.find(btn => btn.getAttribute('type') === 'submit');
    if (submitButton) {
      fireEvent.click(submitButton);
    }

    await waitFor(() => {
      expect(mockApi.resetPassword).toHaveBeenCalledWith('user-1', {
        password: 'newpassword123',
        temporary: true,
      });
    });
  });

  it('should filter users by search term', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by username or email/i);
    fireEvent.change(searchInput, { target: { value: 'john' } });

    await waitFor(() => {
      expect(mockApi.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'john',
        })
      );
    });
  });

  it('should filter users by organisation', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const organisationFilter = screen.getByLabelText(/filter by organisation/i);
    fireEvent.mouseDown(organisationFilter);

    const options = screen.getAllByText('Organisation One');
    const menuOption = options.find(el => el.closest('[role="option"]'));
    if (menuOption) {
      fireEvent.click(menuOption);
    }

    await waitFor(() => {
      expect(mockApi.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'organisation-1',
        })
      );
    });
  });

  it('should handle API errors', async () => {
    mockApi.getUsers.mockRejectedValue(new Error('API Error'));

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(mockApi.getUsers).toHaveBeenCalled();
    });
  });

  it('should return to list view when cancel is clicked', async () => {
    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
      // Check that the form heading is gone instead of the button
      expect(screen.queryByRole('heading', { name: /create user/i })).not.toBeInTheDocument();
    });
  });
});
