/**
 * Unit tests for InviteUserDialog component
 * Tests user invitation flow for both admin and account users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithProviders, createWrapper } from '../../../test/renderWithProviders';
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
    return renderWithProviders(
      <InviteUserDialog
        open={open}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        userType={userType}
      />
    );
  };

  /** The three text fields an admin invitation requires. */
  const fillAdminDetails = () => {
    fireEvent.change(screen.getByLabelText(/users.fields.email/i), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/users.fields.firstName/i), {
      target: { value: 'John' },
    });
    fireEvent.change(screen.getByLabelText(/users.fields.lastName/i), {
      target: { value: 'Doe' },
    });
  };

  /**
   * Pick a role, then close the dropdown.
   *
   * The role Select is `multiple`, so MUI deliberately keeps its menu open
   * after a choice — and while it is open the menu's backdrop sits over the
   * dialog, so the submit button cannot be clicked. Escape is what dismisses
   * it. These tests used to click the dialog title instead, which does nothing:
   * the click lands on the title rather than on the backdrop MUI listens to,
   * the menu stays open, and submitting is impossible. That is what made them
   * "not close properly in test environment".
   */
  const selectRole = async (name: RegExp) => {
    fireEvent.mouseDown(await screen.findByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name }));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  };

  describe('Admin User Invitation', () => {
    it('should render dialog with correct title for admin users', () => {
      renderComponent('admin');

      expect(screen.getByText('users.admins.invite')).toBeInTheDocument();
    });

    it('should display all required fields for admin users', async () => {
      mockExecute.mockResolvedValue(mockAvailableRoles);
      renderComponent('admin');

      expect(screen.getByLabelText(/users.fields.email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/users.fields.firstName/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/users.fields.lastName/i)).toBeInTheDocument();
      
      // Wait for roles to load and the Select to render
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should not display phone field for admin users', () => {
      renderComponent('admin');

      expect(screen.queryByLabelText(/users.fields.phone/i)).not.toBeInTheDocument();
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

      const submitButton = screen.getByRole('button', { name: /users.actions.sendInvitation/i });
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

      const emailInput = screen.getByLabelText(/users.fields.email/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

      const firstNameInput = screen.getByLabelText(/users.fields.firstName/i);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      const lastNameInput = screen.getByLabelText(/users.fields.lastName/i);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      const submitButton = screen.getByRole('button', { name: /users.actions.sendInvitation/i });
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

      const emailInput = screen.getByLabelText(/users.fields.email/i);
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const firstNameInput = screen.getByLabelText(/users.fields.firstName/i);
      fireEvent.change(firstNameInput, { target: { value: 'John' } });

      const lastNameInput = screen.getByLabelText(/users.fields.lastName/i);
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      const submitButton = screen.getByRole('button', { name: /users.actions.sendInvitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please select at least one role/i)).toBeInTheDocument();
      });
    });

    it('should submit admin user invitation with correct data', async () => {
      mockExecute
        .mockResolvedValueOnce(mockAvailableRoles) // Load roles
        .mockResolvedValueOnce({}); // Submit invitation
      
      renderComponent('admin');

      fillAdminDetails();
      await selectRole(/^admin$/i);

      const submitButton = screen.getByRole('button', { name: /users.actions.sendInvitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/users/admins/org-1',
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

      expect(screen.getByRole('button', { name: /users.actions.sendInvitation/i })).toBeInTheDocument();
    });
  });

  describe('Account User Creation', () => {
    it('should render dialog with correct title for account users', () => {
      renderComponent('account');

      expect(screen.getByText('users.accounts.create')).toBeInTheDocument();
    });

    it('should display all required fields for account users', () => {
      renderComponent('account');

      expect(screen.getByLabelText(/users.fields.email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/users.fields.firstName/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/users.fields.lastName/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/users.fields.phone/i)).toBeInTheDocument();
    });

    it('should not display roles field for account users', () => {
      renderComponent('account');

      expect(screen.queryByLabelText(/users.fields.roles/i)).not.toBeInTheDocument();
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
      const emailInput = screen.getByLabelText(/users.fields.email/i);
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

      const firstNameInput = screen.getByLabelText(/users.fields.firstName/i);
      fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

      const lastNameInput = screen.getByLabelText(/users.fields.lastName/i);
      fireEvent.change(lastNameInput, { target: { value: 'Smith' } });

      const phoneInput = screen.getByLabelText(/users.fields.phone/i);
      fireEvent.change(phoneInput, { target: { value: '+44 1234 567890' } });

      // Submit
      const submitButton = screen.getByRole('button', { name: /users.actions.createUser/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/users/accounts/org-1',
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
      const emailInput = screen.getByLabelText(/users.fields.email/i);
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

      const firstNameInput = screen.getByLabelText(/users.fields.firstName/i);
      fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

      const lastNameInput = screen.getByLabelText(/users.fields.lastName/i);
      fireEvent.change(lastNameInput, { target: { value: 'Smith' } });

      // Submit
      const submitButton = screen.getByRole('button', { name: /users.actions.createUser/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith({
          method: 'POST',
          url: '/api/orgadmin/users/accounts/org-1',
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

      expect(screen.getByRole('button', { name: /users.actions.createUser/i })).toBeInTheDocument();
    });
  });

  describe('Dialog Behavior', () => {
    it('should not render when open is false', () => {
      renderComponent('admin', false);

      expect(screen.queryByText('users.admins.invite')).not.toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', () => {
      renderComponent('admin');

      const cancelButton = screen.getByRole('button', { name: /common.actions.cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when dialog is closed', async () => {
      mockExecute.mockResolvedValue(mockAvailableRoles);
      
      const { rerender } = renderComponent('admin');

      // Fill in form
      const emailInput = screen.getByLabelText(/users.fields.email/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /common.actions.cancel/i });
      fireEvent.click(cancelButton);

      // Reopen dialog
      rerender(
        <InviteUserDialog
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          userType="admin"
        />,
        { wrapper: createWrapper() }
      );

      // Check form is reset
      await waitFor(() => {
        const emailInputAfter = screen.getByLabelText(/users.fields.email/i) as HTMLInputElement;
        expect(emailInputAfter.value).toBe('');
      });
    });

    it('should disable buttons while submitting', async () => {
      mockExecute
        .mockResolvedValueOnce(mockAvailableRoles)
        .mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderComponent('admin');

      fillAdminDetails();
      await selectRole(/^admin$/i);

      const submitButton = screen.getByRole('button', { name: /users.actions.sendInvitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const creatingButton = screen.getByRole('button', { name: /creating/i });
        const cancelButton = screen.getByRole('button', { name: /common.actions.cancel/i });
        expect(creatingButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      mockExecute
        .mockResolvedValueOnce(mockAvailableRoles)
        .mockRejectedValueOnce({
          response: { data: { message: 'Email already exists' } },
        });
      
      renderComponent('admin');

      fillAdminDetails();
      await selectRole(/^admin$/i);

      const submitButton = screen.getByRole('button', { name: /users.actions.sendInvitation/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email already exists')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should display generic error message when API error has no message', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecute
        .mockResolvedValueOnce(mockAvailableRoles)
        .mockRejectedValueOnce(new Error('Network error'));
      
      renderComponent('admin');

      fillAdminDetails();
      await selectRole(/^admin$/i);

      const submitButton = screen.getByRole('button', { name: /users.actions.sendInvitation/i });
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
      expect(screen.getByLabelText(/users.fields.email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/users.fields.firstName/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/users.fields.lastName/i)).toBeInTheDocument();
    });
  });
});
