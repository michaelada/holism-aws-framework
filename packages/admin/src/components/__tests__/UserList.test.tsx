import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserList } from '../UserList';
import { User, Tenant } from '../../types/admin.types';

describe('UserList', () => {
  const mockTenants: Tenant[] = [
    {
      id: 'tenant-1',
      keycloakGroupId: 'kc-tenant-1',
      name: 'tenant-one',
      displayName: 'Tenant One',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'tenant-2',
      keycloakGroupId: 'kc-tenant-2',
      name: 'tenant-two',
      displayName: 'Tenant Two',
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
      tenants: ['tenant-1'],
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
      tenants: ['tenant-2'],
      createdAt: '2024-01-02T00:00:00Z',
    },
  ];

  const defaultProps = {
    users: mockUsers,
    tenants: mockTenants,
    loading: false,
    searchTerm: '',
    selectedTenantId: '',
    onSearchChange: vi.fn(),
    onTenantFilterChange: vi.fn(),
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

    const editButtons = screen.getAllByTitle('Edit user');
    fireEvent.click(editButtons[0]);

    expect(onEditClick).toHaveBeenCalledWith(mockUsers[0]);
  });

  it('should call onResetPasswordClick when reset password button is clicked', () => {
    const onResetPasswordClick = vi.fn();
    render(<UserList {...defaultProps} onResetPasswordClick={onResetPasswordClick} />);

    const resetButtons = screen.getAllByTitle('Reset password');
    fireEvent.click(resetButtons[0]);

    expect(onResetPasswordClick).toHaveBeenCalledWith(mockUsers[0]);
  });

  it('should show delete confirmation dialog', async () => {
    render(<UserList {...defaultProps} />);

    const deleteButtons = screen.getAllByTitle('Delete user');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete User')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete the user/)).toBeInTheDocument();
    });
  });

  it('should call onDeleteClick when delete is confirmed', async () => {
    const onDeleteClick = vi.fn();
    render(<UserList {...defaultProps} onDeleteClick={onDeleteClick} />);

    const deleteButtons = screen.getAllByTitle('Delete user');
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

    const deleteButtons = screen.getAllByTitle('Delete user');
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

  it('should display user roles as chips', () => {
    render(<UserList {...defaultProps} />);

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getAllByText('user')).toHaveLength(2);
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

  it('should call onTenantFilterChange when tenant filter changes', () => {
    const onTenantFilterChange = vi.fn();
    render(<UserList {...defaultProps} onTenantFilterChange={onTenantFilterChange} />);

    const tenantFilter = screen.getByLabelText(/filter by tenant/i);
    fireEvent.mouseDown(tenantFilter);

    const options = screen.getAllByText('Tenant One');
    // Click the menu option (not the chip)
    const menuOption = options.find(el => el.closest('[role="option"]'));
    if (menuOption) {
      fireEvent.click(menuOption);
    }

    expect(onTenantFilterChange).toHaveBeenCalledWith('tenant-1');
  });

  it('should display tenant names for users', () => {
    render(<UserList {...defaultProps} />);

    expect(screen.getByText('Tenant One')).toBeInTheDocument();
    expect(screen.getByText('Tenant Two')).toBeInTheDocument();
  });
});
