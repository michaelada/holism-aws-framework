import { TicketingService } from '../ticketing.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('TicketingService', () => {
  let service: TicketingService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new TicketingService();
    jest.clearAllMocks();
  });

  describe('getTicketedEventsByOrganisation', () => {
    it('should return ticketed event summaries for an organisation', async () => {
      const mockRows = [
        {
          event_id: 'event-1',
          event_name: 'Summer Camp',
          event_date: new Date('2024-07-15'),
          generate_electronic_tickets: true,
          total_tickets: 10,
          tickets_scanned: 4,
          tickets_not_scanned: 6,
          scan_percentage: '40.0',
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await service.getTicketedEventsByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].eventId).toBe('event-1');
      expect(result[0].eventName).toBe('Summer Camp');
      expect(result[0].generateElectronicTickets).toBe(true);
      expect(result[0].totalTickets).toBe(10);
      expect(result[0].ticketsScanned).toBe(4);
      expect(result[0].ticketsNotScanned).toBe(6);
      expect(result[0].scanPercentage).toBe(40.0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE e.organisation_id = $1'),
        ['org-1']
      );
    });

    it('should return empty array when no ticketed events found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getTicketedEventsByOrganisation('org-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('createTicketedEvent', () => {
    it('should create ticketing configuration with all attributes', async () => {
      const newConfig = {
        eventId: 'event-1',
        generateElectronicTickets: true,
        ticketHeaderText: 'Welcome!',
        ticketInstructions: 'Present at entrance',
        ticketFooterText: 'Thank you',
        ticketValidityPeriod: 2,
        ticketBackgroundColor: '#FFFFFF',
      };

      const mockCreated = {
        id: '1',
        event_id: 'event-1',
        generate_electronic_tickets: true,
        ticket_header_text: 'Welcome!',
        ticket_instructions: 'Present at entrance',
        ticket_footer_text: 'Thank you',
        ticket_validity_period: 2,
        ticket_background_color: '#FFFFFF',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock check for existing config
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      // Mock insert
      mockDb.query.mockResolvedValueOnce({ rows: [mockCreated] } as any);

      const result = await service.createTicketedEvent(newConfig);

      expect(result.generateElectronicTickets).toBe(true);
      expect(result.ticketHeaderText).toBe('Welcome!');
    });

    it('should throw error if config already exists', async () => {
      const newConfig = {
        eventId: 'event-1',
        generateElectronicTickets: true,
      };

      // Mock existing config
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: '1' }] } as any);

      await expect(service.createTicketedEvent(newConfig)).rejects.toThrow(
        'Ticketing configuration already exists for this event'
      );
    });
  });

  describe('updateTicketedEvent', () => {
    it('should update ticketing configuration', async () => {
      const updateData = {
        generateElectronicTickets: false,
        ticketHeaderText: 'Updated header',
      };

      const mockUpdated = {
        id: '1',
        event_id: 'event-1',
        generate_electronic_tickets: false,
        ticket_header_text: 'Updated header',
        ticket_instructions: 'Present at entrance',
        ticket_footer_text: 'Thank you',
        ticket_validity_period: 2,
        ticket_background_color: '#FFFFFF',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await service.updateTicketedEvent('event-1', updateData);

      expect(result.generateElectronicTickets).toBe(false);
      expect(result.ticketHeaderText).toBe('Updated header');
    });

    it('should throw error when config not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.updateTicketedEvent('event-999', { generateElectronicTickets: false })
      ).rejects.toThrow('Ticketing configuration not found');
    });
  });

  describe('deleteTicketedEvent', () => {
    it('should delete ticketing configuration', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      await service.deleteTicketedEvent('event-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM event_ticketing_config WHERE event_id = $1',
        ['event-1']
      );
    });

    it('should throw error when config not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 } as any);

      await expect(service.deleteTicketedEvent('event-999')).rejects.toThrow(
        'Ticketing configuration not found'
      );
    });
  });

  describe('getTicketSalesByEvent', () => {
    it('should return ticket sales summary with statistics', async () => {
      const mockEvent = { name: 'Summer Camp' };
      const mockTickets = [
        {
          id: '1',
          ticket_reference: 'TKT-2024-001',
          qr_code: 'qr-1',
          event_id: 'event-1',
          event_activity_id: 'activity-1',
          event_entry_id: 'entry-1',
          user_id: 'user-1',
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          issue_date: new Date(),
          valid_from: null,
          valid_until: new Date(),
          scan_status: 'scanned',
          scan_date: new Date(),
          scan_location: 'Main Entrance',
          scan_count: 1,
          status: 'issued',
          ticket_data: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '2',
          ticket_reference: 'TKT-2024-002',
          qr_code: 'qr-2',
          event_id: 'event-1',
          event_activity_id: 'activity-1',
          event_entry_id: 'entry-2',
          user_id: 'user-2',
          customer_name: 'Jane Smith',
          customer_email: 'jane@example.com',
          issue_date: new Date(),
          valid_from: null,
          valid_until: new Date(),
          scan_status: 'not_scanned',
          scan_date: null,
          scan_location: null,
          scan_count: 0,
          status: 'issued',
          ticket_data: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockLastScan = { last_scan: new Date() };

      // Mock event query
      mockDb.query.mockResolvedValueOnce({ rows: [mockEvent] } as any);
      // Mock tickets query
      mockDb.query.mockResolvedValueOnce({ rows: mockTickets } as any);
      // Mock last scan query
      mockDb.query.mockResolvedValueOnce({ rows: [mockLastScan] } as any);

      const result = await service.getTicketSalesByEvent('event-1');

      expect(result.eventName).toBe('Summer Camp');
      expect(result.totalIssued).toBe(2);
      expect(result.totalScanned).toBe(1);
      expect(result.totalNotScanned).toBe(1);
      expect(result.tickets).toHaveLength(2);
    });

    it('should throw error when event not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.getTicketSalesByEvent('event-999')).rejects.toThrow(
        'Event not found'
      );
    });
  });

  describe('getTicketingConfigByEvent', () => {
    it('should return config for event', async () => {
      const mockConfig = {
        id: '1',
        event_id: 'event-1',
        generate_electronic_tickets: true,
        ticket_header_text: 'Welcome!',
        ticket_instructions: 'Present at entrance',
        ticket_footer_text: 'Thank you',
        ticket_validity_period: 2,
        ticket_background_color: '#FFFFFF',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockConfig] } as any);

      const result = await service.getTicketingConfigByEvent('event-1');

      expect(result).not.toBeNull();
      expect(result?.generateElectronicTickets).toBe(true);
    });

    it('should return null when config not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getTicketingConfigByEvent('event-999');

      expect(result).toBeNull();
    });
  });

  describe('getTicketById', () => {
    it('should return ticket by ID', async () => {
      const mockTicket = {
        id: '1',
        ticket_reference: 'TKT-2024-001',
        qr_code: 'qr-1',
        event_id: 'event-1',
        event_activity_id: 'activity-1',
        event_entry_id: 'entry-1',
        user_id: 'user-1',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        issue_date: new Date(),
        valid_from: null,
        valid_until: new Date(),
        scan_status: 'not_scanned',
        scan_date: null,
        scan_location: null,
        scan_count: 0,
        status: 'issued',
        ticket_data: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockTicket] } as any);

      const result = await service.getTicketById('1');

      expect(result).not.toBeNull();
      expect(result?.ticketReference).toBe('TKT-2024-001');
    });

    it('should return null when ticket not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getTicketById('999');

      expect(result).toBeNull();
    });
  });

  describe('getTicketByQRCode', () => {
    /*
     * A real identifier, because the presented code is now **read** before it
     * is looked up: it must be a signed token or the bare UUID a pre-signing
     * ticket carries. `'qr-1'` is neither, and is answered as not found without
     * a query — which is the point of signing, and is checked below.
     */
    const QR = '123e4567-e89b-12d3-a456-426614174000';

    it('should return ticket by QR code', async () => {
      const mockTicket = {
        id: '1',
        ticket_reference: 'TKT-2024-001',
        qr_code: QR,
        event_id: 'event-1',
        event_activity_id: 'activity-1',
        event_entry_id: 'entry-1',
        user_id: 'user-1',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        issue_date: new Date(),
        valid_from: null,
        valid_until: new Date(),
        scan_status: 'not_scanned',
        scan_date: null,
        scan_location: null,
        scan_count: 0,
        status: 'issued',
        ticket_data: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockTicket] } as any);

      const result = await service.getTicketByQRCode(QR);

      expect(result).not.toBeNull();
      expect(result?.qrCode).toBe(QR);
    });

    it('answers not found for a code we did not mint, without a query', async () => {
      // A QR off a poster, or a tampered token. It names no ticket, so there is
      // nothing to look up.
      const result = await service.getTicketByQRCode('https://example.test/whats-on');

      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('updateTicketScanStatus', () => {
    /*
     * The club's own way in, for the ticket presented at a desk. It has to
     * answer the same two questions the gate does — is there room, and who let
     * them in — and until recently it answered neither: the count climbed with
     * no ceiling, and the history recorded no name at all, so every row read
     * "-".
     */
    const ticketRow = (over: Record<string, unknown> = {}) => ({
      id: '1',
      ticket_reference: 'TKT-2024-001',
      qr_code: '123e4567-e89b-12d3-a456-426614174000',
      event_id: 'event-1',
      event_activity_id: 'activity-1',
      event_entry_id: 'entry-1',
      user_id: 'user-1',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      issue_date: new Date(),
      valid_from: null,
      valid_until: new Date(),
      scan_status: 'scanned',
      scan_date: new Date(),
      scan_location: 'Main Entrance',
      scan_count: 1,
      admits: 1,
      status: 'issued',
      ticket_data: {},
      created_at: new Date(),
      updated_at: new Date(),
      ...over,
    });

    const client = () => {
      const mock = { query: jest.fn(), release: jest.fn() };
      mockDb.getClient = jest.fn().mockResolvedValue(mock);
      return mock;
    };

    /** The administrator's row, as the name lookup finds it. */
    const ADMIN = { rows: [{ name: 'Ann Doyle', email: 'ann@club.test' }] };

    it('admits, and records who did it by name', async () => {
      const mock = client();
      mock.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(ADMIN) // who is acting
        .mockResolvedValueOnce({ rows: [ticketRow()] }) // the admitting UPDATE
        .mockResolvedValueOnce(undefined) // the history row
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.updateTicketScanStatus(
        '1',
        'scanned',
        'Main Entrance',
        'org-user-1'
      );

      expect(result.scanStatus).toBe('scanned');

      const [historySql, historyValues] = mock.query.mock.calls[3];
      expect(historySql).toContain('scanned_by_name');
      expect(historySql).toContain("'success'");
      // The id for the foreign key, and the name for the trail that outlives it.
      expect(historyValues).toEqual(expect.arrayContaining(['org-user-1', 'Ann Doyle']));
      expect(mock.query).toHaveBeenCalledWith('COMMIT');
      expect(mock.release).toHaveBeenCalled();
    });

    it('falls back to the administrator’s email where they have no name', async () => {
      const mock = client();
      mock.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ name: '', email: 'ann@club.test' }] })
        .mockResolvedValueOnce({ rows: [ticketRow()] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await service.updateTicketScanStatus('1', 'scanned', undefined, 'org-user-1');

      expect(mock.query.mock.calls[3][1]).toEqual(
        expect.arrayContaining(['ann@club.test'])
      );
    });

    it('enforces the ceiling in the statement, not after it', async () => {
      const mock = client();
      mock.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(ADMIN)
        .mockResolvedValueOnce({ rows: [ticketRow({ scan_count: 2, admits: 4 })] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await service.updateTicketScanStatus('1', 'scanned', undefined, 'org-user-1');

      // Whether a row comes back *is* whether there was room — the same rule
      // the gate applies, rather than a count read and then incremented.
      const [sql] = mock.query.mock.calls[2];
      expect(sql).toContain('scan_count < admits');
      expect(sql).toContain('scan_count = scan_count + 1');
    });

    it('refuses a ticket with no room left, and says so', async () => {
      const mock = client();
      mock.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(ADMIN)
        .mockResolvedValueOnce({ rows: [] }) // the UPDATE admitted nobody
        .mockResolvedValueOnce({ rows: [{ scan_count: 4, admits: 4 }] }) // why
        .mockResolvedValueOnce(undefined) // the refusal, written down
        .mockResolvedValueOnce(undefined); // COMMIT

      await expect(
        service.updateTicketScanStatus('1', 'scanned', undefined, 'org-user-1')
      ).rejects.toMatchObject({ code: 'TICKET_FULLY_USED', statusCode: 409 });

      // A refusal at a desk is as much a fact about the ticket as an admission.
      const [historySql, historyValues] = mock.query.mock.calls[4];
      expect(historySql).toContain('ticket_scan_history');
      expect(historySql).toContain("'refused'");
      expect(historySql).toContain("'already_used'");
      // Named, so the club can see who was turned away and by whom.
      expect(historyValues).toEqual(expect.arrayContaining(['org-user-1', 'Ann Doyle']));
    });

    it('tells a missing ticket apart from a used-up one', async () => {
      const mock = client();
      mock.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(ADMIN)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // no such ticket
        .mockResolvedValueOnce(undefined);

      await expect(
        service.updateTicketScanStatus('1', 'scanned', undefined, 'org-user-1')
      ).rejects.toThrow('Ticket not found');
    });

    it('gives the place back when an admission is undone', async () => {
      const mock = client();
      mock.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(ADMIN)
        .mockResolvedValueOnce({ rows: [ticketRow({ scan_count: 1, admits: 4 })] })
        .mockResolvedValueOnce(undefined);

      await service.updateTicketScanStatus('1', 'not_scanned', undefined, 'org-user-1');

      const [sql] = mock.query.mock.calls[2];
      // Decrements rather than merely relabelling: a mistake corrected has to
      // return the place, or a family ticket loses one every time.
      expect(sql).toContain('GREATEST(scan_count - 1, 0)');
      // And the ticket stays "scanned" while any of its places are still used.
      expect(sql).toContain("THEN 'scanned' ELSE 'not_scanned'");
    });

    it('rolls back on error, and lets the original failure through', async () => {
      const mock = client();
      mock.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // the name lookup fails

      await expect(
        service.updateTicketScanStatus('1', 'scanned', undefined, 'org-user-1')
      ).rejects.toThrow('Database error');

      expect(mock.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mock.release).toHaveBeenCalled();
    });
  });

  describe('getTicketScanHistory', () => {
    it('should return scan history for ticket', async () => {
      const mockHistory = [
        {
          id: '1',
          ticket_id: 'ticket-1',
          scan_date: new Date(),
          scan_location: 'Main Entrance',
          scanned_by: 'user-admin',
          scan_result: 'success',
          notes: 'Ticket scanned successfully',
          created_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockHistory } as any);

      const result = await service.getTicketScanHistory('ticket-1');

      expect(result).toHaveLength(1);
      expect(result[0].scanResult).toBe('success');
      expect(result[0].scanLocation).toBe('Main Entrance');
    });

    it('should return empty array when no history found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getTicketScanHistory('ticket-999');

      expect(result).toHaveLength(0);
    });
  });
});
