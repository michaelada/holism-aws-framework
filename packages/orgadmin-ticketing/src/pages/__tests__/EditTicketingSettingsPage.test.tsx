import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditTicketingSettingsPage from '../EditTicketingSettingsPage';

/**
 * What a club's electronic tickets say, and whether they are issued at all.
 *
 * Two things here are worth pinning. The **payload**: the form holds every
 * field as a string, and the API wants a number for the validity period and
 * nothing at all for the fields left blank — send `""` and the ticket prints an
 * empty heading; send `"30"` and the validity is meaningless. And the
 * **404**: an event that has no ticketing at all must say so specifically,
 * because "failed to load" sends an administrator looking for a network fault
 * that is not there.
 */

const { execute, navigate, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: { eventId: 'ev-1' } as { eventId?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Meath' }, setOrganisation: vi.fn() }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  const { createShellMock } = await import('@aws-web-framework/orgadmin-core/test/shellMock');
  return createShellMock();
});

const CONFIG = {
  generateElectronicTickets: true,
  ticketHeaderText: 'Meath Hunt Pony Club',
  ticketInstructions: 'Show this at the gate',
  ticketFooterText: 'No refunds',
  ticketValidityPeriod: 30,
  ticketBackgroundColor: '#ffffff',
  includeEventLogo: true,
};

const respondWith = (config: unknown = CONFIG, sales: unknown = { eventName: 'Winter Dressage' }) => {
  execute.mockImplementation(async ({ url, method }: { url: string; method: string }) => {
    if (method === 'GET' && url.includes('/ticketing-config')) return config;
    if (method === 'GET' && url.includes('/ticket-sales')) return sales;
    return {};
  });
};

/** The body of the most recent PUT. */
const savedPayload = () => {
  const puts = execute.mock.calls.map((c) => c[0]).filter((a) => a?.method === 'PUT');
  return puts[puts.length - 1]?.data;
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <EditTicketingSettingsPage />
    </MemoryRouter>
  );

beforeEach(() => {
  /*
   * Fake timers, because a successful save schedules `navigate` 500ms later.
   * Left real, that timer outlives its own test and fires during the next one —
   * which made the failed-save test see a navigation it had not caused.
   */
  vi.useFakeTimers({ shouldAdvanceTime: true });
  execute.mockReset();
  navigate.mockReset();
  params.current = { eventId: 'ev-1' };
  respondWith();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EditTicketingSettingsPage — loading', () => {
  it('fetches the configuration for the event in the route', async () => {
    renderPage();

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/orgadmin/events/ev-1/ticketing-config',
      })
    );
  });

  it('opens with what the club already saved', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByDisplayValue('Meath Hunt Pony Club')).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue('Show this at the gate')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });

  /*
   * The event name comes from a second request that is allowed to fail — it is
   * a heading, not a setting. Losing it must not lose the form.
   */
  it('still shows the form when the event name cannot be fetched', async () => {
    execute.mockImplementation(async ({ url }: { url: string }) => {
      if (url.includes('/ticket-sales')) throw new Error('network');
      return CONFIG;
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByDisplayValue('Meath Hunt Pony Club')).toBeInTheDocument()
    );
  });

  it('fills in sensible blanks for a configuration that has never been set', async () => {
    respondWith({});

    renderPage();

    await waitFor(() => expect(execute).toHaveBeenCalled());
    // Not "undefined" in the boxes, and a real colour rather than an empty one.
    expect(screen.queryByDisplayValue('undefined')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('#ffffff')).toBeInTheDocument();
  });

  it('says the event is not ticketed when the API answers 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue({ status: 404 });

    renderPage();

    // Distinct from a network failure: the administrator is on the wrong event,
    // not looking at a broken system.
    await waitFor(() => expect(screen.getByText(/invalid|not.*ticket/i)).toBeInTheDocument());
  });

  it('reports an ordinary failure differently from a 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    execute.mockRejectedValue(new Error('network'));

    renderPage();

    await waitFor(() => expect(screen.getByText(/failed|error/i)).toBeInTheDocument());
  });

  it('asks for nothing when the route carries no event', async () => {
    params.current = {};

    renderPage();

    await new Promise((r) => setTimeout(r, 20));
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('EditTicketingSettingsPage — saving', () => {
  it('sends the validity period as a number, not the string the form holds', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    expect(savedPayload().ticketValidityPeriod).toBe(30);
    expect(typeof savedPayload().ticketValidityPeriod).toBe('number');
  });

  it('omits an empty validity period rather than sending an unparseable one', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    // `parseInt("")` is NaN, which serialises to null and means nothing.
    expect(savedPayload().ticketValidityPeriod).toBeUndefined();
  });

  it('omits the text fields that were cleared, so a ticket prints no empty heading', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('Meath Hunt Pony Club')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByDisplayValue('Meath Hunt Pony Club'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    expect(savedPayload().ticketHeaderText).toBeUndefined();
  });

  it('keeps the text a club typed', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('Show this at the gate')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByDisplayValue('Show this at the gate'), {
      target: { value: 'Bring photo ID' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(savedPayload()?.ticketInstructions).toBe('Bring photo ID'));
  });

  it('puts to the event it loaded, not to a new record', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/api/orgadmin/events/ev-1/ticketing-config',
        })
      )
    );
  });

  it('says it saved, then returns to the overview', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // The redirect is deliberately delayed so the confirmation is readable.
    expect(navigate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(navigate).toHaveBeenCalledWith('/tickets');
  });

  it('says it did not save, and stays on the form', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());

    execute.mockRejectedValue(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    // A failed save that navigates away looks exactly like a successful one.
    expect(navigate).not.toHaveBeenCalled();
  });
});
