import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TicketingDashboardPage from '../TicketingDashboardPage';

/**
 * The screen someone works from on the gate.
 *
 * Two things carry real consequence here. The filters decide which tickets are
 * even visible, and the selection decides which tickets a batch operation
 * marks — a ticket wrongly marked scanned turns a paying guest away at the
 * door, and one wrongly marked unscanned lets a used ticket back in.
 *
 * The page also polls every thirty seconds, so a test that lets real timers run
 * has a second load arriving underneath its assertions; the clock is faked.
 */

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: { id: 'org-1', name: 'Meath' }, setOrganisation: vi.fn() }),
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
  qrCode: 'QR-TKT-0001',
  scanStatus: 'not_scanned',
  scanDate: null,
  ticketData: { eventName: 'Winter Dressage', activityName: 'Class 3' },
  ...over,
});

const renderDashboard = async (tickets: unknown[]) => {
  execute.mockResolvedValue(tickets);
  render(<TicketingDashboardPage />);
  await waitFor(() => expect(execute).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
};

/** Ticket references shown in the table body, in order. */
const listedRefs = () =>
  Array.from(document.querySelectorAll('tbody tr'))
    .map((row) => row.querySelector('td:nth-child(2)')?.textContent ?? '')
    .filter((ref) => ref.startsWith('TKT-'));

const searchFor = (text: string) => {
  const search = Array.from(document.querySelectorAll('input')).find(
    (i) => i.type === 'text' && !i.getAttribute('aria-hidden')
  )!;
  fireEvent.change(search, { target: { value: text } });
};

const dateInput = (index: number) =>
  Array.from(document.querySelectorAll('input[type="date"]'))[index] as HTMLInputElement;

/** Row checkboxes, skipping the select-all in the header. */
const rowCheckboxes = () =>
  Array.from(document.querySelectorAll('tbody input[type="checkbox"]')) as HTMLInputElement[];

const selectAll = () =>
  fireEvent.click(document.querySelector('thead input[type="checkbox"]') as HTMLElement);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TicketingDashboardPage — loading', () => {
  it('asks for the organisation’s tickets on arrival', async () => {
    await renderDashboard([ticket()]);

    expect(execute).toHaveBeenCalledWith({ method: 'GET', url: '/api/orgadmin/tickets' });
  });

  it('keeps checking, because tickets are scanned while the page is open', async () => {
    await renderDashboard([ticket()]);
    const initialCalls = execute.mock.calls.length;

    await vi.advanceTimersByTimeAsync(30_000);

    // A gate list that goes stale is worse than no list.
    expect(execute.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it('shows an empty gate rather than crashing when the server answers with nothing', async () => {
    await renderDashboard(null as never);

    expect(listedRefs()).toEqual([]);
  });

  it('survives a failed load and still shows the page', async () => {
    execute.mockRejectedValue(new Error('network down'));
    render(<TicketingDashboardPage />);

    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(listedRefs()).toEqual([]);
  });

  it('stops polling once the page is left', async () => {
    execute.mockResolvedValue([ticket()]);
    const { unmount } = render(<TicketingDashboardPage />);
    await waitFor(() => expect(execute).toHaveBeenCalled());

    unmount();
    const afterUnmount = execute.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);

    // An interval left running writes state into an unmounted tree forever.
    expect(execute.mock.calls.length).toBe(afterUnmount);
  });
});

describe('TicketingDashboardPage — searching', () => {
  it('finds a ticket by its reference', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-0001' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002' }),
    ]);

    searchFor('0002');

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0002']));
  });

  it('finds a ticket by the name on it', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-0001', customerName: 'Aoife Byrne' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', customerName: 'Cian Murphy' }),
    ]);

    searchFor('cian');

    // Someone at the gate has a name, not a reference number.
    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0002']));
  });

  it('finds a ticket by the email it was sent to', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-0001', customerEmail: 'aoife@example.com' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', customerEmail: 'cian@example.com' }),
    ]);

    searchFor('CIAN@EXAMPLE.COM');

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0002']));
  });
});

describe('TicketingDashboardPage — filtering', () => {
  it('narrows to the tickets already scanned', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-0001', scanStatus: 'scanned', scanDate: '2026-06-11T09:00:00Z' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', scanStatus: 'not_scanned' }),
    ]);

    const scanStatus = screen.getAllByRole('combobox')[2];
    fireEvent.mouseDown(scanStatus);
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-value="scanned"]')!);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0001']));
  });

  it('drops tickets issued before the date asked for', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-OLD', issueDate: '2026-01-05T10:00:00Z' }),
      ticket({ id: 'b', ticketReference: 'TKT-NEW', issueDate: '2026-06-10T10:00:00Z' }),
    ]);

    fireEvent.change(dateInput(0), { target: { value: '2026-06-01' } });

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-NEW']));
  });

  it('drops tickets issued after the date asked for', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-OLD', issueDate: '2026-01-05T10:00:00Z' }),
      ticket({ id: 'b', ticketReference: 'TKT-NEW', issueDate: '2026-06-10T10:00:00Z' }),
    ]);

    fireEvent.change(dateInput(1), { target: { value: '2026-02-01' } });

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-OLD']));
  });

  it('applies a date range and a search together', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-OLD', customerName: 'Aoife', customerEmail: 'aoife@example.com', issueDate: '2026-01-05T10:00:00Z' }),
      ticket({ id: 'b', ticketReference: 'TKT-NEW', customerName: 'Aoife', customerEmail: 'aoife@example.com', issueDate: '2026-06-10T10:00:00Z' }),
      ticket({ id: 'c', ticketReference: 'TKT-OTHER', customerName: 'Cian', customerEmail: 'cian@example.com', issueDate: '2026-06-11T10:00:00Z' }),
    ]);

    fireEvent.change(dateInput(0), { target: { value: '2026-06-01' } });
    searchFor('aoife');

    await waitFor(() => expect(listedRefs()).toEqual(['TKT-NEW']));
  });
});

describe('TicketingDashboardPage — selecting tickets', () => {
  it('offers batch actions only once something is selected', async () => {
    await renderDashboard([ticket()]);

    expect(screen.queryByRole('button', { name: /scanned/i })).not.toBeInTheDocument();

    fireEvent.click(rowCheckboxes()[0]);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /scanned/i }).length).toBeGreaterThan(0)
    );
  });

  it('takes a ticket back out of the selection when clicked again', async () => {
    await renderDashboard([ticket()]);

    fireEvent.click(rowCheckboxes()[0]);
    await waitFor(() => expect(rowCheckboxes()[0]).toBeChecked());
    fireEvent.click(rowCheckboxes()[0]);

    await waitFor(() => expect(rowCheckboxes()[0]).not.toBeChecked());
    expect(screen.queryByRole('button', { name: /mark/i })).not.toBeInTheDocument();
  });

  it('selects every ticket currently listed', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-0001' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002' }),
    ]);

    selectAll();

    await waitFor(() => rowCheckboxes().forEach((box) => expect(box).toBeChecked()));
  });

  /*
   * Select-all works from the *filtered* list. Selecting everything while a
   * filter is on must not quietly pick up the tickets the filter is hiding —
   * they would be marked scanned by an operator who never saw them.
   */
  it('selects only what the filter left on screen', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-0001', customerName: 'Aoife', customerEmail: 'aoife@example.com' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', customerName: 'Cian', customerEmail: 'cian@example.com' }),
    ]);

    searchFor('aoife');
    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0001']));
    selectAll();

    await waitFor(() => expect(rowCheckboxes().filter((b) => b.checked)).toHaveLength(1));
    expect(listedRefs()).toEqual(['TKT-0001']);
  });

  it('clears the selection when asked', async () => {
    await renderDashboard([ticket({ id: 'a' }), ticket({ id: 'b', ticketReference: 'TKT-0002' })]);

    selectAll();
    await waitFor(() => expect(rowCheckboxes()[0]).toBeChecked());
    selectAll();

    await waitFor(() => rowCheckboxes().forEach((box) => expect(box).not.toBeChecked()));
  });
});

describe('TicketingDashboardPage — acting on tickets', () => {
  it('opens the chosen ticket, not the first one', async () => {
    await renderDashboard([
      ticket({ id: 'a', ticketReference: 'TKT-0001' }),
      ticket({ id: 'b', ticketReference: 'TKT-0002', customerName: 'Cian Murphy', qrCode: 'QR-TKT-0002' }),
    ]);

    const secondRow = document.querySelectorAll('tbody tr')[1] as HTMLElement;
    fireEvent.click(within(secondRow).getAllByRole('button')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/TKT-0002/).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText(/TKT-0001/)).not.toBeInTheDocument();
  });

  it('offers to mark the selection scanned or unscanned, and confirms first', async () => {
    await renderDashboard([ticket()]);

    fireEvent.click(rowCheckboxes()[0]);
    const markScanned = (await screen.findAllByRole('button', { name: /scanned/i }))[0];
    fireEvent.click(markScanned);

    // Marking tickets at the gate is not undoable from here; it gets a dialog.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('re-reads the tickets when the operator refreshes', async () => {
    await renderDashboard([ticket()]);
    const before = execute.mock.calls.length;

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => expect(execute.mock.calls.length).toBeGreaterThan(before));
  });

  it('exports what is on screen without taking the operator off the page', async () => {
    await renderDashboard([ticket()]);

    const exportButton = screen
      .getAllByRole('button')
      .find((b) => /export/i.test(b.textContent ?? ''))!;
    fireEvent.click(exportButton);

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/orgadmin/tickets/export',
      })
    );
    expect(listedRefs()).toEqual(['TKT-0001']);
  });

  it('survives an export the server refused', async () => {
    await renderDashboard([ticket()]);

    execute.mockRejectedValue(new Error('export failed'));
    const exportButton = screen
      .getAllByRole('button')
      .find((b) => /export/i.test(b.textContent ?? ''))!;
    fireEvent.click(exportButton);

    // The list is still usable; a failed export must not blank the gate screen.
    await waitFor(() => expect(listedRefs()).toEqual(['TKT-0001']));
  });
});
