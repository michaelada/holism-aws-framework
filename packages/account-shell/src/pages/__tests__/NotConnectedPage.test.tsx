import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotConnectedPage from '../NotConnectedPage';
import { renderWithProviders } from '../../test/renderWithProviders';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('NotConnectedPage (A6)', () => {
  beforeEach(() => mockNavigate.mockReset());

  it('explains that sign-in worked and the club simply has no record', () => {
    renderWithProviders(<NotConnectedPage />);

    // Without this, a successful sign-in that lands nowhere reads as a broken
    // login and members retry their password instead of asking to join.
    expect(screen.getByText(/sign-in worked/i)).toBeInTheDocument();
  });

  it('offers to request a connection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotConnectedPage />);

    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/register');
  });

  /*
   * The reported fault. A member signs out of one club, opens another, and is
   * still whoever Keycloak's realm-wide session says they are — so they arrive
   * here and are offered enrolment under an identity they had already left.
   *
   * This screen renders outside `AppShell`, so it has no navigation and no
   * sign-out: before this there was no way to become anybody else from here at
   * all.
   */
  it('offers to sign in as somebody else', async () => {
    const signInAsSomeoneElse = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<NotConnectedPage />, { auth: { signInAsSomeoneElse } });

    await user.click(screen.getByRole('button', { name: /sign in as someone else/i }));

    // Returned to this club, so a member who does belong under their other
    // identity lands where they were trying to go.
    expect(signInAsSomeoneElse).toHaveBeenCalledWith('khpc');
  });

  it('offers to sign out, as wireframe A6 specifies', async () => {
    const logout = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<NotConnectedPage />, { auth: { logout } });

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(logout).toHaveBeenCalled();
  });

  it('offers a way to a club the member already belongs to', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotConnectedPage />);

    await user.click(screen.getByRole('button', { name: /go to one of your organisations/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/switch');
  });

  it('does not offer signing in again, which would land in the same place', () => {
    renderWithProviders(<NotConnectedPage />);
    expect(screen.queryByRole('button', { name: /^sign in$/i })).not.toBeInTheDocument();
  });
});
