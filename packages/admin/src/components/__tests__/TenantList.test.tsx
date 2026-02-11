import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TenantList } from '../TenantList';
import { Tenant } from '../../types/admin.types';

describe('TenantList', () => {
  const mockTenants: Tenant[] = [
    {
      id: '1',
      keycloakGroupId: 'kc-1',
      name: 'tenant-one',
      displayName: 'Tenant One',
      domain: 'tenant1.example.com',
      status: 'active',
      memberCount: 5,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      keycloakGroupId: 'kc-2',
      name: 'tenant-two',
      displayName: 'Tenant Two',
      status: 'active',
      memberCount: 3,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  const defaultProps = {
    tenants: mockTenants,
    loading: false,
    onCreateClick: vi.fn(),
    onEditClick: vi.fn(),
    onDeleteClick: vi.fn(),
    onViewDetails: vi.fn(),
  };

  it('should render tenant list with data', () => {
    render(<TenantList {...defaultProps} />);

    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText('tenant-one')).toBeInTheDocument();
    expect(screen.getByText('Tenant One')).toBeInTheDocument();
    expect(screen.getByText('tenant1.example.com')).toBeInTheDocument();
    expect(screen.getByText('tenant-two')).toBeInTheDocument();
    expect(screen.getByText('Tenant Two')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(<TenantList {...defaultProps} loading={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display empty state when no tenants', () => {
    render(<TenantList {...defaultProps} tenants={[]} />);

    expect(screen.getByText('No tenants found')).toBeInTheDocument();
  });

  it('should call onCreateClick when create button is clicked', () => {
    const onCreateClick = vi.fn();
    render(<TenantList {...defaultProps} onCreateClick={onCreateClick} />);

    const createButton = screen.getByRole('button', { name: /create tenant/i });
    fireEvent.click(createButton);

    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });

  it('should call onEditClick when edit button is clicked', () => {
    const onEditClick = vi.fn();
    render(<TenantList {...defaultProps} onEditClick={onEditClick} />);

    const editButtons = screen.getAllByTitle('Edit tenant');
    fireEvent.click(editButtons[0]);

    expect(onEditClick).toHaveBeenCalledWith(mockTenants[0]);
  });

  it('should show delete confirmation dialog', async () => {
    render(<TenantList {...defaultProps} />);

    const deleteButtons = screen.getAllByTitle('Delete tenant');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete Tenant')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete the tenant/)).toBeInTheDocument();
    });
  });

  it('should call onDeleteClick when delete is confirmed', async () => {
    const onDeleteClick = vi.fn();
    render(<TenantList {...defaultProps} onDeleteClick={onDeleteClick} />);

    const deleteButtons = screen.getAllByTitle('Delete tenant');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete Tenant')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    expect(onDeleteClick).toHaveBeenCalledWith('1');
  });

  it('should close dialog when cancel is clicked', async () => {
    render(<TenantList {...defaultProps} />);

    const deleteButtons = screen.getAllByTitle('Delete tenant');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete Tenant')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Delete Tenant')).not.toBeInTheDocument();
    });
  });

  it('should display member count', () => {
    render(<TenantList {...defaultProps} />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should display status chips', () => {
    render(<TenantList {...defaultProps} />);

    const statusChips = screen.getAllByText('active');
    expect(statusChips).toHaveLength(2);
  });
});
