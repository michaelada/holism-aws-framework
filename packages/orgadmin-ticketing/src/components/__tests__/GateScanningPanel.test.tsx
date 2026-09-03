import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GateScanningPanel from '../GateScanningPanel';

/**
 * The club's side of gate scanning.
 *
 * Two things matter more than the layout. **The PIN is shown once** — it is in
 * the create response and nowhere else, so a panel that quietly dropped it
 * would leave a club holding a link nobody can open. And **the link points at
 * the host the administrator is actually using**, because a steward opening a
 * link to the wrong origin gets nothing at all.
 */

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@aws-web-framework/orgadmin-shell', async () =>
  (await import('@aws-web-framework/orgadmin-core/test/shellMock')).createShellMock()
);

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: { id: 'org-1' }, setOrganisation: vi.fn() }),
}));

const session = (over: Record<string, unknown> = {}) => ({
  id: 'session-1',
  eventId: 'event-1',
  eventName: 'Autumn Gate Day',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  revokedAt: null,
  createdAt: new Date().toISOString(),
  active: true,
  stewards: [],
  ...over,
});

beforeEach(() => execute.mockReset());

describe('the scanning panel', () => {
  it('shows the link and the PIN once a session is created', async () => {
    execute
      .mockResolvedValueOnce({ sessions: [] })
      .mockResolvedValueOnce({ token: 'link-token', pin: '004821', session: session() })
      .mockResolvedValueOnce({ sessions: [session()] });

    render(<GateScanningPanel eventId="event-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Create a scanning link/i }));

    const link = await screen.findByDisplayValue(
      `${window.location.origin}/account/scan/link-token`
    );
    expect(link).toBeInTheDocument();
    expect(screen.getByText(/004821/)).toBeInTheDocument();
  });

  it('lists who is scanning, and how many each has done', async () => {
    execute.mockResolvedValueOnce({
      sessions: [
        session({
          stewards: [{ name: 'Ann', lastSeenAt: new Date().toISOString(), scans: 37 }],
        }),
      ],
    });

    render(<GateScanningPanel eventId="event-1" />);

    expect(await screen.findByText(/Ann/)).toBeInTheDocument();
    expect(screen.getByText(/37/)).toBeInTheDocument();
  });

  it('stops a live link, and reloads what is left', async () => {
    execute
      .mockResolvedValueOnce({ sessions: [session()] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ sessions: [session({ active: false, revokedAt: new Date().toISOString() })] });

    render(<GateScanningPanel eventId="event-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Stop this link/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'DELETE', url: '/api/orgadmin/scan-sessions/session-1' })
      )
    );
    expect(await screen.findByText(/Ended/i)).toBeInTheDocument();
  });

  it('says so when the link could not be created, rather than looking as if it worked', async () => {
    execute
      .mockResolvedValueOnce({ sessions: [] })
      .mockRejectedValueOnce({ response: { data: { error: 'Event not found' } } });

    render(<GateScanningPanel eventId="event-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Create a scanning link/i }));

    expect(await screen.findByText('Event not found')).toBeInTheDocument();
  });
});
