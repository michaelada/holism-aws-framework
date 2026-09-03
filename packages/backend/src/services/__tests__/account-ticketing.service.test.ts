import { AccountTicketingService } from '../account-ticketing.service';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * A ticket is a bearer credential — whoever holds the QR walks in — so the
 * scoping assertions here matter as much as the shape of the response. Every
 * query must be constrained by both the organisation and the caller's own user
 * id; a ticket id on its own must never be enough.
 */
describe('AccountTicketingService', () => {
  let service: AccountTicketingService;
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG = 'org-1';
  const USER = 'user-1';

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'ticket-1',
    ticket_reference: 'TKT-2026-000001',
    qr_code: 'a3f1c2d4-0000-4000-8000-000000000000',
    valid_from: '2026-09-12T00:00:00.000Z',
    valid_until: '2026-09-12T23:59:59.000Z',
    scan_date: null,
    customer_name: 'Ada Adams',
    customer_email: 'ada@example.com',
    event_id: 'event-1',
    event_name: 'Spring Show',
    start_date: '2026-09-12',
    end_date: '2026-09-12',
    activity_name: 'Class 3',
    state: 'valid',
    ...over,
  });

  beforeEach(() => {
    service = new AccountTicketingService();
    jest.clearAllMocks();
  });

  describe('listTickets', () => {
    it('returns the member’s tickets', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [row()], rowCount: 1 });

      const result = await service.listTickets(ORG, USER);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'ticket-1',
        ticketReference: 'TKT-2026-000001',
        state: 'valid',
        entrantName: 'Ada Adams',
        eventName: 'Spring Show',
        activityName: 'Class 3',
      });
    });

    it('scopes the query to the organisation and the caller', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

      await service.listTickets(ORG, USER);

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('e.organisation_id = $1');
      expect(sql).toContain('t.user_id = $2');
      expect(params).toEqual([ORG, USER]);
    });

    /**
     * Standing at a gate, the ticket you want is the next event — not the one
     * bought most recently.
     */
    it('orders by event date so the next event is first', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

      await service.listTickets(ORG, USER);

      const [sql] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('ORDER BY e.start_date ASC');
    });

    it('excludes cancelled tickets, which a member cannot act on', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

      await service.listTickets(ORG, USER);

      const [sql] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain("t.status <> 'cancelled'");
    });

    it('computes the four states in SQL so list and detail cannot disagree', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

      await service.listTickets(ORG, USER);

      const [sql] = (mockDb.query as jest.Mock).mock.calls[0];
      // Used wins over expired: a member wants to know the ticket worked.
      expect(sql).toMatch(/scan_count > 0[\s\S]*'used'/);
      expect(sql).toContain("'awaiting-payment'");
      expect(sql).toContain("'expired'");
      expect(sql).toContain("'valid'");
    });

    it('passes a scanned ticket’s timestamp through for the banner', async () => {
      mockDb.query = jest.fn().mockResolvedValue({
        rows: [row({ state: 'used', scan_date: '2026-09-12T09:52:00.000Z' })],
        rowCount: 1,
      });

      const [ticket] = await service.listTickets(ORG, USER);

      expect(ticket.state).toBe('used');
      expect(ticket.scannedAt).toBe('2026-09-12T09:52:00.000Z');
    });
  });

  describe('getTicket', () => {
    it('returns the ticket with the organisation’s rendering configuration', async () => {
      mockDb.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [row()], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [
            {
              display_name: 'Kildare Hunt Pony Club',
              ticket_header_text: 'Admit one',
              ticket_instructions: 'Show this at the gate.',
              ticket_footer_text: 'Registered charity 12345',
              ticket_background_color: '#ffffff',
            },
          ],
          rowCount: 1,
        });

      const ticket = await service.getTicket(ORG, USER, 'ticket-1');

      expect(ticket).toMatchObject({
        id: 'ticket-1',
        qrCode: 'a3f1c2d4-0000-4000-8000-000000000000',
        organisationName: 'Kildare Hunt Pony Club',
        config: {
          headerText: 'Admit one',
          instructions: 'Show this at the gate.',
          footerText: 'Registered charity 12345',
          backgroundColour: '#ffffff',
        },
      });
    });

    it('still returns the ticket when the event has no ticketing configuration', async () => {
      mockDb.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [row()], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ display_name: 'Club' }], rowCount: 1 });

      const ticket = await service.getTicket(ORG, USER, 'ticket-1');

      expect(ticket?.config).toEqual({
        headerText: null,
        instructions: null,
        footerText: null,
        backgroundColour: null,
      });
    });

    /**
     * Another member's ticket is reported exactly as a non-existent one.
     * Distinguishing them would confirm to someone enumerating ids that a given
     * ticket is real.
     */
    it('returns null for a ticket belonging to someone else', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

      const ticket = await service.getTicket(ORG, USER, 'someone-elses-ticket');

      expect(ticket).toBeNull();
      const [sql, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('t.user_id = $2');
      expect(params).toEqual([ORG, USER, 'someone-elses-ticket']);
    });
  });
});
