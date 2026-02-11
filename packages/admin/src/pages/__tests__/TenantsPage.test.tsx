import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TenantsPage } from '../TenantsPage';
import { ApiProvider, NotificationProvider } from '../../context';
import { AdminApiService } from '../../services/adminApi';
import { Tenant } from '../../types/admin.types';

// Mock the API service
vi.mock('../../context', async () => {
  const actual = await vi.importActual('../../context');
  return {
    ...actual,
    useApi: () => ({ api: mockApi }),
  };
});

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
];

const mockApi = {
  getTenants: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
  deleteTenant: vi.fn(),
} as any;

describe('TenantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getTenants.mockResolvedValue(mockTenants);
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <MemoryRouter>
        <NotificationProvider>
          {component}
        </NotificationProvider>
      </MemoryRouter>
    );
  };

  it('should load and display tenants on mount', async () => {
    renderWithProviders(<TenantsPage />);

    await waitFor(() => {
      expect(mockApi.getTenants).toHaveBeenCalled();
      expect(screen.getByText('tenant-one')).toBeInTheDocument();
    });
  });

  it('should navigate to create form when create button is clicked', async () => {
    renderWithProviders(<TenantsPage />);

    await waitFor(() => {
      expect(screen.getByText('tenant-one')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create tenant/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Tenant')).toBeInTheDocument();
    });
  });

  it('should navigate to edit form when edit button is clicked', async () => {
    renderWithProviders(<TenantsPage />);

    await waitFor(() => {
      expect(screen.getByText('tenant-one')).toBeInTheDocument();
    });

    const editButton = screen.getByTitle('Edit tenant');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Tenant')).toBeInTheDocument();
      expect(screen.getByDisplayValue('tenant-one')).toBeInTheDocument();
    });
  });

  it('should create tenant and refresh list', async () => {
    mockApi.createTenant.mockResolvedValue({
      ...mockTenants[0],
      id: '2',
      name: 'new-tenant',
    });

    renderWithProviders(<TenantsPage />);

    await waitFor(() => {
      expect(screen.getByText('tenant-one')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create tenant/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Tenant')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs[0];
    const displayNameInput = inputs[1];

    fireEvent.change(nameInput, { target: { value: 'new-tenant' } });
    fireEvent.change(displayNameInput, { target: { value: 'New Tenant' } });

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApi.createTenant).toHaveBeenCalledWith({
        name: 'new-tenant',
        displayName: 'New Tenant',
        domain: undefined,
      });
      expect(mockApi.getTenants).toHaveBeenCalledTimes(2);
    });
  });

  it('should update tenant and refresh list', async () => {
    mockApi.updateTenant.mockResolvedValue({
      ...mockTenants[0],
      displayName: 'Updated Tenant',
    });

    renderWithProviders(<TenantsPage />);

    await waitFor(() => {
      expect(screen.getByText('tenant-one')).toBeInTheDocument();
    });

    const editButton = screen.getByTitle('Edit tenant');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Tenant')).toBeInTheDocument();
    });

    const displayNameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(displayNameInput, { target: { value: 'Updated Tenant' } });

    const submitButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApi.updateTenant).toHaveBeenCalledWith('1', {
        name: 'tenant-one',
        displayName: 'Updated Tenant',
        domain: 'tenant1.example.com',
      });
      expect(mockApi.getTenants).toHaveBeenCalledTimes(2);
    });
  });

  it('should delete tenant and refresh list', async () => {
    mockApi.deleteTenant.mockResolvedValue(undefined);

    renderWithProviders(<TenantsPage />);

    await waitFor(() => {
      expect(screen.getByText('tenant-one')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Delete tenant');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Tenant')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockApi.deleteTenant).toHaveBeenCalledWith('1');
      expect(mockApi.getTenants).toHaveBeenCalledTimes(2);
    });
  });

  it('should return to list when cancel is clicked', async () => {
    renderWithProviders(<TenantsPage />);

    await waitFor(() => {
      expect(screen.getByText('tenant-one')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create tenant/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Tenant')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText('Tenants')).toBeInTheDocument();
      expect(screen.getByText('tenant-one')).toBeInTheDocument();
    });
  });
});
