import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';
import { StatusChip } from '../StatusChip';

describe('ConfirmDialog', () => {
  const base = {
    open: true,
    title: 'Delete this organisation?',
    message: 'Killarney Sailing Club will be removed.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('states the action and its consequences', () => {
    render(
      <ConfirmDialog
        {...base}
        consequences="This reaches 214 members and their payment history."
      />
    );
    expect(screen.getByText(/Killarney Sailing Club will be removed/)).toBeInTheDocument();
    expect(screen.getByText(/214 members/)).toBeInTheDocument();
  });

  it('confirms immediately when no phrase is required', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} confirmLabel="Delete" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('holds the confirm button closed until the phrase matches', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        {...base}
        onConfirm={onConfirm}
        confirmLabel="Delete"
        confirmPhrase="Killarney Sailing Club"
      />
    );

    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type Killarney Sailing Club to confirm/i), {
      target: { value: 'Killarney' },
    });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type Killarney Sailing Club to confirm/i), {
      target: { value: 'Killarney Sailing Club' },
    });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
  });

  it('cancels without acting', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('locks both buttons while the action is running, so it cannot be fired twice', () => {
    render(<ConfirmDialog {...base} busy confirmLabel="Delete" />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

describe('StatusChip', () => {
  it('presents a known status in sentence case', () => {
    render(<StatusChip status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('names an unrecognised status instead of showing it as inactive', () => {
    // `inactive` and an unknown status both used to render the same neutral
    // chip, so a build out of step with the backend was indistinguishable from
    // a club that had simply been switched off.
    render(<StatusChip status="archived" />);
    expect(screen.getByText('Unknown: archived')).toBeInTheDocument();
  });

  it('treats the retired "blocked" value as unrecognised rather than silently mapping it', () => {
    // The migration renames every blocked organisation to inactive. If one
    // still turns up, it means data the UI does not expect — which is exactly
    // what "unknown" is for, and better than quietly showing it as inactive.
    render(<StatusChip status="blocked" />);
    expect(screen.getByText('Unknown: blocked')).toBeInTheDocument();
  });

  it('distinguishes inactive from unknown', () => {
    const { rerender } = render(<StatusChip status="inactive" />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    rerender(<StatusChip status="archived" />);
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('handles a missing status', () => {
    render(<StatusChip status={null} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });
});
