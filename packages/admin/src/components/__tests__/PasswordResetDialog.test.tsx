import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PasswordResetDialog } from '../PasswordResetDialog';
import { User } from '../../types/admin.types';

describe('PasswordResetDialog', () => {
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
    createdAt: '2024-01-01T00:00:00Z',
  };

  const defaultProps = {
    open: true,
    user: mockUser,
    loading: false,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render dialog when open', () => {
    render(<PasswordResetDialog {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.getByText(/resetting password for user/i)).toBeInTheDocument();
    expect(screen.getByText('john.doe')).toBeInTheDocument();
    expect(screen.getByText(/john\.doe@example\.com/)).toBeInTheDocument();
  });

  it('should not render dialog when closed', () => {
    render(<PasswordResetDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Reset Password')).not.toBeInTheDocument();
  });

  /**
   * Whitespace, not empty boxes.
   *
   * Both fields are `required`, so a browser refuses to submit the form while
   * either is blank and the dialog's own check never runs — which is why this
   * used to be skipped as a "validation timing issue". Spaces satisfy the
   * browser and still fail `trim()`, so the message the dialog is responsible
   * for is the one on screen.
   */
  it('should validate required fields', async () => {
    const onSubmit = vi.fn();
    render(<PasswordResetDialog {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(screen.getByText('Please confirm the password')).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit while a required box is empty', () => {
    const onSubmit = vi.fn();
    render(<PasswordResetDialog {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should validate password length', async () => {
    render(<PasswordResetDialog {...defaultProps} />);

    // Both boxes, so the browser's own `required` check is satisfied and the
    // dialog's length check is what decides the outcome.
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('should validate password confirmation match', async () => {
    // TODO: Fix validation timing issue in test environment
    // Form validation works correctly in actual usage
    render(<PasswordResetDialog {...defaultProps} />);

    // Get password fields by type
    const allPasswordInputs = screen.getAllByLabelText(/password/i);
    const passwordFields = allPasswordInputs.filter(input => (input as HTMLInputElement).type === 'password');
    const [newPasswordInput, confirmInput] = passwordFields;

    fireEvent.change(newPasswordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'different123' } });

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('should submit valid password reset', async () => {
    const onSubmit = vi.fn();
    render(<PasswordResetDialog {...defaultProps} onSubmit={onSubmit} />);

    // Get password fields by type
    const allPasswordInputs = screen.getAllByLabelText(/password/i);
    const passwordFields = allPasswordInputs.filter(input => (input as HTMLInputElement).type === 'password');
    const [newPasswordInput, confirmInput] = passwordFields;

    fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } });
    fireEvent.change(confirmInput, { target: { value: 'newpassword123' } });

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        password: 'newpassword123',
        temporary: true,
      });
    });
  });

  it('should handle temporary flag', async () => {
    const onSubmit = vi.fn();
    render(<PasswordResetDialog {...defaultProps} onSubmit={onSubmit} />);

    // Get password fields by type
    const allPasswordInputs = screen.getAllByLabelText(/password/i);
    const passwordFields = allPasswordInputs.filter(input => (input as HTMLInputElement).type === 'password');
    const [newPasswordInput, confirmInput] = passwordFields;
    const temporaryCheckbox = screen.getByLabelText(/require password change on next login/i);

    fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } });
    fireEvent.change(confirmInput, { target: { value: 'newpassword123' } });
    fireEvent.click(temporaryCheckbox);

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        password: 'newpassword123',
        temporary: false,
      });
    });
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<PasswordResetDialog {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should disable form when loading', () => {
    render(<PasswordResetDialog {...defaultProps} loading={true} />);

    // Get password fields by type
    const allPasswordInputs = screen.getAllByLabelText(/password/i);
    const passwordFields = allPasswordInputs.filter(input => (input as HTMLInputElement).type === 'password');
    const [newPasswordInput, confirmInput] = passwordFields;

    expect(newPasswordInput).toBeDisabled();
    expect(confirmInput).toBeDisabled();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeDisabled();
  });

  it('should reset form when dialog opens', () => {
    const { rerender } = render(<PasswordResetDialog {...defaultProps} open={false} />);

    rerender(<PasswordResetDialog {...defaultProps} open={true} />);

    // Get password fields by type
    const allPasswordInputs = screen.getAllByLabelText(/password/i);
    const passwordFields = allPasswordInputs.filter(input => (input as HTMLInputElement).type === 'password');
    const [newPasswordInput, confirmInput] = passwordFields;

    expect((newPasswordInput as HTMLInputElement).value).toBe('');
    expect((confirmInput as HTMLInputElement).value).toBe('');
  });

  it('should clear errors when user types', async () => {
    render(<PasswordResetDialog {...defaultProps} />);

    const newPasswordInput = screen.getByLabelText(/new password/i);
    fireEvent.change(newPasswordInput, { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } });

    await waitFor(() => {
      expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
    });
  });
});
