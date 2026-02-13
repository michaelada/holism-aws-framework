import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Event Ticketing Config interface
 */
export interface EventTicketingConfig {
  id: string;
  eventId: string;
  generateElectronicTickets: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  includeEventLogo: boolean;
  ticketBackgroundColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Electronic Ticket interface
 */
export interface ElectronicTicket {
  id: string;
  ticketReference: string;
  qrCode: string;
  eventId: string;
  eventActivityId?: string;
  eventEntryId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  issueDate: Date;
  validFrom?: Date;
  validUntil: Date;
  scanStatus: 'not_scanned' | 'scanned';
  scanDate?: Date;
  scanLocation?: string;
  scanCount: number;
  status: 'issued' | 'cancelled' | 'expired';
  ticketData: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Ticket Scan History interface
 */
export interface TicketScanHistory {
  id: string;
  ticketId: string;
  scanDate: Date;
  scanLocation?: string;
  scannedBy?: string;
  scanResult: string;
  notes?: string;
  createdAt: Date;
}

/**
 * DTO for creating ticketing config
 */
export interface CreateTicketingConfigDto {
  eventId: string;
  generateElectronicTickets: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  includeEventLogo?: boolean;
  ticketBackgroundColor?: string;
}

/**
 * DTO for updating ticketing config
 */
export interface UpdateTicketingConfigDto {
  generateElectronicTickets?: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  includeEventLogo?: boolean;
  ticketBackgroundColor?: string;
}

/**
 * DTO for ticket sales summary
 */
export interface TicketSalesSummary {
  eventId: string;
  eventName: string;
  totalIssued: number;
  totalScanned: number;
  totalNotScanned: number;
  lastScanTime?: Date;
  tickets: ElectronicTicket[];
}

/**
 * Service for managing event ticketing
 */
export class TicketingService {
  /**
   * Convert database row to EventTicketingConfig object
   */
  private rowToTicketingConfig(row: any): EventTicketingConfig {
    return {
      id: row.id,
      eventId: row.event_id,
      generateElectronicTickets: row.generate_electronic_tickets,
      ticketHeaderText: row.ticket_header_text,
      ticketInstructions: row.ticket_instructions,
      ticketFooterText: row.ticket_footer_text,
      ticketValidityPeriod: row.ticket_validity_period,
      includeEventLogo: row.include_event_logo,
      ticketBackgroundColor: row.ticket_background_color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to ElectronicTicket object
   */
  private rowToTicket(row: any): ElectronicTicket {
    return {
      id: row.id,
      ticketReference: row.ticket_reference,
      qrCode: row.qr_code,
      eventId: row.event_id,
      eventActivityId: row.event_activity_id,
      eventEntryId: row.event_entry_id,
      userId: row.user_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      issueDate: row.issue_date,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      scanStatus: row.scan_status,
      scanDate: row.scan_date,
      scanLocation: row.scan_location,
      scanCount: row.scan_count,
      status: row.status,
      ticketData: row.ticket_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all ticketed events (events with ticketing enabled) for an organisation
   */
  async getTicketedEventsByOrganisation(organisationId: string): Promise<EventTicketingConfig[]> {
    try {
      const result = await db.query(
        `SELECT etc.* 
         FROM event_ticketing_config etc
         INNER JOIN events e ON etc.event_id = e.id
         WHERE e.organisation_id = $1 
         AND etc.generate_electronic_tickets = true
         ORDER BY e.start_date DESC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToTicketingConfig(row));
    } catch (error) {
      logger.error('Error getting ticketed events by organisation:', error);
      throw error;
    }
  }

  /**
   * Create ticketing configuration for an event
   */
  async createTicketedEvent(data: CreateTicketingConfigDto): Promise<EventTicketingConfig> {
    try {
      // Check if config already exists for this event
      const existing = await db.query(
        'SELECT id FROM event_ticketing_config WHERE event_id = $1',
        [data.eventId]
      );

      if (existing.rows.length > 0) {
        throw new Error('Ticketing configuration already exists for this event');
      }

      const result = await db.query(
        `INSERT INTO event_ticketing_config 
         (event_id, generate_electronic_tickets, ticket_header_text, ticket_instructions,
          ticket_footer_text, ticket_validity_period, include_event_logo, ticket_background_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          data.eventId,
          data.generateElectronicTickets,
          data.ticketHeaderText || null,
          data.ticketInstructions || null,
          data.ticketFooterText || null,
          data.ticketValidityPeriod || null,
          data.includeEventLogo || false,
          data.ticketBackgroundColor || null,
        ]
      );

      logger.info(`Ticketing config created for event: ${data.eventId}`);
      return this.rowToTicketingConfig(result.rows[0]);
    } catch (error) {
      logger.error('Error creating ticketing config:', error);
      throw error;
    }
  }

  /**
   * Update ticketing configuration for an event
   */
  async updateTicketedEvent(eventId: string, data: UpdateTicketingConfigDto): Promise<EventTicketingConfig> {
    try {
      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.generateElectronicTickets !== undefined) {
        updates.push(`generate_electronic_tickets = $${paramCount++}`);
        values.push(data.generateElectronicTickets);
      }
      if (data.ticketHeaderText !== undefined) {
        updates.push(`ticket_header_text = $${paramCount++}`);
        values.push(data.ticketHeaderText || null);
      }
      if (data.ticketInstructions !== undefined) {
        updates.push(`ticket_instructions = $${paramCount++}`);
        values.push(data.ticketInstructions || null);
      }
      if (data.ticketFooterText !== undefined) {
        updates.push(`ticket_footer_text = $${paramCount++}`);
        values.push(data.ticketFooterText || null);
      }
      if (data.ticketValidityPeriod !== undefined) {
        updates.push(`ticket_validity_period = $${paramCount++}`);
        values.push(data.ticketValidityPeriod || null);
      }
      if (data.includeEventLogo !== undefined) {
        updates.push(`include_event_logo = $${paramCount++}`);
        values.push(data.includeEventLogo);
      }
      if (data.ticketBackgroundColor !== undefined) {
        updates.push(`ticket_background_color = $${paramCount++}`);
        values.push(data.ticketBackgroundColor || null);
      }

      values.push(eventId);

      const result = await db.query(
        `UPDATE event_ticketing_config 
         SET ${updates.join(', ')}
         WHERE event_id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Ticketing configuration not found');
      }

      logger.info(`Ticketing config updated for event: ${eventId}`);
      return this.rowToTicketingConfig(result.rows[0]);
    } catch (error) {
      logger.error('Error updating ticketing config:', error);
      throw error;
    }
  }

  /**
   * Delete ticketing configuration for an event
   */
  async deleteTicketedEvent(eventId: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM event_ticketing_config WHERE event_id = $1',
        [eventId]
      );

      if (result.rowCount === 0) {
        throw new Error('Ticketing configuration not found');
      }

      logger.info(`Ticketing config deleted for event: ${eventId}`);
    } catch (error) {
      logger.error('Error deleting ticketing config:', error);
      throw error;
    }
  }

  /**
   * Get ticket sales summary for an event
   */
  async getTicketSalesByEvent(eventId: string): Promise<TicketSalesSummary> {
    try {
      // Get event details
      const eventResult = await db.query(
        'SELECT name FROM events WHERE id = $1',
        [eventId]
      );

      if (eventResult.rows.length === 0) {
        throw new Error('Event not found');
      }

      const eventName = eventResult.rows[0].name;

      // Get all tickets for the event
      const ticketsResult = await db.query(
        `SELECT * FROM electronic_tickets 
         WHERE event_id = $1 
         ORDER BY issue_date DESC`,
        [eventId]
      );

      const tickets = ticketsResult.rows.map(row => this.rowToTicket(row));

      // Calculate summary statistics
      const totalIssued = tickets.length;
      const totalScanned = tickets.filter(t => t.scanStatus === 'scanned').length;
      const totalNotScanned = tickets.filter(t => t.scanStatus === 'not_scanned').length;

      // Get last scan time
      const lastScanResult = await db.query(
        `SELECT MAX(scan_date) as last_scan 
         FROM electronic_tickets 
         WHERE event_id = $1 AND scan_status = 'scanned'`,
        [eventId]
      );

      const lastScanTime = lastScanResult.rows[0]?.last_scan || null;

      return {
        eventId,
        eventName,
        totalIssued,
        totalScanned,
        totalNotScanned,
        lastScanTime,
        tickets,
      };
    } catch (error) {
      logger.error('Error getting ticket sales by event:', error);
      throw error;
    }
  }

  /**
   * Get ticketing configuration for an event
   */
  async getTicketingConfigByEvent(eventId: string): Promise<EventTicketingConfig | null> {
    try {
      const result = await db.query(
        'SELECT * FROM event_ticketing_config WHERE event_id = $1',
        [eventId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToTicketingConfig(result.rows[0]);
    } catch (error) {
      logger.error('Error getting ticketing config by event:', error);
      throw error;
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string): Promise<ElectronicTicket | null> {
    try {
      const result = await db.query(
        'SELECT * FROM electronic_tickets WHERE id = $1',
        [ticketId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToTicket(result.rows[0]);
    } catch (error) {
      logger.error('Error getting ticket by ID:', error);
      throw error;
    }
  }

  /**
   * Get ticket by QR code
   */
  async getTicketByQRCode(qrCode: string): Promise<ElectronicTicket | null> {
    try {
      const result = await db.query(
        'SELECT * FROM electronic_tickets WHERE qr_code = $1',
        [qrCode]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToTicket(result.rows[0]);
    } catch (error) {
      logger.error('Error getting ticket by QR code:', error);
      throw error;
    }
  }

  /**
   * Update ticket scan status
   */
  async updateTicketScanStatus(
    ticketId: string,
    scanStatus: 'scanned' | 'not_scanned',
    scanLocation?: string,
    scannedBy?: string
  ): Promise<ElectronicTicket> {
    try {
      const client = await db.getClient();

      try {
        await client.query('BEGIN');

        // Update ticket
        const updateResult = await client.query(
          `UPDATE electronic_tickets 
           SET scan_status = $1, 
               scan_date = $2,
               scan_location = $3,
               scan_count = scan_count + $4,
               updated_at = NOW()
           WHERE id = $5
           RETURNING *`,
          [
            scanStatus,
            scanStatus === 'scanned' ? new Date() : null,
            scanStatus === 'scanned' ? scanLocation : null,
            scanStatus === 'scanned' ? 1 : 0,
            ticketId,
          ]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('Ticket not found');
        }

        // Add scan history entry
        if (scanStatus === 'scanned') {
          await client.query(
            `INSERT INTO ticket_scan_history 
             (ticket_id, scan_location, scanned_by, scan_result, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              ticketId,
              scanLocation || null,
              scannedBy || null,
              'success',
              'Ticket scanned successfully',
            ]
          );
        }

        await client.query('COMMIT');

        logger.info(`Ticket scan status updated: ${ticketId} -> ${scanStatus}`);
        return this.rowToTicket(updateResult.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error updating ticket scan status:', error);
      throw error;
    }
  }

  /**
   * Get scan history for a ticket
   */
  async getTicketScanHistory(ticketId: string): Promise<TicketScanHistory[]> {
    try {
      const result = await db.query(
        `SELECT * FROM ticket_scan_history 
         WHERE ticket_id = $1 
         ORDER BY scan_date DESC`,
        [ticketId]
      );

      return result.rows.map(row => ({
        id: row.id,
        ticketId: row.ticket_id,
        scanDate: row.scan_date,
        scanLocation: row.scan_location,
        scannedBy: row.scanned_by,
        scanResult: row.scan_result,
        notes: row.notes,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Error getting ticket scan history:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const ticketingService = new TicketingService();
