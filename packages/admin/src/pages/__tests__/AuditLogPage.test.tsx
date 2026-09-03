import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * The platform-wide audit trail.
 *
 * The filters live in the URL rather than in component state, which is the
 * point of most of these tests: an investigation is something you send to
 * somebody else, and a screen whose filters cannot be linked to is a screen
 * where the answer has to be re-found by hand.
 *
 * The health banner matters for the opposite reason. A failed audit write is
 * deliberately silent — `record()` never throws, because the log must not break
 * the thing it audits — so the *only* place that gap becomes visible is here.
 * A missing banner is an audit trail with holes nobody knows about.
 */

const api = vi.hoisted(() => ({
  getAuditEvents: vi.fn(),
  getAuditFilters: vi.fn(),
  getAuditHealth: vi.fn(),
}));

const notify = vi.hoisted(() => ({ showError: vi.fn(), showSuccess: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
const searchParams = vi.hoisted(() => ({ current: new URLSearchParams(), set: vi.fn() }));

vi.mock('../../services/auditApi', () => api);
vi.mock('../../context/NotificationContext', () => ({ useNotification: () => notify }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [
    searchParams.current,
    (next: URLSearchParams) => {
      searchParams.current = next;
      searchParams.set(next);
    },
  ],
}));
vi.mock('../../components/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('@itsplainsailing/components', async () => ({
  // The label maps are real — the page renders actions through them.
  ...(await vi.importActual<Record<string, unknown>>('../../../../components/src/utils/auditLabels')),
  AuditChanges: () => <div data-testid="changes" />,
}));

import { AuditLogPage } from '../AuditLogPage';

const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  occurredAt: '2026-08-21T10:10:33Z',
  actorKeycloakUserId: 'kc-1',
  actorDisplay: 'Aoife Byrne',
  actorEmail: 'admin@kildarehunt.test',
  actorUserType: 'org-admin',
  organisationId: 'org-1',
  organisationName: 'Kildare Hunt Pony Club',
  category: 'settings',
  action: 'settings.branding-updated',
  outcome: 'success',
  entityType: 'branding-settings',
  entityLabel: 'Branding',
  changes: null,
  context: null,
  ...over,
});

/** The last query the page actually sent. */
const lastQuery = () =>
  api.getAuditEvents.mock.calls[api.getAuditEvents.mock.calls.length - 1][0];

beforeEach(() => {
  vi.clearAllMocks();
  searchParams.current = new URLSearchParams();
  api.getAuditEvents.mockResolvedValue({ events: [event()], nextCursor: null });
  api.getAuditFilters.mockResolvedValue({
    categories: ['settings', 'security'],
    actions: ['settings.branding-updated'],
    userTypes: ['org-admin'],
    organisations: [],
    earliest: '2026-08-01T00:00:00Z',
  });
  api.getAuditHealth.mockResolvedValue({ failures: 0, lastFailureAt: null });
});

describe('the list', () => {
  it('shows who did what, and to which club', async () => {
    render(<AuditLogPage />);

    expect(await screen.findByText('Aoife Byrne')).toBeInTheDocument();
    expect(screen.getByText('Branding changed')).toBeInTheDocument();
    expect(screen.getByText('Kildare Hunt Pony Club')).toBeInTheDocument();
  });

  it('opens the event when a row is clicked', async () => {
    render(<AuditLogPage />);
    fireEvent.click(await screen.findByText('Aoife Byrne'));

    expect(navigate).toHaveBeenCalledWith('/audit/e1');
  });

  it('reports a failed load instead of showing an empty trail', async () => {
    api.getAuditEvents.mockRejectedValue(new Error('500'));
    render(<AuditLogPage />);

    await waitFor(() => expect(notify.showError).toHaveBeenCalled());
  });
});

describe('filters live in the URL', () => {
  it('starts from the query string, so a filtered view can be linked to', async () => {
    searchParams.current = new URLSearchParams('actor=kc-9');
    render(<AuditLogPage />);

    await waitFor(() => expect(lastQuery()).toMatchObject({ actor: 'kc-9' }));
  });

  it('carries a repeated filter as repeated keys', async () => {
    // `?category=settings&category=security` — what the server's list() reads.
    searchParams.current = new URLSearchParams('category=settings&category=security');
    render(<AuditLogPage />);

    await waitFor(() => expect(lastQuery().category).toEqual(['settings', 'security']));
  });

  it('writes a submitted search back to the URL', async () => {
    render(<AuditLogPage />);
    await screen.findByText('Aoife Byrne');

    fireEvent.change(screen.getByPlaceholderText(/Search/i), {
      target: { value: 'KHP-0241' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Search/i), { key: 'Enter' });

    await waitFor(() => expect(searchParams.set).toHaveBeenCalled());
    expect(searchParams.current.get('q')).toBe('KHP-0241');
  });

  it('does not query on every keystroke', async () => {
    render(<AuditLogPage />);
    await screen.findByText('Aoife Byrne');
    api.getAuditEvents.mockClear();

    fireEvent.change(screen.getByPlaceholderText(/Search/i), { target: { value: 'KHP' } });

    expect(api.getAuditEvents).not.toHaveBeenCalled();
  });
});

describe('the health banner', () => {
  it('says nothing when nothing has failed', async () => {
    render(<AuditLogPage />);
    await screen.findByText('Aoife Byrne');

    expect(screen.queryByText(/audit write/i)).not.toBeInTheDocument();
  });

  it('surfaces failed writes, because they are silent everywhere else', async () => {
    api.getAuditHealth.mockResolvedValue({
      failures: 3,
      lastFailureAt: '2026-08-21T09:00:00Z',
    });

    render(<AuditLogPage />);

    expect(await screen.findByText(/3 audit writes failed/)).toBeInTheDocument();
  });

  it('says "write" rather than "writes" for one', async () => {
    api.getAuditHealth.mockResolvedValue({ failures: 1, lastFailureAt: null });
    render(<AuditLogPage />);

    expect(await screen.findByText(/1 audit write failed/)).toBeInTheDocument();
  });

  it('stays quiet when health itself cannot be read', async () => {
    api.getAuditHealth.mockRejectedValue(new Error('404'));
    render(<AuditLogPage />);
    await screen.findByText('Aoife Byrne');

    expect(screen.queryByText(/audit write/i)).not.toBeInTheDocument();
  });
});

describe('paging', () => {
  it('appends older events rather than replacing the page', async () => {
    api.getAuditEvents.mockResolvedValueOnce({ events: [event()], nextCursor: 'c1' });
    render(<AuditLogPage />);

    const older = await screen.findByText(/Load older/i);

    api.getAuditEvents.mockResolvedValueOnce({
      events: [event({ id: 'e2', action: 'auth.login' })],
      nextCursor: null,
    });
    fireEvent.click(older);

    await waitFor(() => expect(screen.getByText('Signed in')).toBeInTheDocument());
    expect(screen.getByText('Branding changed')).toBeInTheDocument();
  });

  it('passes the cursor, not an offset', async () => {
    // Keyset paging: an offset would skip or repeat rows as new events arrive
    // underneath, which on an append-only log is constantly.
    api.getAuditEvents.mockResolvedValueOnce({ events: [event()], nextCursor: 'c1' });
    render(<AuditLogPage />);

    fireEvent.click(await screen.findByText(/Load older/i));

    await waitFor(() => expect(lastQuery()).toMatchObject({ cursor: 'c1' }));
  });
});
