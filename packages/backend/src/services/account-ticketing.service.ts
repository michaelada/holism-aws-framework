import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * A member's own electronic tickets.
 *
 * The org-admin side of ticketing (`ticketing.service.ts`) answers questions
 * about an *event's* tickets — how many issued, how many scanned. This answers
 * the member's question instead: which tickets are mine, and will this one get
 * me through the gate?
 *
 * Every query here is scoped by `organisation_id` **and** the caller's
 * `organization_users.id`. A ticket is a bearer credential — anyone holding the
 * QR payload can walk in — so "which ticket did you ask for" is never allowed
 * to be the only thing standing between a member and someone else's ticket.
 */

/**
 * What a member needs to know about whether a ticket will work.
 *
 * Deliberately four states rather than a boolean, because "this will not scan"
 * has four different remedies: pay, nothing, nothing, and contact the club.
 */
export type TicketState = 'valid' | 'awaiting-payment' | 'used' | 'expired';

export interface AccountTicketSummary {
  id: string;
  ticketReference: string;
  state: TicketState;
  eventId: string;
  eventName: string;
  activityName: string | null;
  eventStartDate: string;
  eventEndDate: string | null;
  entrantName: string;
  validUntil: string;
  /** Set only when the ticket has been scanned; drives the "Used …" banner. */
  scannedAt: string | null;
}

/** Everything screen C10 renders, so the ticket view needs exactly one call. */
export interface AccountTicketDetail extends AccountTicketSummary {
  /**
   * The string the member's QR encodes — a signed token for a ticket issued
   * since signing, and the bare identifier for one issued before it. Named
   * `qrCode` because that is what the screen draws; the identifier the ticket
   * is looked up by is never sent to the member's device.
   */
  qrCode: string;
  entrantEmail: string;
  validFrom: string | null;
  organisationName: string;
  /** From `event_ticketing_config` — the org's wording and styling. */
  config: {
    headerText: string | null;
    instructions: string | null;
    footerText: string | null;
    backgroundColour: string | null;
  };
}

/*
 * State is computed in SQL rather than in TypeScript so the list and the detail
 * view can never disagree about whether a ticket is usable — the two screens
 * are looked at within seconds of each other at a gate.
 *
 * Order matters. A used ticket that is also expired reads as "used": the member
 * wants to know it worked, not that it has since lapsed.
 */
const STATE_SQL = `
  CASE
    WHEN t.scan_count > 0 OR t.scan_status = 'scanned' THEN 'used'
    WHEN en.payment_status <> 'paid' THEN 'awaiting-payment'
    WHEN t.valid_until < NOW() THEN 'expired'
    ELSE 'valid'
  END`;

const BASE_SELECT = `
  SELECT t.id, t.ticket_reference, t.qr_code, t.qr_token, t.valid_from, t.valid_until,
         t.scan_date, t.customer_name, t.customer_email,
         e.id AS event_id, e.name AS event_name, e.start_date, e.end_date,
         a.name AS activity_name,
         ${STATE_SQL} AS state
  FROM electronic_tickets t
  JOIN event_entries en ON en.id = t.event_entry_id
  JOIN events e ON e.id = t.event_id
  LEFT JOIN event_activities a ON a.id = t.event_activity_id
  WHERE e.organisation_id = $1 AND t.user_id = $2`;

function toSummary(row: any): AccountTicketSummary {
  return {
    id: row.id,
    ticketReference: row.ticket_reference,
    state: row.state,
    eventId: row.event_id,
    eventName: row.event_name,
    activityName: row.activity_name ?? null,
    eventStartDate: row.start_date,
    eventEndDate: row.end_date ?? null,
    entrantName: row.customer_name,
    validUntil: row.valid_until,
    scannedAt: row.scan_date ?? null,
  };
}

export class AccountTicketingService {
  /**
   * The member's tickets, soonest event first.
   *
   * Sorted by event date rather than by issue date because of where this screen
   * is used: standing at a gate, the ticket you want is almost always the next
   * event, not the most recently bought one.
   *
   * Cancelled tickets are excluded — a member cannot act on one, and showing it
   * only invites them to present it.
   */
  async listTickets(
    organisationId: string,
    organisationUserId: string
  ): Promise<AccountTicketSummary[]> {
    try {
      const result = await db.query(
        `${BASE_SELECT}
           AND t.status <> 'cancelled'
         ORDER BY e.start_date ASC, e.name ASC`,
        [organisationId, organisationUserId]
      );

      return result.rows.map(toSummary);
    } catch (error) {
      logger.error('Error listing account tickets:', error);
      throw error;
    }
  }

  /**
   * One ticket, with everything screen C10 renders.
   *
   * Returns null for a ticket that exists but belongs to someone else, exactly
   * as for one that does not exist. Distinguishing them would confirm to a
   * caller enumerating ids that a given ticket is real.
   */
  async getTicket(
    organisationId: string,
    organisationUserId: string,
    ticketId: string
  ): Promise<AccountTicketDetail | null> {
    try {
      const result = await db.query(
        `${BASE_SELECT}
           AND t.id = $3
           AND t.status <> 'cancelled'`,
        [organisationId, organisationUserId, ticketId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      const extra = await db.query(
        `SELECT o.display_name,
                c.ticket_header_text, c.ticket_instructions, c.ticket_footer_text,
                c.ticket_background_color
         FROM events e
         JOIN organizations o ON o.id = e.organisation_id
         LEFT JOIN event_ticketing_config c ON c.event_id = e.id
         WHERE e.id = $1`,
        [row.event_id]
      );

      const meta = extra.rows[0] ?? {};

      return {
        ...toSummary(row),
        /*
         * What the member's phone draws. A signed token where the ticket has
         * one; the bare identifier where it does not, so the screen scans the
         * same as the ticket already in their inbox.
         */
        qrCode: row.qr_token ?? row.qr_code,
        entrantEmail: row.customer_email,
        validFrom: row.valid_from ?? null,
        organisationName: meta.display_name ?? '',
        config: {
          headerText: meta.ticket_header_text ?? null,
          instructions: meta.ticket_instructions ?? null,
          footerText: meta.ticket_footer_text ?? null,
          backgroundColour: meta.ticket_background_color ?? null,
        },
      };
    } catch (error) {
      logger.error('Error getting an account ticket:', error);
      throw error;
    }
  }
}

export const accountTicketingService = new AccountTicketingService();
