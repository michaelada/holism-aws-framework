import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserList } from '../UserList';
import { User } from '../../types/admin.types';
import type { Organization } from '../../types/organization.types';

describe('UserList', () => {
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
    {
      id: 'organisation-2',
      organizationTypeId: 'organisation-type-1',
      keycloakGroupId: 'kc-organisation-2',
      name: 'organisation-two',
      displayName: 'Organisation Two',
      urlCode: 'organisation-two',
      currency: 'GBP',
      language: 'en-GB',
      enabledCapabilities: [],
      settings: {},
      status: 'active',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

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
      roles: ['admin', 'user'],
      classifications: ['super-admin', 'org-admin'] as const,
      organizations: ['organisation-1'],
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'user-2',
      keycloakUserId: 'kc-user-2',
      username: 'jane.smith',
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      enabled: false,
      emailVerified: false,
      roles: ['user'],
      classifications: ['account'] as const,
      organizations: ['organisation-2'],
      createdAt: '2024-01-02T00:00:00Z',
    },
  ];

  const defaultProps = {
    users: mockUsers,
    organizations: mockOrganisations,
    loading: false,
    searchTerm: '',
    selectedOrganizationId: '',
    onSearchChange: vi.fn(),
    onOrganizationFilterChange: vi.fn(),
    onCreateClick: vi.fn(),
    onEditClick: vi.fn(),
    onDeleteClick: vi.fn(),
    onResetPasswordClick: vi.fn(),
  };

  it('should render user list with data', () => {
    render(<UserList {...defaultProps} />);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('john.doe')).toBeInTheDocument();
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane.smith')).toBeInTheDocument();
    expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(<UserList {...defaultProps} loading={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display empty state when no users', () => {
    render(<UserList {...defaultProps} users={[]} />);

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('should call onCreateClick when create button is clicked', () => {
    const onCreateClick = vi.fn();
    render(<UserList {...defaultProps} onCreateClick={onCreateClick} />);

    const createButton = screen.getByRole('button', { name: /create user/i });
    fireEvent.click(createButton);

    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });

  it('should call onEditClick when edit button is clicked', () => {
    const onEditClick = vi.fn();
    render(<UserList {...defaultProps} onEditClick={onEditClick} />);

    const editButtons = screen.getAllByRole('button', { name: /^Edit / });
    fireEvent.click(editButtons[0]);

    expect(onEditClick).toHaveBeenCalledWith(mockUsers[0]);
  });

  it('should call onResetPasswordClick when reset password button is clicked', () => {
    const onResetPasswordClick = vi.fn();
    render(<UserList {...defaultProps} onResetPasswordClick={onResetPasswordClick} />);

    const resetButtons = screen.getAllByRole('button', { name: /^Reset password for / });
    fireEvent.click(resetButtons[0]);

    expect(onResetPasswordClick).toHaveBeenCalledWith(mockUsers[0]);
  });

  it('should show delete confirmation dialog', async () => {
    render(<UserList {...defaultProps} />);

    const deleteButtons = screen.getAllByRole('button', { name: /^Delete / });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete User')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete the user/)).toBeInTheDocument();
    });
  });

  it('should call onDeleteClick when delete is confirmed', async () => {
    const onDeleteClick = vi.fn();
    render(<UserList {...defaultProps} onDeleteClick={onDeleteClick} />);

    const deleteButtons = screen.getAllByRole('button', { name: /^Delete / });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete User')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    expect(onDeleteClick).toHaveBeenCalledWith('user-1');
  });

  it('should close dialog when cancel is clicked', async () => {
    render(<UserList {...defaultProps} />);

    const deleteButtons = screen.getAllByRole('button', { name: /^Delete / });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete User')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Delete User')).not.toBeInTheDocument();
    });
  });

  it('should display user classifications as chips rather than raw roles', () => {
    render(<UserList {...defaultProps} />);

    expect(screen.getByText('Account')).toBeInTheDocument();

    // The underlying realm roles stay out of the table — they are the detail
    // the categories exist to summarise.
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
    expect(screen.queryByText('user')).not.toBeInTheDocument();
  });

  it('should show every classification a user holds', () => {
    render(<UserList {...defaultProps} />);

    // The first fixture is both a platform operator and an organisation admin.
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('Org-admin')).toBeInTheDocument();
  });

  it('should show a dash when a user has no classification', () => {
    const unclassified = [{ ...mockUsers[0], classifications: [] }];
    render(<UserList {...defaultProps} users={unclassified} />);

    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument();
  });

  it('should display user status', () => {
    render(<UserList {...defaultProps} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('should call onSearchChange when search input changes', () => {
    const onSearchChange = vi.fn();
    render(<UserList {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByPlaceholderText(/search by username or email/i);
    fireEvent.change(searchInput, { target: { value: 'john' } });

    expect(onSearchChange).toHaveBeenCalledWith('john');
  });

  it('should call onOrganizationFilterChange when organisation filter changes', () => {
    const onOrganizationFilterChange = vi.fn();
    render(<UserList {...defaultProps} onOrganizationFilterChange={onOrganizationFilterChange} />);

    const organisationFilter = screen.getByLabelText(/filter by organisation/i);
    fireEvent.mouseDown(organisationFilter);

    const options = screen.getAllByText('Organisation One');
    // Click the menu option (not the chip)
    const menuOption = options.find(el => el.closest('[role="option"]'));
    if (menuOption) {
      fireEvent.click(menuOption);
    }

    expect(onOrganizationFilterChange).toHaveBeenCalledWith('organisation-1');
  });

  it('should display organisation names for users', () => {
    render(<UserList {...defaultProps} />);

    expect(screen.getByText('Organisation One')).toBeInTheDocument();
    expect(screen.getByText('Organisation Two')).toBeInTheDocument();
  });
});
