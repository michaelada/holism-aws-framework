import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserForm } from '../UserForm';
import { User, Role } from '../../types/admin.types';
import type { Organization } from '../../types/organization.types';

describe('UserForm', () => {
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
    {
      id: 'role-2',
      name: 'user',
      displayName: 'User',
      composite: false,
    },
  ];

  const mockUser: User = {
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
    phoneNumber: '+1234567890',
    department: 'Engineering',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const defaultProps = {
    organizations: mockOrganisations,
    roles: mockRoles,
    loading: false,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  /**
   * Every required box filled with something a browser accepts.
   *
   * The four validation tests below used to submit an empty form and were
   * skipped as a "validation timing issue". They were not: `username`, `email`,
   * `firstName`, `lastName` and `password` are all `required`, so the browser
   * refuses the submit while any is blank and the form's own `validateForm`
   * never runs. Filling the form first and then spoiling one field is what
   * reaches the message each test is about.
   */
  const fillValidForm = () => {
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'john.doe' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
      target: { value: 'john.doe@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(passwordField(), { target: { value: 'password123' } });
  };

  const passwordField = () =>
    screen
      .getAllByLabelText(/password/i)
      .find((input) => (input as HTMLInputElement).type === 'password') as HTMLElement;

  describe('Create Mode', () => {
    it('should render create form', () => {
      render(<UserForm {...defaultProps} />);

      expect(screen.getByText('Create User')).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /^email$/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      
      // Check for password field by type
      const passwordInputs = screen.getAllByLabelText(/password/i);
      const passwordField = passwordInputs.find(input => (input as HTMLInputElement).type === 'password');
      expect(passwordField).toBeInTheDocument();
    });

    it('should not submit while a required box is empty', () => {
      const onSubmit = vi.fn();
      render(<UserForm {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const onSubmit = vi.fn();
      render(<UserForm {...defaultProps} onSubmit={onSubmit} />);

      /*
       * Spaces satisfy the browser's `required` check and still fail `trim()`,
       * so these are the form's own messages rather than the browser's. Email
       * keeps a real address: `type="email"` rejects whitespace outright, and a
       * field the browser blocks never reaches the form at all.
       */
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: '   ' } });
      fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
        target: { value: 'john.doe@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: '   ' } });
      fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: '   ' } });
      fireEvent.change(passwordField(), { target: { value: '   ' } });

      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText('Username is required')).toBeInTheDocument();
        expect(screen.getByText('First name is required')).toBeInTheDocument();
        expect(screen.getByText('Last name is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required for new users')).toBeInTheDocument();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should validate username format', async () => {
      render(<UserForm {...defaultProps} />);

      fillValidForm();
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'invalid user!' } });

      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/username must contain only letters, numbers/i)
        ).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      render(<UserForm {...defaultProps} />);

      fillValidForm();
      /*
       * `user@localhost` is a valid address to `type="email"` — the browser does
       * not insist on a dotted domain — and invalid to the form, which does.
       * A value the browser itself rejects would never reach `validateForm`.
       */
      fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
        target: { value: 'user@localhost' },
      });

      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText(/email must be a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should validate password length', async () => {
      render(<UserForm {...defaultProps} />);

      fillValidForm();
      fireEvent.change(passwordField(), { target: { value: 'short' } });

      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should submit valid form data', async () => {
      const onSubmit = vi.fn();
      render(<UserForm {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/username/i), {
        target: { value: 'john.doe' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
        target: { value: 'john.doe@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: 'John' },
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

      const submitButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          username: 'john.doe',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          password: 'password123',
          temporaryPassword: true,
          emailVerified: false,
          phoneNumber: undefined,
          department: undefined,
          organizationId: undefined,
          roles: undefined,
        });
      });
    });

    it('should include optional fields when provided', async () => {
      const onSubmit = vi.fn();
      render(<UserForm {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/username/i), {
        target: { value: 'john.doe' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
        target: { value: 'john.doe@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: 'John' },
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
      
      fireEvent.change(screen.getByLabelText(/phone number/i), {
        target: { value: '+1234567890' },
      });
      fireEvent.change(screen.getByLabelText(/department/i), {
        target: { value: 'Engineering' },
      });

      const submitButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            phoneNumber: '+1234567890',
            department: 'Engineering',
          })
        );
      });
    });
  });

  describe('Edit Mode', () => {
    it('should render edit form with user data', () => {
      render(<UserForm {...defaultProps} user={mockUser} />);

      expect(screen.getByText('Edit User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john.doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Engineering')).toBeInTheDocument();
    });

    it('should disable username field in edit mode', () => {
      render(<UserForm {...defaultProps} user={mockUser} />);

      const usernameInput = screen.getByLabelText(/username/i);
      expect(usernameInput).toBeDisabled();
    });

    it('should not show password field in edit mode', () => {
      render(<UserForm {...defaultProps} user={mockUser} />);

      // Check that no password input field exists (type="password")
      const allInputs = screen.queryAllByRole('textbox');
      const passwordInputs = allInputs.filter(input => (input as HTMLInputElement).type === 'password');
      expect(passwordInputs.length).toBe(0);
    });

    it('should submit updated data', async () => {
      const onSubmit = vi.fn();
      render(<UserForm {...defaultProps} user={mockUser} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
        target: { value: 'newemail@example.com' },
      });

      const submitButton = screen.getByRole('button', { name: /update/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'newemail@example.com',
          })
        );
      });
    });
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<UserForm {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should disable form when loading', () => {
    render(<UserForm {...defaultProps} loading={true} />);

    expect(screen.getByLabelText(/username/i)).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /^email$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });
});
