import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TicketDetailsDialog from '../TicketDetailsDialog';
import type { ElectronicTicket } from '../../types/ticketing.types';

/**
 * The two buttons on this dialog that did nothing.
 *
 * Reported from the product: *"when I clicked the Download PDF button nothing
 * happened. Also when I clicked Mark as Scanned it did not work."* Both were the
 * same shape of fault — a call to an endpoint that does not exist — and both
 * were silent, because `useApi.execute` answers `null` on an error rather than
 * throwing. The dialog read the refusal as success, closed itself, and left the
 * ticket as it was.
 */

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@itsplainsailing/orgadmin-shell', async () =>
  (await import('@itsplainsailing/orgadmin-core/test/shellMock')).createShellMock()
);

vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
  useOrganisation: () => ({ organisation: { id: 'org-1' }, setOrganisation: vi.fn() }),
}));

const ticket = (over: Partial<ElectronicTicket> = {}): ElectronicTicket =>
  ({
    id: 'ticket-1',
    ticketReference: 'TKT-2026-000018',
    qrCode: '123e4567-e89b-12d3-a456-426614174000',
    eventId: 'event-1',
    eventActivityId: 'activity-1',
    eventEntryId: 'entry-1',
    userId: 'user-1',
    customerName: 'Bríd McNamara',
    customerEmail: 'brid@example.test',
    issueDate: new Date('2026-08-22'),
    validFrom: new Date('2026-09-02'),
    validUntil: new Date('2026-09-03'),
    scanStatus: 'not_scanned',
    scanCount: 0,
    status: 'issued',
    ticketData: { eventName: 'Dunshaughlin Gate Day', activityName: 'Open class' },
    createdAt: new Date('2026-08-22'),
    updatedAt: new Date('2026-08-22'),
    ...over,
  }) as ElectronicTicket;

const onClose = vi.fn();
const onUpdate = vi.fn();

const open = (over: Partial<ElectronicTicket> = {}) =>
  render(
    <TicketDetailsDialog open ticket={ticket(over)} onClose={onClose} onUpdate={onUpdate} />
  );

beforeEach(() => {
  vi.clearAllMocks();
  execute.mockResolvedValue({});
});

describe('admitting a ticket at the gate', () => {
  it('asks the endpoint that exists', async () => {
    /*
     * `PUT …/scan-status`, not `POST …/mark-scanned`. The latter has never been
     * a route: the request 404'd, `execute` turned that into `null`, and the
     * dialog closed as though it had worked.
     */
    open();

    fireEvent.click(screen.getByRole('button', { name: /Mark as Scanned/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/api/orgadmin/tickets/ticket-1/scan-status',
          data: expect.objectContaining({ scanStatus: 'scanned' }),
        })
      )
    );
  });

  it('takes it back the same way', async () => {
    open({ scanStatus: 'scanned', scanCount: 1 });

    fireEvent.click(screen.getByRole('button', { name: /Mark as Not Scanned/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/orgadmin/tickets/ticket-1/scan-status',
          data: expect.objectContaining({ scanStatus: 'not_scanned' }),
        })
      )
    );
  });

  it('records where it was marked, not merely that it was', async () => {
    // The ticket carries a scan location; leaving it empty on a ticket admitted
    // from the office says less than the club knows.
    open();

    fireEvent.click(screen.getByRole('button', { name: /Mark as Scanned/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scanLocation: expect.any(String) }),
        })
      )
    );
  });

  it('re-reads the list and closes once it has actually worked', async () => {
    open();

    fireEvent.click(screen.getByRole('button', { name: /Mark as Scanned/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when the server refuses, instead of closing', async () => {
    /*
     * The heart of the report. Without `throwOnError` this refusal arrives as
     * `null` and is indistinguishable from success — which is how a gateman
     * came to watch the dialog shut on a ticket that had not been marked.
     */
    execute.mockRejectedValue(new Error('Invalid scan status'));
    open();

    fireEvent.click(screen.getByRole('button', { name: /Mark as Scanned/i }));

    expect(await screen.findByText('Invalid scan status')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('asks for the failure rather than accepting a null', async () => {
    open();

    fireEvent.click(screen.getByRole('button', { name: /Mark as Scanned/i }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(expect.objectContaining({ throwOnError: true }))
    );
  });
});

describe('a ticket that admits more than one', () => {
  /*
   * The family-ticket case, which the dialog used to make impossible.
   *
   * The two buttons were keyed on `scanStatus`, so the moment the first of four
   * was admitted the ticket read `scanned` and the only control left was
   * *undo* — the other three could not be let in from this screen at all. They
   * are now keyed on whether there is room and whether anything has been used,
   * which for a one-use ticket is the same one-or-the-other it always was.
   */
  it('offers both admitting and undoing while a family ticket has room', async () => {
    execute.mockResolvedValue({});

    render(
      <TicketDetailsDialog
        open
        ticket={ticket({ scanStatus: 'scanned', scanCount: 2, admits: 4 })}
        eventName="Autumn Gate Day"
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    expect(await screen.findByRole('button', { name: /mark as scanned/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark as not scanned/i })).toBeInTheDocument();
  });

  it('stops offering to admit once every place is used', async () => {
    execute.mockResolvedValue({});

    render(
      <TicketDetailsDialog
        open
        ticket={ticket({ scanStatus: 'scanned', scanCount: 4, admits: 4 })}
        eventName="Autumn Gate Day"
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await screen.findByRole('button', { name: /mark as not scanned/i });
    expect(screen.queryByRole('button', { name: /mark as scanned/i })).not.toBeInTheDocument();
  });

  it('keeps a one-use ticket to a single control, as before', async () => {
    execute.mockResolvedValue({});

    render(
      <TicketDetailsDialog
        open
        ticket={ticket({ scanStatus: 'not_scanned', scanCount: 0, admits: 1 })}
        eventName="Autumn Gate Day"
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await screen.findByRole('button', { name: /mark as scanned/i });
    expect(screen.queryByRole('button', { name: /mark as not scanned/i })).not.toBeInTheDocument();
  });

  it('says what the server said when the ticket is used up', async () => {
    // A 409 carrying words an administrator can act on. `failure.message` here
    // is "Request failed with status code 409", which is not one of them.
    execute.mockRejectedValue({
      response: { data: { error: { code: 'TICKET_FULLY_USED', message: 'This ticket admits 4 and all 4 have been used.' } } },
    });

    render(
      <TicketDetailsDialog
        open
        ticket={ticket({ scanStatus: 'scanned', scanCount: 3, admits: 4 })}
        eventName="Autumn Gate Day"
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /mark as scanned/i }));

    expect(
      await screen.findByText('This ticket admits 4 and all 4 have been used.')
    ).toBeInTheDocument();
  });
});

describe('printing the ticket', () => {
  it('builds the ticket here rather than fetching a file that does not exist', async () => {
    /*
     * There is no `download-pdf` endpoint. The old handler called one anyway
     * and logged "PDF download initiated" — the button did nothing, quietly.
     * The ticket is rendered from the shared template into a frame, and the
     * browser's print dialog is what makes it a PDF.
     */
    const print = vi.fn();
    const write = vi.fn();
    vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue({
      document: { open: vi.fn(), write, close: vi.fn() },
      focus: vi.fn(),
      print,
    } as unknown as Window);
    open();

    // The QR code is generated in an effect; the button waits for it.
    const button = await screen.findByRole('button', { name: /Print \/ Save as PDF/i });
    await waitFor(() => expect(button).not.toBeDisabled());

    fireEvent.click(button);

    // The design is read first, so the write comes a tick later.
    await waitFor(() => expect(write).toHaveBeenCalled());
    const html = write.mock.calls[0][0] as string;
    // The member's own ticket, not a second design that drifts from it.
    expect(html).toContain('TKT-2026-000018');
    expect(html).toContain('Bríd McNamara');
    await waitFor(() => expect(print).toHaveBeenCalled());

    /*
     * It asks `…/render` — the ticket joined to its event, its activity and the
     * club's design — and never `download-pdf`, which is not a route.
     */
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/orgadmin/tickets/ticket-1/render' })
    );
    expect(execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('download-pdf') })
    );
    vi.restoreAllMocks();
  });

  it('prints anyway when the design cannot be read', async () => {
    /*
     * The words are a courtesy; the code is the ticket. A gate cannot be held
     * up because a join failed, so the fallback carries the reference, the
     * holder and the code.
     */
    const print = vi.fn();
    const write = vi.fn();
    vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue({
      document: { open: vi.fn(), write, close: vi.fn() },
      focus: vi.fn(),
      print,
    } as unknown as Window);
    execute.mockRejectedValue(new Error('nope'));

    open();
    const button = await screen.findByRole('button', { name: /Print \/ Save as PDF/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() => expect(write).toHaveBeenCalled());
    expect(write.mock.calls[0][0]).toContain('TKT-2026-000018');
    vi.restoreAllMocks();
  });

  it('waits for the QR code before offering to print', () => {
    /*
     * The code is generated in an effect after the dialog opens. Printing
     * before it exists produces a ticket nobody can scan — which looks like a
     * working button and is worse than one that is briefly disabled.
     */
    open();

    expect(screen.getByRole('button', { name: /Print \/ Save as PDF/i })).toBeDisabled();
  });
});

/**
 * The ticket itself, on the screen a club opens.
 *
 * Asked for from the product: *"when I drill into a specific ticket sold to
 * someone, can the actual ticket as it is shown / emailed to the user be
 * shown"*. It is the question the reference in the list cannot answer — what is
 * this person going to hold up at the gate — and until now the dialog answered
 * everything except that.
 */
describe('the ticket, and the scan details behind it', () => {
  const DESIGN = {
    ticketReference: 'TKT-2026-000018',
    eventName: 'Dunshaughlin Gate Day',
    eventDescription: 'Cross country over the Tara banks.',
    activityName: 'Open class',
    activityDescription: 'Open to all grades.',
    startDate: '2026-09-02T00:00:00.000Z',
    endDate: '2026-09-02T00:00:00.000Z',
    headerText: 'Meath Hunt Pony Club',
    instructions: 'Show this at the gate.',
    footerText: 'Hard hats to current standard.',
    backgroundColour: '#123c2b',
    imageUrl: null,
    imagePlacement: null,
    layout: 'stacked',
  };

  beforeEach(() => {
    execute.mockImplementation(({ url }: { url: string }) =>
      url.endsWith('/render') ? Promise.resolve(DESIGN) : Promise.resolve([])
    );
  });

  it('reads the club’s design when it opens', async () => {
    open();

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/orgadmin/tickets/ticket-1/render' })
      )
    );
  });

  it('shows the ticket as the holder sees it', async () => {
    open();

    const frame = (await screen.findByTitle('The ticket')) as HTMLIFrameElement;
    await waitFor(() => expect(frame.getAttribute('srcdoc')).toContain('Dunshaughlin Gate Day'));

    const ticket = frame.getAttribute('srcdoc') ?? '';
    // Everything the club designed, not a summary of the database row.
    expect(ticket).toContain('Cross country over the Tara banks.');
    expect(ticket).toContain('Open class');
    expect(ticket).toContain('Meath Hunt Pony Club');
    expect(ticket).toContain('Bríd McNamara');
  });

  it('prints the very thing it is showing', async () => {
    /*
     * One description of the ticket, on screen and in the printer. Two would
     * drift, and the one that drifted would be the one nobody looked at.
     */
    const write = vi.fn();
    vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue({
      document: { open: vi.fn(), write, close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window);

    open();
    const frame = (await screen.findByTitle('The ticket')) as HTMLIFrameElement;
    await waitFor(() => expect(frame.getAttribute('srcdoc')).toContain('Dunshaughlin Gate Day'));

    const button = screen.getByRole('button', { name: /Print \/ Save as PDF/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() => expect(write).toHaveBeenCalled());
    expect(write.mock.calls[0][0]).toBe(frame.getAttribute('srcdoc'));
    vi.restoreAllMocks();
  });

  it('keeps the scan status, dates and history a tab away', async () => {
    open({ scanStatus: 'scanned', scanCount: 2, scanDate: new Date('2026-09-02T09:20:00Z') });

    fireEvent.click(screen.getByRole('tab', { name: 'Scanning' }));

    expect(await screen.findByText('Scan Status')).toBeInTheDocument();
    expect(screen.getByText('Scan Count')).toBeInTheDocument();
  });

  it('says whose ticket it is wherever you are in the dialog', async () => {
    // Switching tabs must not lose which of forty tickets this is.
    open();

    fireEvent.click(screen.getByRole('tab', { name: 'Scanning' }));

    expect(screen.getByText('Bríd McNamara · TKT-2026-000018')).toBeInTheDocument();
  });
});
