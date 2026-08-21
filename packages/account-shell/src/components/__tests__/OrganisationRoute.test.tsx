import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrganisationRoute from '../OrganisationRoute';
import { renderWithProviders, TEST_ME, TEST_PUBLIC_DETAIL } from '../../test/renderWithProviders';
import { AccountApiError } from '../../hooks/useAccountApi';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
const authState = { authenticated: true, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };

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

// Partial: `AuthContext` itself must survive, or the shared test
// harness has no provider to render and every page using the session
// throws.
vi.mock('../../context/AuthContext', async () => ({
  ...(await vi.importActual<typeof import('../../context/AuthContext')>('../../context/AuthContext')),
  useAuthContext: () => authState,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

/** Answer the public lookup always; answer /me with the given outcome. */
const meResolvesTo = (me: unknown | Error) => {
  mockExecute.mockImplementation((request: { url: string }) =>
    request.url.startsWith('/api/public/')
      ? Promise.resolve(TEST_PUBLIC_DETAIL)
      : me instanceof Error
        ? Promise.reject(me)
        : Promise.resolve(me)
  );
};

const renderRoute = (requireConnection = true) =>
  renderWithProviders(
    <OrganisationRoute requireConnection={requireConnection}>
      <div>The app</div>
    </OrganisationRoute>
  );

/**
 * This component is the only place that turns a resolved organisation into a
 * screen, so these tests describe the whole of that mapping. Getting one branch
 * wrong sends a member somewhere that cannot help them, with no error raised.
 */
describe('OrganisationRoute', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockNavigate.mockReset();
    authState.authenticated = true;
    authState.loading = false;
  });

  it('renders the app to a member of the club', async () => {
    meResolvesTo(TEST_ME);
    renderRoute();

    expect(await screen.findByText('The app')).toBeInTheDocument();
  });

  it('shows the public gateway to a signed-out visitor', async () => {
    authState.authenticated = false;
    meResolvesTo(TEST_ME);
    renderRoute();

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('The app')).not.toBeInTheDocument();
  });

  it('waits for the session check before deciding anything', () => {
    authState.loading = true;
    meResolvesTo(TEST_ME);
    renderRoute();

    // Routing before the silent SSO check settles would bounce a signed-in
    // member to the public gateway for a moment on every page load.
    expect(screen.queryByText('The app')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('offers to join when the member is signed in but unknown to the club', async () => {
    meResolvesTo(new AccountApiError('no', 403, 'NOT_CONNECTED'));
    renderRoute();

    expect(await screen.findByText(/do not have a .* account yet/i)).toBeInTheDocument();
  });

  it('shows the wait screen to a member pending approval', async () => {
    meResolvesTo(new AccountApiError('no', 403, 'PENDING_APPROVAL'));
    renderRoute();

    expect(await screen.findByText('Awaiting approval')).toBeInTheDocument();
    expect(screen.queryByText('The app')).not.toBeInTheDocument();
  });

  it('keeps a rejected member out of the app', async () => {
    meResolvesTo(new AccountApiError('no', 403, 'REGISTRATION_REJECTED'));
    renderRoute();

    expect(await screen.findByText('Request not approved')).toBeInTheDocument();
    expect(screen.queryByText('The app')).not.toBeInTheDocument();
  });

  it('keeps a deactivated member out of the app', async () => {
    meResolvesTo(new AccountApiError('no', 403, 'ACCOUNT_INACTIVE'));
    renderRoute();

    expect(await screen.findByText('Your account is inactive')).toBeInTheDocument();
    expect(screen.queryByText('The app')).not.toBeInTheDocument();
  });

  /**
   * The registration and awaiting-approval screens exist *because* the member
   * is not connected. Gating them on connection would replace each with the
   * not-connected screen that links to them — "Create an account" would loop
   * straight back to itself.
   */
  it('lets a standalone screen render for a member who is not connected', async () => {
    meResolvesTo(new AccountApiError('no', 403, 'NOT_CONNECTED'));
    renderRoute(false);

    expect(await screen.findByText('The app')).toBeInTheDocument();
    expect(screen.queryByText(/do not have a .* account yet/i)).not.toBeInTheDocument();
  });

  it('still sends an anonymous visitor to sign in before a standalone screen', async () => {
    authState.authenticated = false;
    meResolvesTo(TEST_ME);
    renderRoute(false);

    // Connecting to a club requires an identity to connect, so the gateway
    // still comes first.
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('The app')).not.toBeInTheDocument();
  });

  it('offers the directory when the code matches no organisation', async () => {
    const user = userEvent.setup();
    mockExecute.mockImplementation((request: { url: string }) =>
      request.url.startsWith('/api/public/')
        ? Promise.reject(new AccountApiError('gone', 404, 'ORGANISATION_UNAVAILABLE'))
        : Promise.reject(new AccountApiError('gone', 404, 'ORGANISATION_UNAVAILABLE'))
    );
    renderRoute();

    expect(
      await screen.findByText('We could not find that organisation')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Browse organisations' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('never renders the app for any state other than connected', async () => {
    for (const code of [
      'NOT_CONNECTED',
      'PENDING_APPROVAL',
      'REGISTRATION_REJECTED',
      'ACCOUNT_INACTIVE',
      'ORGANISATION_UNAVAILABLE',
    ]) {
      mockExecute.mockReset();
      meResolvesTo(new AccountApiError('no', 403, code));
      const { unmount } = renderRoute();

      await waitFor(() => expect(screen.queryByText('The app')).not.toBeInTheDocument());
      unmount();
    }
  });
});
