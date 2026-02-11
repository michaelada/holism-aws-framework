import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RolesPage } from '../RolesPage';
import { NotificationProvider } from '../../context';
import { Role } from '../../types/admin.types';

// Mock the API service
vi.mock('../../context', async () => {
  const actual = await vi.importActual('../../context');
  return {
    ...actual,
    useApi: () => ({ api: mockApi }),
  };
});

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
];

const mockApi = {
  getRoles: vi.fn(),
  createRole: vi.fn(),
  deleteRole: vi.fn(),
} as any;

describe('RolesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getRoles.mockResolvedValue(mockRoles);
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <NotificationProvider>
        {component}
      </NotificationProvider>
    );
  };

  it('should load and display roles on mount', async () => {
    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(mockApi.getRoles).toHaveBeenCalled();
      expect(screen.getByText('admin')).toBeInTheDocument();
    });
  });

  it('should navigate to create form when create button is clicked', async () => {
    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create role/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Role')).toBeInTheDocument();
    });
  });

  it('should create role and refresh list', async () => {
    mockApi.createRole.mockResolvedValue({
      ...mockRoles[0],
      id: '2',
      name: 'new-role',
    });

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create role/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Role')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs[0];
    const displayNameInput = inputs[1];
    const descriptionInput = inputs[2];

    fireEvent.change(nameInput, { target: { value: 'new-role' } });
    fireEvent.change(displayNameInput, { target: { value: 'New Role' } });
    fireEvent.change(descriptionInput, { target: { value: 'New role description' } });

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApi.createRole).toHaveBeenCalledWith({
        name: 'new-role',
        displayName: 'New Role',
        description: 'New role description',
      });
      expect(mockApi.getRoles).toHaveBeenCalledTimes(2);
    });
  });

  it('should delete role and refresh list', async () => {
    mockApi.deleteRole.mockResolvedValue(undefined);

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Delete role');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Role')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockApi.deleteRole).toHaveBeenCalledWith('1');
      expect(mockApi.getRoles).toHaveBeenCalledTimes(2);
    });
  });

  it('should return to list when cancel is clicked', async () => {
    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create role/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Role')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText('Roles')).toBeInTheDocument();
      expect(screen.getByText('admin')).toBeInTheDocument();
    });
  });

  it('should handle API errors when loading roles', async () => {
    mockApi.getRoles.mockRejectedValue(new Error('Failed to load'));

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(mockApi.getRoles).toHaveBeenCalled();
    });
  });

  it('should handle API errors when creating role', async () => {
    mockApi.createRole.mockRejectedValue(new Error('Failed to create'));

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create role/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Role')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs[0];
    const displayNameInput = inputs[1];

    fireEvent.change(nameInput, { target: { value: 'new-role' } });
    fireEvent.change(displayNameInput, { target: { value: 'New Role' } });

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApi.createRole).toHaveBeenCalled();
    });
  });

  it('should handle API errors when deleting role', async () => {
    mockApi.deleteRole.mockRejectedValue(new Error('Failed to delete'));

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Delete role');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Role')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockApi.deleteRole).toHaveBeenCalled();
    });
  });
});
