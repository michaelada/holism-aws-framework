import { db } from '../database/pool';
import { signTicketCode, ticketIdFromCode } from './ticket-token.service';
import { logger } from '../config/logger';
import { fileUploadService } from './file-upload.service';
import { AppError, NotFoundError } from '../middleware/errors';

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
  ticketBackgroundColor?: string;
  /** The S3 key. A signed URL is derived from it at read time. */
  ticketImageKey?: string | null;
  ticketImagePlacement?: 'header' | 'footer' | 'topRight' | 'background' | null;
  ticketLayout?: 'stacked' | 'sideBySide' | 'compact';
  /** Filled in only where the caller is going to render the ticket. */
  ticketImageUrl?: string | null;
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
  /**
   * The string printed into the QR code: a signed token, or the bare `qrCode`
   * for a ticket issued before signing. **This is what a scanner reads**;
   * `qrCode` remains the identifier everything is looked up by.
   */
  qrToken: string;
  /** How many people this ticket admits — 1 unless the activity says more. */
  admits: number;
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
  /** Who was on the gate, if this scan came from one. */
  scannedByName?: string | null;
  /** Why it was turned away, if it was. See docs/GATE_SCANNING.md. */
  refusalReason?: string | null;
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
  ticketBackgroundColor?: string;
  ticketImagePlacement?: TicketImagePlacement | null;
  ticketLayout?: TicketLayout;
}

/** Where a ticket's image goes. `topRight` is a ticket's own, for a small mark. */
export type TicketImagePlacement = 'header' | 'footer' | 'topRight' | 'background';
export type TicketLayout = 'stacked' | 'sideBySide' | 'compact';

export const TICKET_IMAGE_PLACEMENTS: TicketImagePlacement[] = [
  'header',
  'footer',
  'topRight',
  'background',
];
export const TICKET_LAYOUTS: TicketLayout[] = ['stacked', 'sideBySide', 'compact'];

/**
 * DTO for updating ticketing config
 */
export interface UpdateTicketingConfigDto {
  generateElectronicTickets?: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  ticketBackgroundColor?: string;
  ticketImagePlacement?: TicketImagePlacement | null;
  ticketLayout?: TicketLayout;
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
 * Ticketed event summary for overview page
 */
export interface TicketedEventSummary {
  eventId: string;
  eventName: string;
  eventDate: Date;
  generateElectronicTickets: boolean;
  totalTickets: number;
  ticketsScanned: number;
  ticketsNotScanned: number;
  scanPercentage: number;
}

/**
 * Service for managing event ticketing
 */
/**
 * Refused rather than silently corrected.
 *
 * The database has the same constraint; this is what turns its refusal into a
 * sentence, and stops a typo becoming a ticket that renders as something the
 * club did not choose.
 */
function assertPlacement(placement: unknown): TicketImagePlacement | null {
  if (placement === null || placement === undefined || placement === '') return null;
  if (!TICKET_IMAGE_PLACEMENTS.includes(placement as TicketImagePlacement)) {
    throw new Error('Choose where the image goes: header, footer, topRight or background');
  }
  return placement as TicketImagePlacement;
}

function assertLayout(layout: unknown): TicketLayout {
  // Absent means the default, which is what every ticket looked like before a
  // club could choose.
  if (layout === null || layout === undefined || layout === '') return 'stacked';
  if (!TICKET_LAYOUTS.includes(layout as TicketLayout)) {
    throw new Error('Choose a layout: stacked, sideBySide or compact');
  }
  return layout as TicketLayout;
}

/** How long a browser may use a ticket image URL before asking again. */
const TICKET_IMAGE_URL_TTL_SECONDS = 3600;

/** Everything the shared renderer needs, gathered from four tables. */
export interface TicketForRendering {
  ticketReference: string;
  qrCode: string;
  /** The string the QR encodes: a signed token, or the identifier if unsigned. */
  qrToken: string;
  customerName: string;
  customerEmail: string | null;
  eventName: string;
  eventDescription: string | null;
  activityName: string | null;
  activityDescription: string | null;
  startDate: string | null;
  endDate: string | null;
  headerText: string | null;
  instructions: string | null;
  footerText: string | null;
  backgroundColour: string | null;
  imageUrl: string | null;
  imagePlacement: TicketImagePlacement | null;
  layout: TicketLayout;
}

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
      ticketBackgroundColor: row.ticket_background_color,
      /*
       * The key stays on the row; what leaves here is a signed URL, filled in
       * by `withImageUrl` where a caller needs to render the ticket. A URL in
       * the column would tie every row to a bucket name.
       */
      ticketImageKey: row.ticket_image_key ?? null,
      ticketImagePlacement: row.ticket_image_key ? (row.ticket_image_placement ?? null) : null,
      ticketLayout: row.ticket_layout ?? 'stacked',
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
      /*
       * What goes in the QR. A signed token where the ticket has one, and the
       * bare identifier where it does not — a ticket issued before signing has
       * that identifier in an email nobody can recall, and the screen must scan
       * the same as the paper.
       */
      qrToken: row.qr_token ?? row.qr_code,
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
      admits: row.admits ?? 1,
      status: row.status,
      ticketData: row.ticket_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all ticketed events (events with ticketing enabled) for an organisation
   */
  async getTicketedEventsByOrganisation(organisationId: string): Promise<TicketedEventSummary[]> {
      try {
        const result = await db.query(
          `SELECT etc.event_id,
                  e.name AS event_name,
                  e.start_date AS event_date,
                  etc.generate_electronic_tickets,
                  COUNT(et.id)::int AS total_tickets,
                  COUNT(CASE WHEN et.scan_status = 'scanned' THEN 1 END)::int AS tickets_scanned,
                  (COUNT(et.id) - COUNT(CASE WHEN et.scan_status = 'scanned' THEN 1 END))::int AS tickets_not_scanned,
                  CASE WHEN COUNT(et.id) > 0
                    THEN ROUND((COUNT(CASE WHEN et.scan_status = 'scanned' THEN 1 END)::numeric / COUNT(et.id)) * 100, 1)
                    ELSE 0
                  END AS scan_percentage
           FROM event_ticketing_config etc
           INNER JOIN events e ON etc.event_id = e.id
           LEFT JOIN electronic_tickets et ON et.event_id = etc.event_id
           WHERE e.organisation_id = $1 
           AND etc.generate_electronic_tickets = true
           GROUP BY etc.event_id, e.name, e.start_date, etc.generate_electronic_tickets
           ORDER BY e.start_date DESC`,
          [organisationId]
        );

        return result.rows.map(row => ({
          eventId: row.event_id,
          eventName: row.event_name,
          eventDate: new Date(row.event_date),
          generateElectronicTickets: row.generate_electronic_tickets,
          totalTickets: row.total_tickets,
          ticketsScanned: row.tickets_scanned,
          ticketsNotScanned: row.tickets_not_scanned,
          scanPercentage: parseFloat(row.scan_percentage),
        }));
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
          ticket_footer_text, ticket_validity_period, ticket_background_color,
          ticket_image_placement, ticket_layout)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          data.eventId,
          data.generateElectronicTickets,
          data.ticketHeaderText || null,
          data.ticketInstructions || null,
          data.ticketFooterText || null,
          data.ticketValidityPeriod || null,
          data.ticketBackgroundColor || null,
          assertPlacement(data.ticketImagePlacement),
          assertLayout(data.ticketLayout),
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
      if (data.ticketBackgroundColor !== undefined) {
        updates.push(`ticket_background_color = $${paramCount++}`);
        values.push(data.ticketBackgroundColor || null);
      }
      if (data.ticketImagePlacement !== undefined) {
        updates.push(`ticket_image_placement = $${paramCount++}`);
        values.push(assertPlacement(data.ticketImagePlacement));
      }
      if (data.ticketLayout !== undefined) {
        updates.push(`ticket_layout = $${paramCount++}`);
        values.push(assertLayout(data.ticketLayout));
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
  /**
   * Everything a ticket needs to be drawn.
   *
   * A ticket knows its own reference and its holder, and nothing else: the
   * event's name and dates, the activity's name, and both descriptions live on
   * other tables, and `ticket_data` is written as `{}`. The club's design —
   * words, colours, picture, layout — is on the ticketing config.
   *
   * **Joined on read rather than copied at issue.** Copying would leave every
   * ticket already issued blank, and would freeze a description the club later
   * corrects — a club that fixes a typo in its instructions means it to reach
   * the tickets it has already sent.
   */
  async getTicketForRendering(ticketId: string): Promise<TicketForRendering | null> {
    const result = await db.query(
      `SELECT t.id, t.ticket_reference, t.qr_code, t.customer_name, t.customer_email,
              t.qr_token, t.valid_from, t.valid_until, t.scan_status, t.status,
              e.name AS event_name, e.description AS event_description,
              e.start_date, e.end_date,
              a.name AS activity_name, a.description AS activity_description,
              c.ticket_header_text, c.ticket_instructions, c.ticket_footer_text,
              c.ticket_background_color, c.ticket_image_key, c.ticket_image_placement,
              c.ticket_layout
         FROM electronic_tickets t
         JOIN events e ON e.id = t.event_id
         LEFT JOIN event_activities a ON a.id = t.event_activity_id
         LEFT JOIN event_ticketing_config c ON c.event_id = t.event_id
        WHERE t.id = $1`,
      [ticketId]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    return {
      ticketReference: row.ticket_reference,
      qrCode: row.qr_code,
      // What the QR is drawn from — see `ElectronicTicket.qrToken`.
      qrToken: row.qr_token ?? row.qr_code,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      eventName: row.event_name,
      eventDescription: row.event_description ?? null,
      activityName: row.activity_name ?? null,
      activityDescription: row.activity_description ?? null,
      startDate: row.start_date ? new Date(row.start_date).toISOString() : null,
      endDate: row.end_date ? new Date(row.end_date).toISOString() : null,
      headerText: row.ticket_header_text ?? null,
      instructions: row.ticket_instructions ?? null,
      footerText: row.ticket_footer_text ?? null,
      backgroundColour: row.ticket_background_color ?? null,
      // Null placement where there is no picture: a "background" with nothing
      // behind it is a plain dark rectangle nobody chose.
      imagePlacement: row.ticket_image_key ? (row.ticket_image_placement ?? null) : null,
      imageUrl: row.ticket_image_key ? await this.signImage(row.ticket_image_key) : null,
      layout: row.ticket_layout ?? 'stacked',
    };
  }

  /**
   * A signed URL for the ticket's picture, or nothing.
   *
   * Quiet on failure: the picture is decoration and the ticket is the code. A
   * ticket that will not render because an S3 object went astray is a ticket
   * nobody can get through the gate with.
   */
  private async signImage(key: string): Promise<string | null> {
    try {
      return await fileUploadService.getFileUrl(key, TICKET_IMAGE_URL_TTL_SECONDS);
    } catch (error) {
      logger.warn('Could not sign a ticket image URL', { key, error });
      return null;
    }
  }

  /** Attach an uploaded image to an event's ticket design. */
  async setTicketImage(
    eventId: string,
    image: { s3Key: string; mimeType: string; placement?: string | null }
  ): Promise<{ config: EventTicketingConfig; previousKey: string | null }> {
    const previous = await db.query(
      `SELECT ticket_image_key FROM event_ticketing_config WHERE event_id = $1`,
      [eventId]
    );
    if (previous.rows.length === 0) {
      throw new Error('Ticketing configuration not found');
    }

    const result = await db.query(
      `UPDATE event_ticketing_config
          SET ticket_image_key = $2, ticket_image_mime = $3,
              ticket_image_placement = COALESCE($4, ticket_image_placement, 'header'),
              updated_at = NOW()
        WHERE event_id = $1
        RETURNING *`,
      [eventId, image.s3Key, image.mimeType, assertPlacement(image.placement)]
    );

    return {
      config: this.rowToTicketingConfig(result.rows[0]),
      previousKey: previous.rows[0].ticket_image_key ?? null,
    };
  }

  /**
   * Forget the picture, and report the key that was there.
   *
   * Read before the update rather than from `RETURNING`, which gives the new
   * row — the same trap `platform_posts` fell into, where every replaced image
   * stayed in the bucket with nothing left knowing its key.
   */
  async clearTicketImage(
    eventId: string
  ): Promise<{ config: EventTicketingConfig; previousKey: string | null }> {
    const previous = await db.query(
      `SELECT ticket_image_key FROM event_ticketing_config WHERE event_id = $1`,
      [eventId]
    );
    if (previous.rows.length === 0) {
      throw new Error('Ticketing configuration not found');
    }

    const result = await db.query(
      `UPDATE event_ticketing_config
          SET ticket_image_key = NULL, ticket_image_mime = NULL,
              ticket_image_placement = NULL, updated_at = NOW()
        WHERE event_id = $1
        RETURNING *`,
      [eventId]
    );

    return {
      config: this.rowToTicketingConfig(result.rows[0]),
      previousKey: previous.rows[0].ticket_image_key ?? null,
    };
  }

  /** The config with a signed image URL, for a screen that renders the ticket. */
  async getTicketingConfigForDesign(eventId: string): Promise<EventTicketingConfig | null> {
    const config = await this.getTicketingConfigByEvent(eventId);
    if (!config) return null;
    return {
      ...config,
      ticketImageUrl: config.ticketImageKey ? await this.signImage(config.ticketImageKey) : null,
    };
  }

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
   * Issue the ticket for a confirmed event entry.
   *
   * Called from fulfilment, at the moment an entry becomes real — a successful
   * card payment, or an org admin recording an offline payment. That is the
   * same transition that activates a membership, which is why it lives on the
   * confirmation path rather than in a job that sweeps for unticketed entries:
   * a member who has paid should not have to wait for a sweep, and a sweep has
   * no way to tell "not issued yet" from "deliberately not issued".
   *
   * Returns null, rather than throwing, when the event is not ticketed. Most
   * events are not, and an unticketed event is not an error — it is the normal
   * case, and fulfilment must not fail because of it.
   *
   * **Never let this break fulfilment.** The caller treats a throw as
   * non-fatal: the member has paid and their entry exists, so failing to
   * produce a ticket is a problem to fix afterwards, not a reason to fail the
   * payment they already made.
   */
  async issueTicketForEntry(eventEntryId: string): Promise<ElectronicTicket | null> {
    const entry = await db.query(
      `SELECT en.id, en.event_id, en.event_activity_id, en.user_id,
              en.first_name, en.last_name, en.email,
              e.start_date, e.end_date,
              c.generate_electronic_tickets, c.ticket_validity_period,
              a.tickets_admit
       FROM event_entries en
       JOIN events e ON e.id = en.event_id
       LEFT JOIN event_ticketing_config c ON c.event_id = en.event_id
       LEFT JOIN event_activities a ON a.id = en.event_activity_id
       WHERE en.id = $1`,
      [eventEntryId]
    );

    if (entry.rows.length === 0) {
      throw new Error(`No event entry ${eventEntryId} to issue a ticket for`);
    }

    const row = entry.rows[0];

    // No config row, or configured off: this event does not use tickets.
    if (!row.generate_electronic_tickets) {
      return null;
    }

    /*
     * Validity window. `ticket_validity_period` is a number of days *after* the
     * event starts; with none configured the ticket is valid until the end of
     * the event's last day, which is what a gate actually needs.
     *
     * `valid_from` is the start of the event day rather than the moment of
     * issue, so a ticket bought weeks early does not read as valid-since-March
     * on the ticket face.
     */
    const validFrom = new Date(row.start_date);
    const validUntil = new Date(row.end_date ?? row.start_date);
    if (row.ticket_validity_period) {
      validUntil.setDate(validUntil.getDate() + Number(row.ticket_validity_period));
    }
    validUntil.setHours(23, 59, 59, 999);

    const customerName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();

    /*
     * The reference number comes from a sequence, and the insert is idempotent
     * on the entry. A replayed Stripe webhook re-runs fulfilment; without
     * ON CONFLICT the member ends up holding two tickets that both scan valid.
     */
    const result = await db.query(
      `INSERT INTO electronic_tickets
         (ticket_reference, event_id, event_activity_id, event_entry_id, user_id,
          customer_name, customer_email, valid_from, valid_until, status, ticket_data,
          admits)
       VALUES
         ('TKT-' || to_char(NOW(), 'YYYY') || '-' ||
            lpad(nextval('electronic_ticket_reference_seq')::text, 6, '0'),
          $1, $2, $3, $4, $5, $6, $7, $8, 'issued', '{}'::jsonb, $9)
       ON CONFLICT (event_entry_id) DO NOTHING
       RETURNING *`,
      [
        row.event_id,
        row.event_activity_id,
        eventEntryId,
        row.user_id,
        customerName,
        row.email,
        validFrom,
        validUntil,
        /*
         * Copied onto the ticket rather than read live through a join at the
         * gate, because it is what the holder was sold: a club that changes the
         * activity in March must not change what a February ticket lets
         * somebody through with. Entries with no activity admit one.
         */
        Math.max(1, Number(row.tickets_admit ?? 1)),
      ]
    );

    // Conflict: a ticket already exists for this entry, which is success.
    if (result.rows.length === 0) {
      const existing = await db.query(
        'SELECT * FROM electronic_tickets WHERE event_entry_id = $1',
        [eventEntryId]
      );
      return existing.rows.length ? this.rowToTicket(existing.rows[0]) : null;
    }

    /*
     * Signed after the insert, not before, because the token contains the
     * `qr_code` the database generated. A second statement rather than a
     * trigger or a generated column: the key lives in this process, not in
     * Postgres.
     *
     * A failure here is **not** fatal to issuing. The ticket already exists and
     * is valid; without a token it simply carries its plain identifier, which
     * is what every ticket carried before signing existed.
     */
    const issued = result.rows[0];
    const token = signTicketCode(issued.qr_code, issued.event_id, issued.valid_until);

    if (token) {
      const signed = await db.query(
        `UPDATE electronic_tickets SET qr_token = $2, updated_at = NOW()
          WHERE id = $1 RETURNING *`,
        [issued.id, token]
      );
      if (signed.rows.length > 0) {
        logger.info(`Issued ticket ${signed.rows[0].ticket_reference} for entry ${eventEntryId}`);
        return this.rowToTicket(signed.rows[0]);
      }
    }

    logger.info(`Issued ticket ${issued.ticket_reference} for entry ${eventEntryId}`);
    return this.rowToTicket(issued);
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
      /*
       * The presented code may be a signed token or the bare identifier a
       * pre-signing ticket carries; either resolves to the identifier the row
       * is keyed by. A code that is neither — a forgery, or a QR from another
       * system entirely — resolves to nothing and is answered as *not found*,
       * which is what it is.
       */
      const identifier = ticketIdFromCode(qrCode);
      if (!identifier) return null;

      const result = await db.query(
        'SELECT * FROM electronic_tickets WHERE qr_code = $1',
        [identifier]
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
   * Admit somebody by hand, or take that back.
   *
   * The club's own way in, for the ticket presented at a desk with no phone to
   * hand. It answers the same two questions the gate does and must answer them
   * the same way, because a ticket does not care which door it came through.
   *
   * ## The ceiling is in the statement
   *
   * `WHERE scan_count < admits` — so a ticket that admits four lets four people
   * through here and refuses the fifth, exactly as it does at the gate. This
   * used to be `scan_count = scan_count + 1` with no comparison at all, which
   * meant the number an activity was configured with was enforced at the gate
   * and ignored on this screen: an administrator could mark a one-use ticket
   * scanned indefinitely and the count simply climbed.
   *
   * ## Who did it comes from the token
   *
   * `scannedBy` is the acting administrator's `organization_users.id`, taken by
   * the route from the verified request and **never from the body** — it is the
   * accountability record for letting somebody in, on the same rule as
   * `requestedBy` on a refund. Their name is resolved here and written onto the
   * history row as well as the id, because `scanned_by` is a foreign key and
   * the history has to outlive the row it points at.
   *
   * Undoing decrements rather than merely relabelling, so a mistake corrected
   * gives the place back.
   */
  async updateTicketScanStatus(
    ticketId: string,
    scanStatus: 'scanned' | 'not_scanned',
    scanLocation?: string,
    scannedBy?: string
  ): Promise<ElectronicTicket> {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      /*
       * The administrator, by name. Looked up rather than passed in: the route
       * has an id it verified, and a name a caller supplies is a name a caller
       * chose. Absent where the id is (an older client, or a path that does not
       * set it) — the row still records the id and the trail still reads.
       */
      let scannedByName: string | null = null;
      if (scannedBy) {
        const actor = await client.query(
          `SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS name, email
             FROM organization_users WHERE id = $1`,
          [scannedBy]
        );
        const row = actor.rows[0];
        scannedByName = (row?.name?.trim() || row?.email) ?? null;
      }

      const scanned = scanStatus === 'scanned';

      /*
       * One statement for each direction, and in the admitting one the ceiling
       * is part of it: whether a row comes back **is** whether there was room.
       *
       * `scan_status` follows the count rather than the button — a ticket that
       * admits four and has been used twice is scanned, and only returns to
       * not_scanned when the last of them is undone.
       */
      const updated = scanned
        ? await client.query(
            `UPDATE electronic_tickets
                SET scan_count = scan_count + 1,
                    scan_status = 'scanned',
                    scan_date = NOW(),
                    scan_location = COALESCE($2, scan_location),
                    updated_at = NOW()
              WHERE id = $1
                AND scan_count < admits
              RETURNING *`,
            [ticketId, scanLocation ?? null]
          )
        : await client.query(
            `UPDATE electronic_tickets
                SET scan_count = GREATEST(scan_count - 1, 0),
                    scan_status = CASE WHEN GREATEST(scan_count - 1, 0) > 0
                                       THEN 'scanned' ELSE 'not_scanned' END,
                    scan_date = CASE WHEN GREATEST(scan_count - 1, 0) > 0
                                     THEN scan_date ELSE NULL END,
                    updated_at = NOW()
              WHERE id = $1
              RETURNING *`,
            [ticketId]
          );

      if (updated.rows.length === 0) {
        /*
         * Nothing came back. Either the ticket does not exist, or it does and
         * has no room left — two different sentences for the administrator, so
         * they are told apart rather than both reported as "not found".
         */
        const existing = await client.query(
          'SELECT scan_count, admits FROM electronic_tickets WHERE id = $1',
          [ticketId]
        );

        if (existing.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new NotFoundError('Ticket not found');
        }

        const { scan_count: used, admits } = existing.rows[0];

        // Recorded, because a refusal at a desk is as much a fact about the
        // ticket as an admission is.
        await client.query(
          `INSERT INTO ticket_scan_history
             (ticket_id, scan_location, scanned_by, scanned_by_name, scan_result,
              refusal_reason, scanned_at, notes)
           VALUES ($1, $2, $3, $4, 'refused', 'already_used', NOW(), $5)`,
          [
            ticketId,
            scanLocation ?? null,
            scannedBy ?? null,
            scannedByName,
            `Refused: already used ${used} of ${admits}`,
          ]
        );
        await client.query('COMMIT');

        throw new AppError(
          409,
          'TICKET_FULLY_USED',
          admits === 1
            ? 'This ticket has already been used.'
            : `This ticket admits ${admits} and all ${admits} have been used.`
        );
      }

      if (scanned) {
        await client.query(
          `INSERT INTO ticket_scan_history
             (ticket_id, scan_location, scanned_by, scanned_by_name, scan_result,
              scanned_at, notes)
           VALUES ($1, $2, $3, $4, 'success', NOW(), $5)`,
          [
            ticketId,
            scanLocation ?? null,
            scannedBy ?? null,
            scannedByName,
            `Admitted ${updated.rows[0].scan_count} of ${updated.rows[0].admits}`,
          ]
        );
      }

      await client.query('COMMIT');

      logger.info(`Ticket scan status updated: ${ticketId} -> ${scanStatus}`, {
        used: updated.rows[0].scan_count,
        admits: updated.rows[0].admits,
      });
      return this.rowToTicket(updated.rows[0]);
    } catch (error) {
      /*
       * A rollback that itself fails must not replace the error that caused it
       * — the second exception would hide the first, which is the one worth
       * reading. `try` rather than `.catch()` on the result, because a client
       * is not obliged to hand back a promise.
       */
      try {
        await client.query('ROLLBACK');
      } catch {
        /* Already unwound, or the connection is gone. */
      }
      if (error instanceof AppError || error instanceof NotFoundError) throw error;
      logger.error('Error updating ticket scan status:', error);
      throw error;
    } finally {
      client.release();
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
        /*
         * The steward's name as they typed it at the gate. Written onto the
         * row rather than joined, because the device it came from is deleted
         * with its session and the history has to outlive it.
         */
        scannedByName: row.scanned_by_name ?? null,
        /* Set on the presentations that were turned away. */
        refusalReason: row.refusal_reason ?? null,
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
