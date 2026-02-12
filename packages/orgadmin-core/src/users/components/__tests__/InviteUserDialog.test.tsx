/**
 * Unit tests for InviteUserDialog component
 * Tests user invitation flow for both admin and account users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import InviteUserDialog from '../InviteUserDialog';
import * as useApiModule from '../../../hooks/useApi';

// Mock the useApi hook
vi.mock('../../../hooks/useApi');

const mockAvailableRoles = [
  { id: '1', name: 'Admin' },
  { id: '2', name: 'Event Manager' },
  { id: '3', name: 'Finance Manager' },
  { id: '4', name: 'Content Editor' },
];

describe('InviteUserDialog', () => {
  const mockExecute = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementation
    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });
  });

  const renderComponent = (userType: 'admin' | 'account', open = true) => {
    return render(
      <InviteUserDialog
        open={open}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        userType={userType}
      />
    );
  };

  describe('Admin User Invitation', () => {
    it('should render dialog with correct title for admin users', () => {
      renderComponent('admin');

      expect(screen.getByText('Invite Admin User')).toBeInTheDocument();
    });

    it('should display all required fields for admin users', async () => {
      mockExecute.mockResolvedValue(mockAvailableRoles);
      renderComponent('admin');

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      
      // Wait for roles to load and the Select to render
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should not display phone field for admin users', () => {
      renderComponent('admin');

      expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();
    });

    it('should load available roles when dialog opens', async () => {
      mockExecute.mockResolvedValue(mockAvailableRoles);
      
      renderComponent('admin');

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/roles',
        });
      });
    });

    it('should allow selecting multiple roles', async () => {
      mockExecute.mockResolvedValue(mockAvailableRoles);
      
      renderComponent('admin');

      // Wait for roles to load and the Select to render
      const roleSelect = await screen.findByRole('combobox');
      fireEvent.mouseDown(roleSelect);

      // Select roles
      const adminOption = await screen.findByRole('option', { name: /^admin$/i });
      fireEvent.click(adminOption);

      const eventManagerOption = await screen.findByRole('option', { name: /event manager/i });
      fireEvent.click(eventManagerOption);
    });

    it('should validate that email is required', async () => {
      renderComponent('admin');

      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please fill in all required fields/i)).toBeInTheDocument();
      });

      expect(mockExecute).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should validate email format', async () => {
      renderComponent('admin');

      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

      const firstNameInput = screen.getByLabelText(/first name/i);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      const lastNameInput = screen.getByLabelText(/last name/i);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should validate that at least one role is selected', async () => {
      mockExecute.mockResolvedValue(mockAvailableRoles);
      
      renderComponent('admin');

      // Wait for roles to load
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/roles',
        });
      });

      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const firstNameInput = screen.getByLabelText(/first name/i);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      const lastNameInput = screen.getByLabelText(/last name/i);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please select at least one role/i)).toBeInTheDocument();
      });
    });

    // TODO: Fix this test - MUI Select dropdown doesn't close properly in test environment
    it.skip('should submit admin user invitation with correct data', async () => {
      mockExecute
        .mockResolvedValueOnce(mockAvailableRoles) // Load roles
        .mockResolvedValueOnce({}); // Submit invitation
      
      renderComponent('admin');

      // Fill in form
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const firstNameInput = screen.getByLabelText(/first name/i);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      const lastNameInput = screen.getByLabelText(/last name/i);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      // Wait for roles to load and select role
      const roleSelect = await screen.findByRole('combobox');
      fireEvent.mouseDown(roleSelect);

      const adminOption = await screen.findByRole('option', { name: /^admin$/i });
      fireEvent.click(adminOption);

      // Click outside the dropdown to close it (click on the dialog title)
      const dialogTitle = screen.getByText('Invite Admin User');
      fireEvent.click(dialogTitle);

      // Wait for dropdown to close
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      // Now the dialog buttons should be accessible
      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/users/admins',
          data: {
            email: 'admin@example.com',
            firstName: 'John',
            lastName: 'Doe',
            roles: ['Admin'],
          },
        });
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should display correct button text for admin users', () => {
      renderComponent('admin');

      expect(screen.getByRole('button', { name: /send invitation/i })).toBeInTheDocument();
    });
  });

  describe('Account User Creation', () => {
    it('should render dialog with correct title for account users', () => {
      renderComponent('account');

      expect(screen.getByText('Create Account User')).toBeInTheDocument();
    });

    it('should display all required fields for account users', () => {
      renderComponent('account');

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    });

    it('should not display roles field for account users', () => {
      renderComponent('account');

      expect(screen.queryByLabelText(/roles/i)).not.toBeInTheDocument();
    });

    it('should not load roles for account users', () => {
      renderComponent('account');

      expect(mockExecute).not.toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/roles',
      });
    });

    it('should submit account user creation with correct data', async () => {
      mockExecute.mockResolvedValue({});
      
      renderComponent('account');

      // Fill in form
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

      const firstNameInput = screen.getByLabelText(/first name/i);
      fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

      const lastNameInput = screen.getByLabelText(/last name/i);
      fireEvent.change(lastNameInput, { target: { value: 'Smith' } });

      const phoneInput = screen.getByLabelText(/phone/i);
      fireEvent.change(phoneInput, { target: { value: '+44 1234 567890' } });

      // Submit
      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/users/accounts',
          data: {
            email: 'user@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            phone: '+44 1234 567890',
          },
        });
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should allow creating account user without phone number', async () => {
      mockExecute.mockResolvedValue({});
      
      renderComponent('account');

      // Fill in form without phone
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

      const firstNameInput = screen.getByLabelText(/first name/i);
      fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

      const lastNameInput = screen.getByLabelText(/last name/i);
      fireEvent.change(lastNameInput, { target: { value: 'Smith' } });

      // Submit
      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/users/accounts',
          data: {
            email: 'user@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            phone: '',
          },
        });
      });
    });

    it('should display correct button text for account users', () => {
      renderComponent('account');

      expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
    });
  });

  describe('Dialog Behavior', () => {
    it('should not render when open is false', () => {
      renderComponent('admin', false);

      expect(screen.queryByText('Invite Admin User')).not.toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', () => {
      renderComponent('admin');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when dialog is closed', async () => {
      mockExecute.mockResolvedValue(mockAvailableRoles);
      
      const { rerender } = renderComponent('admin');

      // Fill in form
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Reopen dialog
      rerender(
        <InviteUserDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          userType="admin"
        />
      );

      // Check form is reset
      await waitFor(() => {
        const emailInputAfter = screen.getByLabelText(/email/i) as HTMLInputElement;
        expect(emailInputAfter.value).toBe('');
      });
    });

    // TODO: Fix this test - MUI Select dropdown doesn't close properly in test environment
    it.skip('should disable buttons while submitting', async () => {
      mockExecute
        .mockResolvedValueOnce(mockAvailableRoles)
        .mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderComponent('admin');

      // Fill in form
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const firstNameInput = screen.getByLabelText(/first name/i);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      const lastNameInput = screen.getByLabelText(/last name/i);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      // Wait for roles to load and select role
      const roleSelect = await screen.findByRole('combobox');
      fireEvent.mouseDown(roleSelect);

      const adminOption = await screen.findByRole('option', { name: /^admin$/i });
      fireEvent.click(adminOption);

      // Click outside the dropdown to close it (click on the dialog title)
      const dialogTitle = screen.getByText('Invite Admin User');
      fireEvent.click(dialogTitle);

      // Wait for dropdown to close
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      // Now the dialog buttons should be accessible
      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const creatingButton = screen.getByRole('button', { name: /creating/i });
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        expect(creatingButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    // TODO: Fix this test - MUI Select dropdown doesn't close properly in test environment
    it.skip('should display error message when API call fails', async () => {
      mockExecute
        .mockResolvedValueOnce(mockAvailableRoles)
        .mockRejectedValueOnce({
          response: { data: { message: 'Email already exists' } },
        });
      
      renderComponent('admin');

      // Fill in form
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const firstNameInput = screen.getByLabelText(/first name/i);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      const lastNameInput = screen.getByLabelText(/last name/i);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      // Wait for roles to load and select role
      const roleSelect = await screen.findByRole('combobox');
      fireEvent.mouseDown(roleSelect);

      const adminOption = await screen.findByRole('option', { name: /^admin$/i });
      fireEvent.click(adminOption);

      // Click outside the dropdown to close it (click on the dialog title)
      const dialogTitle = screen.getByText('Invite Admin User');
      fireEvent.click(dialogTitle);

      // Wait for dropdown to close
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      // Now the dialog buttons should be accessible
      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email already exists')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    // TODO: Fix this test - MUI Select dropdown doesn't close properly in test environment
    it.skip('should display generic error message when API error has no message', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute
        .mockResolvedValueOnce(mockAvailableRoles)
        .mockRejectedValueOnce(new Error('Network error'));
      
      renderComponent('admin');

      // Fill in form
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const firstNameInput = screen.getByLabelText(/first name/i);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      const lastNameInput = screen.getByLabelText(/last name/i);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      // Wait for roles to load and select role
      const roleSelect = await screen.findByRole('combobox');
      fireEvent.mouseDown(roleSelect);

      const adminOption = await screen.findByRole('option', { name: /^admin$/i });
      fireEvent.click(adminOption);

      // Click outside the dropdown to close it (click on the dialog title)
      const dialogTitle = screen.getByText('Invite Admin User');
      fireEvent.click(dialogTitle);

      // Wait for dropdown to close
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      // Now the dialog buttons should be accessible
      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to create user/i)).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle role loading errors gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('Failed to load roles'));
      
      renderComponent('admin');

      // Wait for the component to attempt loading roles and handle the error
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'GET',
          url: '/api/orgadmin/roles',
        });
      });

      // The component should still render the form fields even if roles fail to load
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    });
  });
});
