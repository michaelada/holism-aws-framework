import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeEmailDialog } from '../ChangeEmailDialog';
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
 * P5 — asking to change an email address.
 *
 * The member's Keycloak username *is* their email, so this dialog must not
 * imply the change has happened. It asks the server to send a link; the address
 * moves only when that link is followed. A member who closes this believing
 * they are done will try to sign in with an address that does not work yet.
 */
describe('ChangeEmailDialog', () => {
  const onClose = vi.fn();

  const render = (currentEmail = 'ada@example.com') =>
    renderWithProviders(
      <ChangeEmailDialog open orgCode="khpc" currentEmail={currentEmail} onClose={onClose} />
    );

  const fillIn = async (email: string, password = 'hunter2') => {
    await userEvent.type(screen.getByLabelText(/^new email address/i), email);
    await userEvent.type(screen.getByLabelText(/^current password/i), password);
  };

  beforeEach(() => {
    mockExecute.mockReset();
    onClose.mockReset();
    mockExecute.mockResolvedValue({ sentTo: 'new@example.com' });
  });

  it('asks for the link and never for the change itself', async () => {
    render();
    await fillIn('new@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send the link' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/account/khpc/profile/email',
        data: { currentPassword: 'hunter2', newEmail: 'new@example.com' },
      })
    );
  });

  it('says plainly that nothing has changed yet', async () => {
    render();

    expect(
      screen.getByText(
        "You sign in with this address, so we'll send a link to the new one to check it reaches you. Nothing changes until you follow it."
      )
    ).toBeInTheDocument();
  });

  it('confirms where the link went, and how long it lasts', async () => {
    render();
    await fillIn('new@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send the link' }));

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(screen.getByText("We've sent a link to new@example.com.")).toBeInTheDocument();
    expect(
      screen.getByText(
        'Follow it within an hour to finish the change. Until then you sign in with your current address as usual.'
      )
    ).toBeInTheDocument();
  });

  it('says nothing about whether the address was already taken', async () => {
    /*
     * The disclosure guard, at the screen as well as in the service. The server
     * answers identically either way; a dialog that reported a clash would give
     * back exactly what the identical response exists to withhold.
     */
    mockExecute.mockResolvedValue({ sentTo: 'taken@example.com' });
    render();
    await fillIn('taken@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send the link' }));

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(screen.queryByText(/already/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/in use/i)).not.toBeInTheDocument();
  });

  it('will not send to the address the member already has', async () => {
    render('ada@example.com');
    await userEvent.type(screen.getByLabelText(/^new email address/i), 'ADA@example.com');
    await userEvent.type(screen.getByLabelText(/^current password/i), 'hunter2');

    // Case-insensitively: a Keycloak username is matched lowercase, so
    // "ADA@example.com" is the same login, not a new one.
    expect(screen.getByRole('button', { name: 'Send the link' })).toBeDisabled();
    expect(screen.getByText('That is already your email address.')).toBeInTheDocument();
  });

  it('will not send without the current password', async () => {
    render();
    await userEvent.type(screen.getByLabelText(/^new email address/i), 'new@example.com');

    expect(screen.getByRole('button', { name: 'Send the link' })).toBeDisabled();
  });

  it('shows the server’s refusal and stays open to be corrected', async () => {
    mockExecute.mockRejectedValue(new AccountApiError('That is not your current password', 400));
    render();
    await fillIn('new@example.com', 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Send the link' }));

    expect(await screen.findByText('That is not your current password')).toBeInTheDocument();
    expect(screen.getByLabelText(/^new email address/i)).toHaveValue('new@example.com');
  });

  it('forgets the password when it closes', async () => {
    render();
    await fillIn('new@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByLabelText(/^current password/i)).toHaveValue('');
  });
});
