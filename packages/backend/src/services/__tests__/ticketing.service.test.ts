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
    it('should return all ticketed events for an organisation', async () => {
      const mockConfigs = [
        {
          id: '1',
          event_id: 'event-1',
          generate_electronic_tickets: true,
          ticket_header_text: 'Welcome!',
          ticket_instructions: 'Present at entrance',
          ticket_footer_text: 'Thank you',
          ticket_validity_period: 2,
          include_event_logo: true,
          ticket_background_color: '#FFFFFF',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockConfigs } as any);

      const result = await service.getTicketedEventsByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].generateElectronicTickets).toBe(true);
      expect(result[0].ticketHeaderText).toBe('Welcome!');
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
        includeEventLogo: true,
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
        include_event_logo: true,
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
      expect(result.includeEventLogo).toBe(true);
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
        include_event_logo: true,
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
        include_event_logo: true,
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
    it('should return ticket by QR code', async () => {
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

      const result = await service.getTicketByQRCode('qr-1');

      expect(result).not.toBeNull();
      expect(result?.qrCode).toBe('qr-1');
    });
  });

  describe('updateTicketScanStatus', () => {
    it('should update ticket to scanned status', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      const mockUpdatedTicket = {
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
      };

      mockDb.getClient = jest.fn().mockResolvedValue(mockClient);
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUpdatedTicket] }) // UPDATE
        .mockResolvedValueOnce(undefined) // INSERT history
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.updateTicketScanStatus(
        '1',
        'scanned',
        'Main Entrance',
        'user-admin'
      );

      expect(result.scanStatus).toBe('scanned');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockDb.getClient = jest.fn().mockResolvedValue(mockClient);
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // UPDATE fails

      await expect(
        service.updateTicketScanStatus('1', 'scanned')
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
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
