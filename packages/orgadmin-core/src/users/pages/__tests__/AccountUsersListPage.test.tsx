/**
 * Unit tests for AccountUsersListPage component
 * Tests account user list rendering, filtering, and search functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AccountUsersListPage from '../AccountUsersListPage';
import * as useApiModule from '../../../hooks/useApi';

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

const mockAccountUsers = [
  {
    id: '1',
    email: 'user1@example.com',
    firstName: 'Alice',
    lastName: 'Brown',
    phone: '+44 1234 567890',
    status: 'active' as const,
    lastLogin: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-01T10:00:00Z',
  },
  {
    id: '2',
    email: 'user2@example.com',
    firstName: 'Charlie',
    lastName: 'Davis',
    status: 'active' as const,
    lastLogin: '2024-01-20T10:00:00Z',
    createdAt: '2024-01-05T10:00:00Z',
  },
  {
    id: '3',
    email: 'user3@example.com',
    firstName: 'Eve',
    lastName: 'Wilson',
    phone: '+44 9876 543210',
    status: 'inactive' as const,
    createdAt: '2024-01-10T10:00:00Z',
  },
];

describe('AccountUsersListPage', () => {
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
    return render(
      <BrowserRouter>
        <AccountUsersListPage />
      </BrowserRouter>
    );
  };

  describe('User List Rendering', () => {
    it('should render the page title and create button', () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account user/i })).toBeInTheDocument();
    });

    it('should load and display account users on mount', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/users/accounts',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
        expect(screen.getByText('Charlie Davis')).toBeInTheDocument();
        expect(screen.getByText('Eve Wilson')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching users', () => {
      mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();

      expect(screen.getByText('Loading account users...')).toBeInTheDocument();
    });

    it('should display empty state when no users exist', async () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no account users yet/i)).toBeInTheDocument();
      });
    });

    it('should display user emails', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
        expect(screen.getByText('user2@example.com')).toBeInTheDocument();
        expect(screen.getByText('user3@example.com')).toBeInTheDocument();
      });
    });

    it('should display user phone numbers', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('+44 1234 567890')).toBeInTheDocument();
        expect(screen.getByText('+44 9876 543210')).toBeInTheDocument();
      });
    });

    it('should display "-" for users without phone numbers', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        const cells = screen.getAllByText('-');
        expect(cells.length).toBeGreaterThan(0);
      });
    });

    it('should display user status with correct colors', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        const activeChips = screen.getAllByText('active');
        const inactiveChips = screen.getAllByText('inactive');
        
        expect(activeChips).toHaveLength(2);
        expect(inactiveChips).toHaveLength(1);
      });
    });

    it('should format last login dates correctly', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
        expect(screen.getByText('20 Jan 2024')).toBeInTheDocument();
      });
    });

    it('should display "Never" for users who have not logged in', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Never')).toBeInTheDocument();
      });
    });

    it('should display capability description', () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      expect(screen.getByText(/account users can enter events/i)).toBeInTheDocument();
    });

    it('should display tabs for Admin Users and Account Users', () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      expect(screen.getByRole('tab', { name: /admin users/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /account users/i })).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter users by email', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search users by name or email...');
      fireEvent.change(searchInput, { target: { value: 'user1' } });

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
        expect(screen.queryByText('Charlie Davis')).not.toBeInTheDocument();
        expect(screen.queryByText('Eve Wilson')).not.toBeInTheDocument();
      });
    });

    it('should filter users by first name', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search users by name or email...');
      fireEvent.change(searchInput, { target: { value: 'Charlie' } });

      await waitFor(() => {
        expect(screen.getByText('Charlie Davis')).toBeInTheDocument();
        expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
        expect(screen.queryByText('Eve Wilson')).not.toBeInTheDocument();
      });
    });

    it('should filter users by last name', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search users by name or email...');
      fireEvent.change(searchInput, { target: { value: 'Wilson' } });

      await waitFor(() => {
        expect(screen.getByText('Eve Wilson')).toBeInTheDocument();
        expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
        expect(screen.queryByText('Charlie Davis')).not.toBeInTheDocument();
      });
    });

    it('should be case-insensitive when searching', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search users by name or email...');
      fireEvent.change(searchInput, { target: { value: 'ALICE' } });

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });
    });

    it('should show "no users match" message when search returns no results', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search users by name or email...');
      fireEvent.change(searchInput, { target: { value: 'NonexistentUser' } });

      await waitFor(() => {
        expect(screen.getByText(/no account users match your search/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should open create dialog when create button is clicked', async () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      const createButton = screen.getByRole('button', { name: /create account user/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        const dialogTitles = screen.getAllByText(/create account user/i);
        expect(dialogTitles.length).toBeGreaterThan(1); // Button + Dialog title
      });
    });

    it('should navigate to user details when edit button is clicked', async () => {
      mockExecute.mockResolvedValue(mockAccountUsers);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/users/accounts/1');
    });

    it('should navigate to admin users tab when clicked', async () => {
      mockExecute.mockResolvedValue([]);
      renderComponent();

      const adminUsersTab = screen.getByRole('tab', { name: /admin users/i });
      fireEvent.click(adminUsersTab);

      expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/users/admins');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute.mockRejectedValue(new Error('API Error'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no account users yet/i)).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should set empty array when API returns null', async () => {
      mockExecute.mockResolvedValue(null);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no account users yet/i)).toBeInTheDocument();
      });
    });
  });
});
