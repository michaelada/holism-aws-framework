import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventTicketingDetailPage from '../EventTicketingDetailPage';

/**
 * The gate list for one event, rather than for the whole club.
 *
 * It reads a *summary* endpoint — the event's name and its tickets in one
 * response — and refreshes every thirty seconds, because tickets are being
 * scanned while somebody is looking at the page.
 *
 * Two things carry consequence. A 404 means the event does not exist, which is
 * a different problem from the request failing, and telling an operator "try
 * again" for the former sends them round a loop. And selecting tickets for a
 * batch operation must respect the filters: marking a ticket scanned that the
 * operator never had on screen turns a paying guest away at the door.
 */

const { execute, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  params: { current: { eventId: 'ev-1' } as { eventId?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => vi.fn(),
  useParams: () => params.current,
}));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({
    organisation: { id: 'org-1', name: 'Meath' },
    setOrganisation: vi.fn(),
  }),
}));

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  const { createShellMock } = await import('@aws-web-framework/orgadmin-core/test/shellMock');
  return createShellMock();
});

const ticket = (over: Record<string, unknown> = {}) => ({
  id: 't-1',
  ticketReference: 'TKT-0001',
  eventId: 'ev-1',
  eventActivityId: 'act-1',
  customerName: 'Aoife Byrne',
  customerEmail: 'aoife@example.com',
  issueDate: '2026-06-10T10:00:00Z',
  validUntil: '2026-12-31T23:59:59Z',
  status: 'active',
  scanCount: 0,
  qrCode: 'QR-0001',
  scanStatus: 'not_scanned',
  scanDate: null,
  ticketData: { eventName: 'Winter Dressage', activityName: 'Class 3' },
  ...over,
});

const renderPage = async (tickets: unknown[] = [ticket()]) => {
  execute.mockResolvedValue({ eventName: 'Winter Dressage', tickets });
  render(
    <MemoryRouter>
      <EventTicketingDetailPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(execute).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
};

/** The reference cell of each listed ticket — the column after the checkbox. */
const listedRefs = () =>
  Array.from(document.querySelectorAll('tbody tr'))
    .map((r) => r.querySelector('td:nth-child(2)')?.textContent?.trim() ?? '')
    .filter((ref) => ref.startsWith('TKT-'));

const searchFor = (text: string) => {
  const box = Array.from(document.querySelectorAll('input')).find(
    (i) => i.type === 'text' && !i.getAttribute('aria-hidden')
  )!;
  fireEvent.change(box, { target: { value: text } });
};

const dateInput = (index: number) =>
  Array.from(document.querySelectorAll('input[type="date"]'))[index] as HTMLInputElement;

const rowCheckboxes = () =>
  Array.from(document.querySelectorAll('tbody input[type="checkbox"]')) as HTMLInputElement[];

const selectAll = () =>
  fireEvent.click(document.querySelector('thead input[type="checkbox"]') as HTMLElement);

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { eventId: 'ev-1' };
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('EventTicketingDetailPage — loading one event’s tickets', () => {
  it('reads the event’s ticket sales in a single request', async () => {
    await renderPage();

    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/events/ev-1/ticket-sales',
    });
  });

  it('names the event it is showing', async () => {
    await renderPage();

    expect(await screen.findByText(/Winter Dressage/)).toBeInTheDocument();
  });

  it('keeps checking, because tickets are scanned while the page is open', async () => {
    await renderPage();
    const before = execute.mock.calls.length;

    await vi.advanceTimersByTimeAsync(30_000);

    expect(execute.mock.calls.length).toBeGreaterThan(before);
  });

  it('stops checking once the page is left', async () => {
    execute.mockResolvedValue({ eventName: 'Winter Dressage', tickets: [ticket()] });
    const { unmount } = render(
      <MemoryRouter>
        <EventTicketingDetailPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(execute).toHaveBeenCalled());

    unmount();
    const after = execute.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);

    // An interval left running writes into an unmounted tree forever.
    expect(execute.mock.calls.length).toBe(after);
  });

  it('says the event does not exist when the server says so', async () => {
    execute.mockRejectedValue({ response: { status: 404 } });
    render(
      <MemoryRouter>
        <EventTicketingDetailPage />
      </MemoryRouter>
    );

    // "Try again" on a 404 sends the operator round a loop.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('reports an ordinary failure differently', async () => {
    execute.mockRejectedValue(new Error('network down'));
    render(
      <MemoryRouter>
        <EventTicketingDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('asks for nothing when the route names no event', async () => {
    params.current = {};
    render(
      <MemoryRouter>
        <EventTicketingDetailPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(execute).not.toHaveBeenCalled());
  });

  it('copes with an event that has sold no tickets yet', async () => {
    await renderPage([]);

    expect(listedRefs()).toEqual([]);
  });
});

describe('EventTicketingDetailPage — finding a ticket', () => {
  it('matches on the reference', async () => {
    await renderPage([
      ticket({ id: 'a', ticketReference: 'TKT-0001' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', customerEmail: 'cian@example.com' }),
    ]);

    searchFor('0002');

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0002']));
  });

  it('matches on the name, which is what someone at the gate has', async () => {
    await renderPage([
      ticket({ id: 'a', ticketReference: 'TKT-0001', customerName: 'Aoife Byrne', customerEmail: 'aoife@example.com' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', customerName: 'Cian Murphy', customerEmail: 'cian@example.com' }),
    ]);

    searchFor('cian');

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0002']));
  });

  it('drops tickets issued before the date asked for', async () => {
    await renderPage([
      ticket({ id: 'a', ticketReference: 'TKT-OLD', issueDate: '2026-01-05T10:00:00Z' }),
      ticket({ id: 'b', ticketReference: 'TKT-NEW', issueDate: '2026-06-10T10:00:00Z' }),
    ]);

    fireEvent.change(dateInput(0), { target: { value: '2026-06-01' } });

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-NEW']));
  });

  it('drops tickets issued after the date asked for', async () => {
    await renderPage([
      ticket({ id: 'a', ticketReference: 'TKT-OLD', issueDate: '2026-01-05T10:00:00Z' }),
      ticket({ id: 'b', ticketReference: 'TKT-NEW', issueDate: '2026-06-10T10:00:00Z' }),
    ]);

    fireEvent.change(dateInput(1), { target: { value: '2026-02-01' } });

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-OLD']));
  });

  it('narrows to the tickets already scanned', async () => {
    await renderPage([
      ticket({ id: 'a', ticketReference: 'TKT-0001', scanStatus: 'scanned', scanDate: '2026-06-11T09:00:00Z' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', scanStatus: 'not_scanned' }),
    ]);

    const scanStatus = screen.getAllByRole('combobox').at(-1)!;
    fireEvent.mouseDown(scanStatus);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(listbox.querySelector('[data-value="scanned"]')!);
    fireEvent.keyDown(listbox, { key: 'Escape' });

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0001']));
  });
});

/**
 * Getting from the list into one ticket.
 *
 * The table has nine columns, so on anything but a wide screen the only way in
 * — an eye icon in the last of them — was six columns of sideways scrolling
 * away. The name is what a reader is looking at when they decide to open a
 * ticket, so the name opens it. The icon stays: it is where the *Actions*
 * heading says it is, and somebody who has learned it should not have to learn
 * again.
 */
describe('EventTicketingDetailPage — opening a ticket', () => {
  it('opens it from the name', async () => {
    await renderPage([ticket({ customerName: 'Aoife Byrne' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Aoife Byrne' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Aoife Byrne');
  });

  it('keeps the eye icon as well', async () => {
    await renderPage([ticket({ customerName: 'Aoife Byrne' })]);

    // Both ways in, not one instead of the other.
    expect(screen.getByRole('button', { name: 'Aoife Byrne' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view ticket details/i })).toBeInTheDocument();
  });

  it('gives every row its own way in', async () => {
    await renderPage([
      ticket({ id: 'a', ticketReference: 'TKT-0001', customerName: 'Aoife Byrne' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', customerName: 'Cian Murphy' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Cian Murphy' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Cian Murphy');
  });
});

describe('EventTicketingDetailPage — acting on tickets', () => {
  it('offers batch actions only once something is selected', async () => {
    await renderPage();

    expect(screen.queryByRole('button', { name: /mark/i })).not.toBeInTheDocument();

    fireEvent.click(rowCheckboxes()[0]);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /scanned/i }).length).toBeGreaterThan(0)
    );
  });

  /*
   * Select-all works from the filtered list. Picking up tickets the filter is
   * hiding would mark tickets the operator never saw — and a ticket wrongly
   * marked scanned turns a paying guest away at the door.
   */
  it('selects only what the filter left on screen', async () => {
    await renderPage([
      ticket({ id: 'a', ticketReference: 'TKT-0001', customerName: 'Aoife', customerEmail: 'aoife@example.com' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', customerName: 'Cian', customerEmail: 'cian@example.com' }),
    ]);

    searchFor('aoife');
    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0001']));
    selectAll();

    await waitFor(() => expect(rowCheckboxes().filter((b) => b.checked)).toHaveLength(1));
  });

  it('takes a ticket back out of the selection when clicked again', async () => {
    await renderPage();

    fireEvent.click(rowCheckboxes()[0]);
    await waitFor(() => expect(rowCheckboxes()[0]).toBeChecked());
    fireEvent.click(rowCheckboxes()[0]);

    await waitFor(() => expect(rowCheckboxes()[0]).not.toBeChecked());
  });

  it('clears the whole selection when select-all is turned off', async () => {
    await renderPage([ticket({ id: 'a' }), ticket({ id: 'b', ticketReference: 'TKT-0002' })]);

    selectAll();
    await waitFor(() => expect(rowCheckboxes()[0]).toBeChecked());
    selectAll();

    await waitFor(() => rowCheckboxes().forEach((b) => expect(b).not.toBeChecked()));
  });

  it('confirms before marking a selection at the gate', async () => {
    await renderPage();

    fireEvent.click(rowCheckboxes()[0]);
    const mark = (await screen.findAllByRole('button', { name: /scanned/i }))[0];
    fireEvent.click(mark);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('opens the ticket that was clicked', async () => {
    await renderPage([
      ticket({ id: 'a', ticketReference: 'TKT-0001' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', qrCode: 'QR-0002' }),
    ]);

    const secondRow = document.querySelectorAll('tbody tr')[1] as HTMLElement;
    fireEvent.click(within(secondRow).getAllByRole('button')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/TKT-0002/).length).toBeGreaterThan(0);
  });

  it('exports without taking the operator off the page', async () => {
    await renderPage();

    const exportButton = screen
      .getAllByRole('button')
      .find((b) => /export/i.test(b.textContent ?? ''))!;
    fireEvent.click(exportButton);

    // Scoped to this event, not to every ticket the club has ever issued.
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/orgadmin/tickets/export',
        data: { eventId: 'ev-1' },
      })
    );
    expect(listedRefs()).toEqual(['TKT-0001']);
  });

  it('survives an export the server refused', async () => {
    await renderPage();

    execute.mockRejectedValue(new Error('export failed'));
    const exportButton = screen
      .getAllByRole('button')
      .find((b) => /export/i.test(b.textContent ?? ''))!;
    fireEvent.click(exportButton);

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0001']));
  });
});
