import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoleList } from '../RoleList';
import { Role } from '../../types/admin.types';

describe('RoleList', () => {
  const mockRoles: Role[] = [
    {
      id: '1',
      keycloakRoleId: 'kc-role-1',
      name: 'admin',
      displayName: 'Administrator',
      description: 'Full system access',
      permissions: ['read', 'write', 'delete'],
      composite: false,
    },
    {
      id: '2',
      keycloakRoleId: 'kc-role-2',
      name: 'user',
      displayName: 'User',
      description: 'Basic user access',
      permissions: ['read'],
      composite: false,
    },
  ];

  const defaultProps = {
    roles: mockRoles,
    loading: false,
    onCreateClick: vi.fn(),
    onDeleteClick: vi.fn(),
  };

  it('should render role list with data', () => {
    render(<RoleList {...defaultProps} />);

    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('Full system access')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Basic user access')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(<RoleList {...defaultProps} loading={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display empty state when no roles', () => {
    render(<RoleList {...defaultProps} roles={[]} />);

    expect(screen.getByText('No roles found')).toBeInTheDocument();
  });

  it('should call onCreateClick when create button is clicked', () => {
    const onCreateClick = vi.fn();
    render(<RoleList {...defaultProps} onCreateClick={onCreateClick} />);

    const createButton = screen.getByRole('button', { name: /create role/i });
    fireEvent.click(createButton);

    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });

  it('should show delete confirmation dialog', async () => {
    render(<RoleList {...defaultProps} />);

    const deleteButtons = screen.getAllByTitle('Delete role');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete Role')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete the role/)).toBeInTheDocument();
    });
  });

  it('should call onDeleteClick when delete is confirmed', async () => {
    const onDeleteClick = vi.fn();
    render(<RoleList {...defaultProps} onDeleteClick={onDeleteClick} />);

    const deleteButtons = screen.getAllByTitle('Delete role');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete Role')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    expect(onDeleteClick).toHaveBeenCalledWith('1');
  });

  it('should close dialog when cancel is clicked', async () => {
    render(<RoleList {...defaultProps} />);

    const deleteButtons = screen.getAllByTitle('Delete role');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete Role')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Delete Role')).not.toBeInTheDocument();
    });
  });

  it('should display dash for missing description', () => {
    const rolesWithoutDescription: Role[] = [
      {
        id: '3',
        name: 'viewer',
        displayName: 'Viewer',
        permissions: [],
        composite: false,
      },
    ];

    render(<RoleList {...defaultProps} roles={rolesWithoutDescription} />);

    expect(screen.getByText('viewer')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
