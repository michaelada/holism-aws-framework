import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoleForm } from '../RoleForm';

/**
 * The form asks for a display name and an optional description; the role's
 * `name` — the identifier Keycloak stores — is derived from the display name
 * rather than typed. These tests were written when the name was a third field
 * an administrator filled in by hand, so they looked for an input that is no
 * longer there and asserted names the form no longer accepts.
 */
describe('RoleForm', () => {
  const defaultProps = {
    loading: false,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  /** Display Name, then Description. */
  const fields = () => screen.getAllByRole('textbox');

  it('should render create form', () => {
    render(<RoleForm {...defaultProps} />);

    expect(screen.getByText('Create Role')).toBeInTheDocument();
    expect(fields()).toHaveLength(2); // Display Name, Description
  });

  it('should validate required fields', () => {
    const onSubmit = vi.fn();
    render(<RoleForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    // Form should not submit when fields are empty
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit valid form with all fields', async () => {
    const onSubmit = vi.fn();
    render(<RoleForm {...defaultProps} onSubmit={onSubmit} />);

    const [displayNameInput, descriptionInput] = fields();
    fireEvent.change(displayNameInput, { target: { value: 'New Role' } });
    fireEvent.change(descriptionInput, { target: { value: 'Role description' } });

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'new-role',
        displayName: 'New Role',
        description: 'Role description',
      });
    });
  });

  it('should submit valid form without optional description', async () => {
    const onSubmit = vi.fn();
    render(<RoleForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(fields()[0], { target: { value: 'New Role' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'new-role',
        displayName: 'New Role',
        description: undefined,
      });
    });
  });

  it('derives a usable identifier from a display name full of punctuation', async () => {
    const onSubmit = vi.fn();
    render(<RoleForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(fields()[0], { target: { value: 'Club Secretary (Interim)!' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'club-secretary-interim' })
      );
    });
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<RoleForm {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should disable form when loading', () => {
    render(<RoleForm {...defaultProps} loading={true} />);

    for (const input of fields()) {
      expect(input).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('should clear errors when field is changed', async () => {
    render(<RoleForm {...defaultProps} />);

    /*
     * Whitespace, not empty. The field is `required`, so an empty box never
     * reaches the form's own validation — the browser refuses the submit
     * first, and nothing the component would say is ever rendered.
     */
    fireEvent.change(fields()[0], { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText('Display name is required')).toBeInTheDocument();
    });

    fireEvent.change(fields()[0], { target: { value: 'Valid Role' } });

    expect(fields()[0]).toHaveValue('Valid Role');
    expect(screen.queryByText('Display name is required')).not.toBeInTheDocument();
  });
});
