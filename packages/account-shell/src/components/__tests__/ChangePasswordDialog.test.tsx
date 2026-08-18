import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordDialog } from '../ChangePasswordDialog';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AccountApiError } from '../../hooks/useAccountApi';

const mockExecute = vi.fn();

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({
      execute: mockExecute,
      loading: false,
      error: null,
      reset: () => undefined,
    }),
  };
});

/**
 * P4 — changing a password in the app rather than on Keycloak's own pages.
 *
 * The rules belong to the realm, so almost nothing is validated here. What this
 * pins is the small set of things the dialog *is* responsible for: that the
 * current password is required, that the two new fields must agree, and that
 * whatever the server says comes through unaltered — a member told "that didn't
 * work" when their new password was merely too short goes off to reset a
 * password they knew perfectly well.
 */
describe('ChangePasswordDialog', () => {
  const onClose = vi.fn();
  const onChanged = vi.fn();

  const render = () =>
    renderWithProviders(
      <ChangePasswordDialog open orgCode="khpc" onClose={onClose} onChanged={onChanged} />
    );

  const type = async (label: RegExp, value: string) => {
    await userEvent.type(screen.getByLabelText(label), value);
  };

  beforeEach(() => {
    mockExecute.mockReset();
    onClose.mockReset();
    onChanged.mockReset();
    mockExecute.mockResolvedValue(undefined);
  });

  it('sends the current and the new password', async () => {
    render();

    await type(/^current password/i, 'hunter2');
    await type(/^new password/i, 'a-longer-one');
    await type(/^confirm new password/i, 'a-longer-one');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/account/khpc/profile/password',
        data: { currentPassword: 'hunter2', newPassword: 'a-longer-one' },
      })
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('will not submit until the two new passwords agree', async () => {
    render();

    await type(/^current password/i, 'hunter2');
    await type(/^new password/i, 'a-longer-one');
    await type(/^confirm new password/i, 'a-longer-typo');

    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
    expect(screen.getByText('These do not match.')).toBeInTheDocument();
  });

  it('will not submit without the current password', async () => {
    // It is what authorises the change, not a formality.
    render();

    await type(/^new password/i, 'a-longer-one');
    await type(/^confirm new password/i, 'a-longer-one');

    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
  });

  it('shows the realm’s own complaint rather than a message of its own', async () => {
    /*
     * A realm can require length, digits, mixed case or no reuse of the last N,
     * and can be tightened without this component being touched. Substituting
     * our own wording would eventually describe rules that no longer apply.
     */
    mockExecute.mockRejectedValue(
      new AccountApiError('Invalid password: must contain at least one number', 400)
    );
    render();

    await type(/^current password/i, 'hunter2');
    await type(/^new password/i, 'nodigits');
    await type(/^confirm new password/i, 'nodigits');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(
      await screen.findByText('Invalid password: must contain at least one number')
    ).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('distinguishes a wrong current password from a refused new one', async () => {
    mockExecute.mockRejectedValue(new AccountApiError('That is not your current password', 400));
    render();

    await type(/^current password/i, 'wrong');
    await type(/^new password/i, 'a-longer-one');
    await type(/^confirm new password/i, 'a-longer-one');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('That is not your current password')).toBeInTheDocument();
  });

  it('says the change applies to every club', async () => {
    // One identity spans them all, and it is said before they commit.
    render();

    expect(
      screen.getByText('This changes how you sign in to every club you belong to.')
    ).toBeInTheDocument();
  });

  it('forgets what was typed when it closes', async () => {
    /*
     * Three password fields left populated behind a closed dialog is a
     * credential sitting in component state for the rest of the session.
     */
    render();
    await type(/^current password/i, 'hunter2');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByLabelText(/^current password/i)).toHaveValue('');
  });
});
