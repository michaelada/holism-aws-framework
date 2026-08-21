import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

/**
 * Who is signed in right now.
 *
 * Two things here are easy to get subtly wrong and expensive when they are.
 *
 * The first is that **each row is a session, not a person**: somebody on a
 * phone and a laptop is two rows, which is what makes "end this session" and
 * "sign them out everywhere" different actions rather than two words for one.
 *
 * The second is the wording. Ending a Keycloak session stops the refresh, but
 * an access token already issued stays valid for its remaining lifetime. The
 * dialog must say "within 5 minutes", not "now" — an overstatement that matters
 * exactly when somebody is relying on it.
 */

const api = vi.hoisted(() => ({
  getSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

const notify = vi.hoisted(() => ({ showError: vi.fn(), showSuccess: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('../../services/auditApi', () => api);
vi.mock('../../context/NotificationContext', () => ({ useNotification: () => notify }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../components/PageHeader', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

import { SessionsPage } from '../SessionsPage';

const session = (over: Record<string, unknown> = {}) => ({
  sessionId: 's1',
  keycloakUserId: 'kc-1',
  username: 'aoife',
  displayName: 'Aoife Byrne',
  email: 'admin@kildarehunt.test',
  userType: 'org-admin',
  organisationName: 'Kildare Hunt Pony Club',
  application: 'Org Admin',
  ipAddress: '10.0.0.1',
  startedAt: '2026-08-21T09:00:00Z',
  lastAccessAt: new Date().toISOString(),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.getSessions.mockResolvedValue([session()]);
  api.revokeSession.mockResolvedValue(undefined);
  api.revokeAllSessions.mockResolvedValue(undefined);
});

describe('the list', () => {
  it('reads through to Keycloak on every load, keeping no copy', async () => {
    // A second copy would be wrong the moment somebody signed out.
    render(<SessionsPage />);
    await waitFor(() => expect(api.getSessions).toHaveBeenCalled());
  });

  it('shows one row per session, not per person', async () => {
    api.getSessions.mockResolvedValue([
      session({ sessionId: 's1', application: 'Org Admin' }),
      session({ sessionId: 's2', application: 'Account' }),
    ]);

    render(<SessionsPage />);

    expect(await screen.findByText(/2 sessions/)).toBeInTheDocument();
    expect(screen.getAllByText('Aoife Byrne')).toHaveLength(2);
  });

  it('says nobody is signed in rather than showing an empty table', async () => {
    api.getSessions.mockResolvedValue([]);
    render(<SessionsPage />);

    expect(await screen.findByText('Nobody is signed in')).toBeInTheDocument();
  });

  it('distinguishes a failed read from an empty one', async () => {
    api.getSessions.mockRejectedValue(new Error('Keycloak unreachable'));
    render(<SessionsPage />);

    expect(await screen.findByText(/could not be read from Keycloak/)).toBeInTheDocument();
  });

  it('falls back to the username when there is no display name', async () => {
    api.getSessions.mockResolvedValue([
      session({ displayName: null, username: 'aoife', email: 'admin@kildarehunt.test' }),
    ]);

    render(<SessionsPage />);
    expect(await screen.findByText('aoife')).toBeInTheDocument();
  });

  it('falls back to the email when there is neither', async () => {
    // The email then appears as both the name and the contact line, which is
    // the honest rendering: it is the only identifier we have.
    api.getSessions.mockResolvedValue([
      session({ displayName: null, username: null, email: 'someone@example.test' }),
    ]);

    render(<SessionsPage />);
    expect((await screen.findAllByText('someone@example.test')).length).toBeGreaterThan(0);
  });
});

describe('filters', () => {
  it('narrows to one organisation', async () => {
    api.getSessions.mockResolvedValue([
      session({ sessionId: 's1', organisationName: 'Kildare Hunt Pony Club' }),
      session({ sessionId: 's2', organisationName: 'Meath Hunt', displayName: 'Deirdre' }),
    ]);

    render(<SessionsPage />);
    await screen.findByText(/2 sessions/);

    fireEvent.mouseDown(screen.getByLabelText('Organisation'));
    fireEvent.click(within(await screen.findByRole('listbox')).getByText('Meath Hunt'));

    await waitFor(() => expect(screen.getByText(/1 session$/)).toBeInTheDocument());
    expect(screen.queryByText('Aoife Byrne')).not.toBeInTheDocument();
  });
});

describe('ending a session', () => {
  it('asks first, and does nothing until it is confirmed', async () => {
    render(<SessionsPage />);

    fireEvent.click(await screen.findByLabelText(/End this session for Aoife Byrne/));

    expect(await screen.findByText('End this session?')).toBeInTheDocument();
    expect(api.revokeSession).not.toHaveBeenCalled();
  });

  it('says within 5 minutes, never now', async () => {
    /*
     * The Keycloak session ends immediately; an access token already issued
     * does not. Saying "now" would be wrong in the one situation where the
     * difference matters.
     */
    render(<SessionsPage />);
    fireEvent.click(await screen.findByLabelText(/End this session for Aoife Byrne/));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/within 5 minutes/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/signed out now/)).not.toBeInTheDocument();
  });

  it('warns that unfinished work is kept', async () => {
    render(<SessionsPage />);
    fireEvent.click(await screen.findByLabelText(/End this session for Aoife Byrne/));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/a form, a basket — is kept/)).toBeInTheDocument();
  });

  it('ends that one session, not every session', async () => {
    render(<SessionsPage />);
    fireEvent.click(await screen.findByLabelText(/End this session for Aoife Byrne/));
    fireEvent.click(await screen.findByText('End session'));

    await waitFor(() => expect(api.revokeSession).toHaveBeenCalledWith('s1'));
    expect(api.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('signs them out everywhere by user, not by session', async () => {
    render(<SessionsPage />);
    fireEvent.click(await screen.findByLabelText(/Sign Aoife Byrne out everywhere/));
    fireEvent.click(await screen.findByText('Sign them out'));

    await waitFor(() => expect(api.revokeAllSessions).toHaveBeenCalledWith('kc-1'));
    expect(api.revokeSession).not.toHaveBeenCalled();
  });

  it('reloads afterwards, so the row goes', async () => {
    render(<SessionsPage />);
    await screen.findByText('Aoife Byrne');
    api.getSessions.mockClear();

    fireEvent.click(screen.getByLabelText(/End this session for Aoife Byrne/));
    fireEvent.click(await screen.findByText('End session'));

    await waitFor(() => expect(api.getSessions).toHaveBeenCalled());
  });

  it('reports a failure rather than pretending it worked', async () => {
    api.revokeSession.mockRejectedValue(new Error('Keycloak refused'));

    render(<SessionsPage />);
    fireEvent.click(await screen.findByLabelText(/End this session for Aoife Byrne/));
    fireEvent.click(await screen.findByText('End session'));

    await waitFor(() => expect(notify.showError).toHaveBeenCalled());
    expect(notify.showSuccess).not.toHaveBeenCalled();
  });
});

describe('following a person into the trail', () => {
  it('links to their audit events by Keycloak id', async () => {
    render(<SessionsPage />);

    fireEvent.click(await screen.findByLabelText(/View the audit trail for Aoife Byrne/));

    expect(navigate).toHaveBeenCalledWith('/audit?actor=kc-1');
  });
});
