import { TicketingService } from '../ticketing.service';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * Ticket issuance, which runs on the payment path.
 *
 * Two properties matter more than the shape of the row: it must not issue for
 * an event that does not use tickets (most events), and it must be idempotent,
 * because Stripe resends webhooks and a member holding two tickets that both
 * scan valid is a gate problem nobody can resolve on the spot.
 */
describe('TicketingService.issueTicketForEntry', () => {
  let service: TicketingService;
  const mockDb = db as jest.Mocked<typeof db>;
  const ENTRY = 'entry-1';

  const entryRow = (over: Record<string, unknown> = {}) => ({
    id: ENTRY,
    event_id: 'event-1',
    event_activity_id: 'activity-1',
    user_id: 'user-1',
    first_name: 'Ada',
    last_name: 'Adams',
    email: 'ada@example.com',
    start_date: '2026-09-12',
    end_date: '2026-09-12',
    generate_electronic_tickets: true,
    ticket_validity_period: null,
    ...over,
  });

  const issuedRow = {
    id: 'ticket-1',
    ticket_reference: 'TKT-2026-000001',
    qr_code: 'a3f1c2d4-0000-4000-8000-000000000000',
    event_id: 'event-1',
    event_activity_id: 'activity-1',
    event_entry_id: ENTRY,
    user_id: 'user-1',
    customer_name: 'Ada Adams',
    customer_email: 'ada@example.com',
    issue_date: '2026-08-10T00:00:00.000Z',
    valid_from: '2026-09-12T00:00:00.000Z',
    valid_until: '2026-09-12T23:59:59.999Z',
    scan_status: 'not_scanned',
    scan_count: 0,
    status: 'issued',
    ticket_data: {},
    created_at: '2026-08-10T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
  };

  beforeEach(() => {
    service = new TicketingService();
    jest.clearAllMocks();
  });

  it('issues a ticket for an entry on a ticketed event', async () => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [entryRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [issuedRow], rowCount: 1 });

    const ticket = await service.issueTicketForEntry(ENTRY);

    expect(ticket).toMatchObject({
      ticketReference: 'TKT-2026-000001',
      eventEntryId: ENTRY,
      customerName: 'Ada Adams',
      status: 'issued',
    });
  });

  /**
   * Most events are not ticketed. That is the normal case, not an error, and
   * fulfilment must not fail because of it.
   */
  it('returns null without inserting when the event is not ticketed', async () => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [entryRow({ generate_electronic_tickets: false })],
        rowCount: 1,
      });

    const ticket = await service.issueTicketForEntry(ENTRY);

    expect(ticket).toBeNull();
    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });

  it('returns null when the event has no ticketing configuration at all', async () => {
    mockDb.query = jest.fn().mockResolvedValueOnce({
      rows: [entryRow({ generate_electronic_tickets: null })],
      rowCount: 1,
    });

    const ticket = await service.issueTicketForEntry(ENTRY);

    expect(ticket).toBeNull();
  });

  /**
   * A replayed Stripe webhook must not produce a second ticket. The insert
   * conflicts on the entry and the existing ticket is returned instead.
   */
  it('is idempotent: a replay returns the existing ticket', async () => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [entryRow()], rowCount: 1 })
      // ON CONFLICT DO NOTHING: no row returned by the insert
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [issuedRow], rowCount: 1 });

    const ticket = await service.issueTicketForEntry(ENTRY);

    expect(ticket).toMatchObject({ id: 'ticket-1' });
    const [insertSql] = (mockDb.query as jest.Mock).mock.calls[1];
    expect(insertSql).toContain('ON CONFLICT (event_entry_id) DO NOTHING');
  });

  it('takes the reference from the sequence rather than a row count', async () => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [entryRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [issuedRow], rowCount: 1 });

    await service.issueTicketForEntry(ENTRY);

    const [insertSql] = (mockDb.query as jest.Mock).mock.calls[1];
    // Counting rows races: two payments confirmed together read the same count.
    expect(insertSql).toContain("nextval('electronic_ticket_reference_seq')");
    expect(insertSql).not.toMatch(/count\(/i);
  });

  it('extends validity by the configured period', async () => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [entryRow({ ticket_validity_period: 3 })],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [issuedRow], rowCount: 1 });

    await service.issueTicketForEntry(ENTRY);

    const [, params] = (mockDb.query as jest.Mock).mock.calls[1];
    const validUntil = params[7] as Date;
    // Event ends 12 Sept; +3 days, to the end of that day.
    expect(validUntil.getDate()).toBe(15);
  });

  it('throws when the entry does not exist', async () => {
    mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(service.issueTicketForEntry(ENTRY)).rejects.toThrow(/no event entry/i);
  });
});
