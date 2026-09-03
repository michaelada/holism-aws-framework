import crypto from 'crypto';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError, AppError } from '../middleware/errors';
import { parseTicketCode } from './ticket-token.service';

/**
 * Scanning tickets at a gate.
 *
 * Two things live here, and they are two halves of one idea: **who may scan**
 * (a short-lived session, a PIN, and a named steward's phone) and **what a scan
 * decides** (one atomic statement, and a refusal that says why).
 *
 * ## The admission is the `UPDATE`
 *
 * Not a lookup followed by a write. Whether a row comes back from
 *
 * ```sql
 * UPDATE … SET scan_count = scan_count + 1 WHERE qr_code = $1 AND scan_count < admits …
 * ```
 *
 * **is** the decision. Two stewards on two gates scanning the same code in the
 * same second are serialised by the row lock and exactly one wins. The flow
 * this replaces read the ticket, then incremented with no ceiling, so both got
 * through and the count went up twice.
 *
 * ## A steward is not an administrator
 *
 * They are a volunteer for the afternoon. The credential they get reaches one
 * event's tickets and nothing else — not the club's members, not its payments,
 * not another event — and it expires by itself, which is the only kind of
 * permission nobody has to remember to take away.
 *
 * See docs/GATE_SCANNING.md.
 */

/** Long enough that guessing the link is not a strategy. */
const LINK_TOKEN_BYTES = 24;
const DEVICE_TOKEN_BYTES = 32;

/**
 * Six digits, because a steward types it on a phone in a field.
 *
 * The small space is answered by the attempt limit below rather than by
 * length: a longer PIN read aloud across a car park is a PIN typed wrongly.
 */
const PIN_DIGITS = 6;

/**
 * Wrong PINs a session tolerates before it stops answering.
 *
 * Ten is generous for somebody mistyping and hopeless for somebody guessing
 * one of a million. The counter is per session, so one gate's fat fingers
 * cannot lock out another club.
 */
const MAX_PIN_ATTEMPTS = 10;

/** How long a session may last, whatever a club asks for. */
const MAX_SESSION_HOURS = 24 * 7;

export type RefusalReason =
  | 'not_found'
  | 'wrong_event'
  | 'already_used'
  | 'expired'
  | 'cancelled'
  | 'withdrawn'
  /**
   * The code was not issued by us: the tag does not match, or it names a
   * signing key this server does not have. Distinct from `not_found`, which is
   * a well-formed code for a ticket we do not hold — one is a forgery or a
   * corrupted read, the other is somebody else's ticket. A steward reads them
   * as the same red screen; the club reading the history afterwards should not.
   */
  | 'forged';

export interface ScanSession {
  id: string;
  eventId: string;
  eventName: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  /** Live now: not revoked and not past its expiry. */
  active: boolean;
  /** The stewards who have unlocked it, most recently seen first. */
  stewards: Array<{ name: string; lastSeenAt: string | null; scans: number }>;
}

export interface ScanOutcome {
  qrCode: string;
  admitted: boolean;
  reason?: RefusalReason;
  holderName?: string;
  activityName?: string;
  /** After this scan: 2 of 4 admitted on a family ticket. */
  used?: number;
  admits?: number;
  /** For `already_used`: when and where it went through before. */
  previousScanAt?: string | null;
  previousScanBy?: string | null;
}

/** One ticket as a scanner holds it offline. */
export interface ManifestTicket {
  /** The ticket's identifier — what the scanner matches a presented code to. */
  qrCode: string;
  ticketReference: string;
  holderName: string;
  activityName: string | null;
  admits: number;
  used: number;
  validUntil: string;
  /** Cancelled, or the entry it belongs to was withdrawn. */
  void: boolean;
}

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

/**
 * scrypt, with a per-session salt.
 *
 * Not sha256: a six-digit PIN is a million candidates, and a plain hash of one
 * is guessed in the time it takes to read this sentence. The work factor makes
 * each guess cost something even if the table leaks.
 */
const hashPin = (pin: string, salt: string): string =>
  crypto.scryptSync(pin, salt, 32).toString('hex');

const randomPin = (): string =>
  String(crypto.randomInt(0, 10 ** PIN_DIGITS)).padStart(PIN_DIGITS, '0');

export class GateScanService {
  /**
   * A club's permission to scan one event, for a while.
   *
   * The PIN is returned **once**, here, and never again: what is stored is a
   * hash, so a club that loses it creates another session rather than being
   * told what the old one was.
   */
  async createSession(
    organisationId: string,
    eventId: string,
    options: { hours?: number; createdBy?: string | null } = {}
  ): Promise<{ session: ScanSession; token: string; pin: string }> {
    const hours = Math.min(Math.max(Math.round(options.hours ?? 12), 1), MAX_SESSION_HOURS);

    const event = await db.query(
      `SELECT id, name FROM events WHERE id = $1 AND organisation_id = $2`,
      [eventId, organisationId]
    );
    if (event.rows.length === 0) throw new NotFoundError('Event not found');

    const token = crypto.randomBytes(LINK_TOKEN_BYTES).toString('base64url');
    const pin = randomPin();
    const salt = crypto.randomBytes(16).toString('hex');

    const result = await db.query(
      `INSERT INTO ticket_scan_sessions
         (organisation_id, event_id, token, pin_hash, pin_salt, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' hours')::interval, $7)
       RETURNING *`,
      [organisationId, eventId, token, hashPin(pin, salt), salt, String(hours), options.createdBy ?? null]
    );

    logger.info('Gate scanning session created', { eventId, hours });

    return {
      session: await this.toSession(result.rows[0], event.rows[0].name),
      token,
      pin,
    };
  }

  /** Every session a club has made for one event, newest first. */
  async listSessions(organisationId: string, eventId: string): Promise<ScanSession[]> {
    const result = await db.query(
      `SELECT s.*, e.name AS event_name
         FROM ticket_scan_sessions s
         JOIN events e ON e.id = s.event_id
        WHERE s.organisation_id = $1 AND s.event_id = $2
        ORDER BY s.created_at DESC`,
      [organisationId, eventId]
    );

    return Promise.all(result.rows.map((row) => this.toSession(row, row.event_name)));
  }

  /**
   * Cut a session short.
   *
   * A phone left in a field, or a day that ended early. Revoking stops every
   * device on that session at once, which is the point of them sharing one.
   */
  async revokeSession(organisationId: string, sessionId: string): Promise<void> {
    const result = await db.query(
      `UPDATE ticket_scan_sessions SET revoked_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND organisation_id = $2 AND revoked_at IS NULL
        RETURNING id`,
      [sessionId, organisationId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Scanning session not found');
  }

  /**
   * A steward's phone, unlocked with a name and the PIN.
   *
   * The name is the substance: it is written onto every scan that phone makes,
   * so a club reading the history afterwards sees a person rather than a
   * device id. Asked for rather than derived, because a volunteer has no
   * account to derive it from.
   */
  async unlock(
    token: string,
    stewardName: string,
    pin: string
  ): Promise<{ deviceToken: string; eventId: string; eventName: string; expiresAt: string; stewardName: string }> {
    const name = stewardName?.trim() ?? '';
    if (!name) throw new ValidationError('Enter your name, so the club knows who scanned');
    if (name.length > 120) throw new ValidationError('That name is too long');

    const found = await db.query(
      `SELECT s.*, e.name AS event_name
         FROM ticket_scan_sessions s
         JOIN events e ON e.id = s.event_id
        WHERE s.token = $1`,
      [token]
    );

    /*
     * A link that is not ours, a link that has expired and a link that was
     * revoked answer alike. Telling them apart would make this endpoint a way
     * of learning which links are real.
     */
    const session = found.rows[0];
    if (
      !session ||
      session.revoked_at ||
      new Date(session.expires_at) <= new Date() ||
      session.failed_attempts >= MAX_PIN_ATTEMPTS
    ) {
      throw new AppError(403, 'SCAN_LINK_INVALID', 'This scanning link is no longer valid.');
    }

    if (hashPin(pin ?? '', session.pin_salt) !== session.pin_hash) {
      // Counted on the session, so guessing burns the link rather than one
      // phone — and a club can see it happened.
      await db.query(
        `UPDATE ticket_scan_sessions SET failed_attempts = failed_attempts + 1, updated_at = NOW()
          WHERE id = $1`,
        [session.id]
      );
      throw new AppError(403, 'SCAN_PIN_WRONG', 'That PIN is not right.');
    }

    const deviceToken = crypto.randomBytes(DEVICE_TOKEN_BYTES).toString('base64url');

    await db.query(
      `INSERT INTO ticket_scan_devices (session_id, steward_name, token_hash, last_seen_at)
       VALUES ($1, $2, $3, NOW())`,
      [session.id, name, sha256(deviceToken)]
    );

    // A correct PIN clears the count: the limit is against guessing, not
    // against a steward who mistyped twice before getting it right.
    await db.query(
      `UPDATE ticket_scan_sessions SET failed_attempts = 0, updated_at = NOW() WHERE id = $1`,
      [session.id]
    );

    logger.info('Gate scanner unlocked', { eventId: session.event_id, steward: name });

    return {
      deviceToken,
      eventId: session.event_id,
      eventName: session.event_name,
      expiresAt: new Date(session.expires_at).toISOString(),
      stewardName: name,
    };
  }

  /**
   * The device behind a scanner token, if it may still scan.
   *
   * Read on every scanner request. The session's expiry and revocation are
   * checked here rather than at unlock alone, so cutting a session short stops
   * a phone that is already scanning.
   */
  async deviceFor(deviceToken: string): Promise<{
    deviceId: string;
    sessionId: string;
    stewardName: string;
    eventId: string;
    organisationId: string;
  } | null> {
    const result = await db.query(
      `SELECT d.id, d.session_id, d.steward_name, s.event_id, s.organisation_id
         FROM ticket_scan_devices d
         JOIN ticket_scan_sessions s ON s.id = d.session_id
        WHERE d.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()`,
      [sha256(deviceToken ?? '')]
    );

    const row = result.rows[0];
    if (!row) return null;

    void db
      .query(`UPDATE ticket_scan_devices SET last_seen_at = NOW() WHERE id = $1`, [row.id])
      .catch(() => undefined);

    return {
      deviceId: row.id,
      sessionId: row.session_id,
      stewardName: row.steward_name,
      eventId: row.event_id,
      organisationId: row.organisation_id,
    };
  }

  /**
   * Every ticket for one event, as a scanner holds it offline.
   *
   * A few hundred rows and tens of kilobytes: small enough to fetch on unlock,
   * which is what lets a gate keep working in a field with no signal.
   *
   * `void` folds together the two ways a ticket stops being one — cancelled,
   * or the entry behind it withdrawn with a refund — because a gate does not
   * care which it was.
   */
  async manifest(eventId: string): Promise<ManifestTicket[]> {
    const result = await db.query(
      `SELECT t.qr_code, t.qr_token, t.ticket_reference, t.customer_name, t.admits, t.scan_count,
              t.valid_until, t.status,
              a.name AS activity_name,
              en.entry_status
         FROM electronic_tickets t
         LEFT JOIN event_activities a ON a.id = t.event_activity_id
         LEFT JOIN event_entries en ON en.id = t.event_entry_id
        WHERE t.event_id = $1
        ORDER BY t.customer_name`,
      [eventId]
    );

    return result.rows.map((row) => ({
      qrCode: row.qr_code,
      ticketReference: row.ticket_reference,
      holderName: row.customer_name,
      activityName: row.activity_name ?? null,
      admits: row.admits ?? 1,
      used: row.scan_count ?? 0,
      validUntil: new Date(row.valid_until).toISOString(),
      void: row.status !== 'issued' || row.entry_status === 'removed',
    }));
  }

  /**
   * Admit somebody, or say why not.
   *
   * The `UPDATE` is the decision: a row back means admitted, and nothing back
   * means the ticket did not qualify — which is then explained by a second,
   * cheap read. Every presentation is written to the history, **including the
   * refusals**, because a duplicate at a gate is exactly what a club wants to
   * look at afterwards.
   */
  async scan(
    device: { deviceId: string; stewardName: string; eventId: string },
    scan: { qrCode: string; scannedAt?: string; location?: string }
  ): Promise<ScanOutcome> {
    const at = scan.scannedAt ? new Date(scan.scannedAt) : new Date();
    const when = Number.isNaN(at.getTime()) ? new Date() : at;

    /*
     * What was presented, read before anything is looked up.
     *
     * A signed token carries its own claims — which event, and until when — so
     * a forgery and a code for another club's event are refused here without
     * touching a ticket row. A pre-signing ticket carries a bare identifier and
     * carries no claims, so it is resolved and judged exactly as it was before.
     */
    const presented = parseTicketCode(scan.qrCode);

    if (presented.kind === 'invalid') {
      // Nothing to write history against: no ticket is named by a code we did
      // not mint. The club sees it in the session's refusals.
      logger.warn('Refused a ticket code that was not issued by us', {
        eventId: device.eventId,
        reason: presented.reason,
      });
      return { qrCode: scan.qrCode, admitted: false, reason: 'forged' };
    }

    /*
     * The token says which event it is for, and it is signed, so this is
     * decided without a query. The `UPDATE` below checks the same thing against
     * the row — a legacy code has no claim to check, and a claim is only worth
     * as much as the row that backs it.
     */
    if (presented.kind === 'signed' && presented.eventId !== device.eventId) {
      return await this.refuse(device, presented.qrCode, when, scan.location, 'wrong_event');
    }

    const admitted = await db.query(
      `UPDATE electronic_tickets t
          SET scan_count = t.scan_count + 1,
              scan_status = 'scanned',
              scan_date = $2,
              scan_location = COALESCE($3, t.scan_location),
              updated_at = NOW()
        WHERE t.qr_code = $1
          AND t.event_id = $4
          AND t.status = 'issued'
          AND t.scan_count < t.admits
          AND t.valid_until > $2
          AND NOT EXISTS (
                SELECT 1 FROM event_entries en
                 WHERE en.id = t.event_entry_id AND en.entry_status = 'removed'
              )
        RETURNING t.id, t.customer_name, t.scan_count, t.admits, t.event_activity_id`,
      [presented.qrCode, when, scan.location ?? null, device.eventId]
    );

    if (admitted.rows.length > 0) {
      const row = admitted.rows[0];
      const activity = await this.activityName(row.event_activity_id);
      await this.record(row.id, device, when, scan.location, 'success', null);

      return {
        qrCode: scan.qrCode,
        admitted: true,
        holderName: row.customer_name,
        activityName: activity ?? undefined,
        used: row.scan_count,
        admits: row.admits,
      };
    }

    return this.refuse(device, presented.qrCode, when, scan.location);
  }

  /**
   * Why the ticket did not qualify — asked only once it has not.
   *
   * `known` is passed where the caller already decided the reason from a signed
   * token's own claims. The read still happens: the club wants the holder's
   * name on the screen and the refusal in the ticket's history, and a claim in
   * a token is only worth as much as the row behind it.
   */
  private async refuse(
    device: { deviceId: string; stewardName: string; eventId: string },
    qrCode: string,
    when: Date,
    location?: string,
    known?: RefusalReason
  ): Promise<ScanOutcome> {
    const found = await db.query(
      `SELECT t.id, t.customer_name, t.event_id, t.status, t.scan_count, t.admits,
              t.valid_until, t.scan_date,
              a.name AS activity_name,
              en.entry_status,
              (SELECT h.scanned_by_name FROM ticket_scan_history h
                WHERE h.ticket_id = t.id AND h.scan_result = 'success'
                ORDER BY h.scan_date DESC LIMIT 1) AS previous_by
         FROM electronic_tickets t
         LEFT JOIN event_activities a ON a.id = t.event_activity_id
         LEFT JOIN event_entries en ON en.id = t.event_entry_id
        WHERE t.qr_code = $1`,
      [qrCode]
    );

    const row = found.rows[0];
    if (!row) {
      // Nothing to write history against; the club sees it in the session's
      // refusal count rather than on a ticket.
      return { qrCode, admitted: false, reason: 'not_found' };
    }

    const reason: RefusalReason =
      known ??
      (row.event_id !== device.eventId
        ? 'wrong_event'
        : row.status !== 'issued'
          ? 'cancelled'
          : row.entry_status === 'removed'
            ? 'withdrawn'
            : new Date(row.valid_until) <= when
              ? 'expired'
              : 'already_used');

    await this.record(row.id, device, when, location, 'refused', reason);

    return {
      qrCode,
      admitted: false,
      reason,
      holderName: row.customer_name,
      activityName: row.activity_name ?? undefined,
      used: row.scan_count,
      admits: row.admits,
      previousScanAt: row.scan_date ? new Date(row.scan_date).toISOString() : null,
      previousScanBy: row.previous_by ?? null,
    };
  }

  private async activityName(activityId: string | null): Promise<string | null> {
    if (!activityId) return null;
    const result = await db.query(`SELECT name FROM event_activities WHERE id = $1`, [activityId]);
    return result.rows[0]?.name ?? null;
  }

  /**
   * One row per presentation, refusals included.
   *
   * `scanned_at` is when the gate scanned it, which offline is earlier than
   * when it reached us; `scan_date` stays the arrival, so the two together say
   * what happened and when we learned it.
   */
  private async record(
    ticketId: string,
    device: { deviceId: string; stewardName: string },
    when: Date,
    location: string | undefined,
    result: 'success' | 'refused',
    reason: RefusalReason | null
  ): Promise<void> {
    await db.query(
      `INSERT INTO ticket_scan_history
         (ticket_id, scan_location, scan_result, scan_device_id, scanned_by_name,
          refusal_reason, scanned_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        ticketId,
        location ?? null,
        result,
        device.deviceId,
        device.stewardName,
        reason,
        when,
        reason ? `Refused: ${reason}` : 'Admitted',
      ]
    );
  }

  private async toSession(row: any, eventName: string): Promise<ScanSession> {
    const stewards = await db.query(
      `SELECT d.steward_name, d.last_seen_at,
              (SELECT COUNT(*)::int FROM ticket_scan_history h WHERE h.scan_device_id = d.id) AS scans
         FROM ticket_scan_devices d
        WHERE d.session_id = $1
        ORDER BY d.last_seen_at DESC NULLS LAST`,
      [row.id]
    );

    return {
      id: row.id,
      eventId: row.event_id,
      eventName,
      expiresAt: new Date(row.expires_at).toISOString(),
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      active: !row.revoked_at && new Date(row.expires_at) > new Date(),
      stewards: stewards.rows.map((steward: any) => ({
        name: steward.steward_name,
        lastSeenAt: steward.last_seen_at ? new Date(steward.last_seen_at).toISOString() : null,
        scans: steward.scans,
      })),
    };
  }
}

export const gateScanService = new GateScanService();
