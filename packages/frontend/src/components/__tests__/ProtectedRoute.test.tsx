import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from '../ProtectedRoute';

/**
 * The gate in front of every metadata screen.
 *
 * There are three states and only one of them may render the children. The one
 * that matters is *loading*: treated as "not authenticated" it flashes a
 * redirect at every reload, and treated as "authenticated" it renders the app
 * to someone who has not signed in yet. Both are easy to write and neither is
 * visible in a screenshot.
 */

const { auth } = vi.hoisted(() => ({
  auth: { current: { authenticated: false, loading: true } },
}));

vi.mock('../../context', () => ({
  useAuth: () => auth.current,
}));

const Secret = () => <div data-testid="secret">Object definitions</div>;

const renderGate = () =>
  render(
    <ProtectedRoute>
      <Secret />
    </ProtectedRoute>
  );

beforeEach(() => {
  auth.current = { authenticated: false, loading: true };
});

describe('ProtectedRoute', () => {
  it('shows the children once the visitor is known to be signed in', () => {
    auth.current = { authenticated: true, loading: false };

    renderGate();

    expect(screen.getByTestId('secret')).toBeInTheDocument();
  });

  it('withholds the children while it is still finding out', () => {
    auth.current = { authenticated: false, loading: true };

    renderGate();

    // Rendering the app during the check shows metadata to someone who may
    // turn out not to be signed in at all.
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not announce a redirect while it is still finding out', () => {
    auth.current = { authenticated: false, loading: true };

    renderGate();

    // A "redirecting" message during a routine check makes every reload look
    // like a session that has expired.
    expect(screen.queryByText(/redirecting/i)).not.toBeInTheDocument();
  });

  it('says what is happening when the visitor is not signed in', () => {
    auth.current = { authenticated: false, loading: false };

    renderGate();

    expect(screen.getByText(/redirecting/i)).toBeInTheDocument();
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
  });

  it('withholds the children even if loading finishes while unauthenticated', () => {
    auth.current = { authenticated: false, loading: false };

    renderGate();

    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
  });

  it('lets a still-loading but authenticated session wait rather than render early', () => {
    // Keycloak can report a token before the check completes; the gate must
    // follow `loading`, not race it.
    auth.current = { authenticated: true, loading: true };

    renderGate();

    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
