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

    await user.click(screen.getByRole('button', { name: /create an account for/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/khpc/register');
  });

  /*
   * Both halves of the identity problem.
   *
   * Keycloak's session is one cookie for the whole realm, shared with the
   * org-admin app, and this shell adopts it silently on load. So a person can
   * arrive here as somebody they never chose to be — an administrator who
   * opened a club link in a second tab, most often. The screen used to describe
   * only the club ("no record of you yet"), which is true and useless: nothing
   * on it said whose account was being talked about.
   */
  it('names the identity it is signed in as', () => {
    renderWithProviders(<NotConnectedPage />);

    expect(screen.getByText(/signed in as sam rivers \(member@example\.com\)/i)).toBeInTheDocument();
  });

  /*
   * And the enrolment button names them too. Unlabelled, "Create an account"
   * enrolled whoever the session happened to be into a club they were only
   * looking at — the one action here that is hard to undo.
   */
  it('says whose account the enrolment button would create', () => {
    renderWithProviders(<NotConnectedPage />);

    const join = screen.getByRole('button', { name: /create an account for/i });
    expect(join).toHaveAccessibleName(expect.stringContaining('member@example.com'));
  });

  it('falls back to the plain label when there is no user to name', () => {
    renderWithProviders(<NotConnectedPage />, { auth: { user: null } });

    expect(screen.getByRole('button', { name: 'Create an account' })).toBeInTheDocument();
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
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
