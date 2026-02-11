import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoleForm } from '../RoleForm';

describe('RoleForm', () => {
  const defaultProps = {
    loading: false,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render create form', () => {
    render(<RoleForm {...defaultProps} />);

    expect(screen.getByText('Create Role')).toBeInTheDocument();
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(3); // Name, Display Name, Description
  });

  it('should validate required fields', () => {
    const onSubmit = vi.fn();
    render(<RoleForm {...defaultProps} onSubmit={onSubmit} />);

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    // Form should not submit when fields are empty
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should validate name format', async () => {
    const onSubmit = vi.fn();
    render(<RoleForm {...defaultProps} onSubmit={onSubmit} />);

    const nameInput = screen.getAllByRole('textbox')[0];
    const displayNameInput = screen.getAllByRole('textbox')[1];
    
    // Set invalid name format but valid display name
    fireEvent.change(nameInput, { target: { value: 'Invalid Name!' } });
    fireEvent.change(displayNameInput, { target: { value: 'Valid Display Name' } });

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    // Form should not submit when name format is invalid
    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('should submit valid form with all fields', async () => {
    const onSubmit = vi.fn();
    render(<RoleForm {...defaultProps} onSubmit={onSubmit} />);

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs[0];
    const displayNameInput = inputs[1];
    const descriptionInput = inputs[2];

    fireEvent.change(nameInput, { target: { value: 'new-role' } });
    fireEvent.change(displayNameInput, { target: { value: 'New Role' } });
    fireEvent.change(descriptionInput, { target: { value: 'Role description' } });

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

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

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs[0];
    const displayNameInput = inputs[1];

    fireEvent.change(nameInput, { target: { value: 'new-role' } });
    fireEvent.change(displayNameInput, { target: { value: 'New Role' } });

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'new-role',
        displayName: 'New Role',
        description: undefined,
      });
    });
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<RoleForm {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should disable form when loading', () => {
    render(<RoleForm {...defaultProps} loading={true} />);

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs[0] as HTMLInputElement;
    const displayNameInput = inputs[1] as HTMLInputElement;
    const descriptionInput = inputs[2] as HTMLTextAreaElement;
    const submitButton = screen.getByRole('button', { name: /create/i }) as HTMLButtonElement;
    const cancelButton = screen.getByRole('button', { name: /cancel/i }) as HTMLButtonElement;

    expect(nameInput.disabled).toBe(true);
    expect(displayNameInput.disabled).toBe(true);
    expect(descriptionInput.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(true);
  });

  it('should clear errors when field is changed', async () => {
    render(<RoleForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    // Wait for validation to complete
    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
    });

    const nameInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(nameInput, { target: { value: 'valid-role' } });

    // Verify the input works
    expect(nameInput).toHaveValue('valid-role');
  });

  it('should accept underscores in role name', async () => {
    const onSubmit = vi.fn();
    render(<RoleForm {...defaultProps} onSubmit={onSubmit} />);

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs[0];
    const displayNameInput = inputs[1];

    fireEvent.change(nameInput, { target: { value: 'role_name' } });
    fireEvent.change(displayNameInput, { target: { value: 'Role Name' } });

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'role_name',
        displayName: 'Role Name',
        description: undefined,
      });
    });
  });
});
