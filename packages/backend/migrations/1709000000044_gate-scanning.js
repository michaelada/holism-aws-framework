/* eslint-disable camelcase */

/**
 * Scanning tickets at a gate.
 *
 * Four things the schema could not say, each of which a gate needs:
 *
 *  - **How many people a ticket admits.** `scan_count` counted presentations
 *    against nothing at all, so "used more than its allotted amount" was not a
 *    state the database could recognise — and a family ticket for four could
 *    not be expressed.
 *  - **Who is allowed to scan.** Scanning meant a full administrator account,
 *    which is both friction for a volunteer and a standing grant of everything
 *    else an administrator can do.
 *  - **Who scanned.** `ticket_scan_history.scanned_by` is a foreign key to
 *    `organization_users`, and a steward at a gate has no such row.
 *  - **What happened when a ticket was refused.** Only successes were written,
 *    so the duplicate a club most wants to look at afterwards left no trace.
 *
 * See docs/GATE_SCANNING.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  /**
   * How many people one of this activity's tickets admits.
   *
   * The club's setting, per activity: a day ticket admits one, a family ticket
   * four, a car pass a carful. One is the default because it is what every
   * ticket issued before this meant.
   */
  pgm.addColumns('event_activities', {
    tickets_admit: { type: 'integer', notNull: true, default: 1 },
  });

  pgm.addConstraint('event_activities', 'event_activities_tickets_admit_check', {
    check: 'tickets_admit >= 1',
  });

  /**
   * What *this* ticket admits, copied from the activity when it was issued.
   *
   * Copied rather than read live through a join, because it is what the holder
   * was sold. A club that changes the activity in March must not change what a
   * ticket bought in February lets somebody through with.
   */
  pgm.addColumns('electronic_tickets', {
    admits: { type: 'integer', notNull: true, default: 1 },
  });

  pgm.addConstraint('electronic_tickets', 'electronic_tickets_admits_check', {
    check: 'admits >= 1',
  });

  /**
   * A club's permission to scan one event, for a while.
   *
   * The link carries `token`; the PIN is what stops the link alone being
   * enough, since a link is shared in a WhatsApp group and forwarded from
   * there. `expires_at` is the point of the whole thing: permission that ends
   * by itself needs nobody to remember to take it away.
   */
  pgm.createTable('ticket_scan_sessions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organisation_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    event_id: { type: 'uuid', notNull: true, references: 'events', onDelete: 'CASCADE' },
    /** In the link. Random, opaque, and useless without the PIN. */
    token: { type: 'varchar(64)', notNull: true, unique: true },
    /**
     * scrypt, with a per-session salt.
     *
     * Six digits is a small space. The salt means a leaked table cannot be
     * attacked once for every session at the same time, and the work factor
     * means each guess costs something; the attempt limit below is what makes
     * guessing impractical while the session is live.
     */
    pin_hash: { type: 'varchar(255)', notNull: true },
    pin_salt: { type: 'varchar(64)', notNull: true },
    failed_attempts: { type: 'integer', notNull: true, default: 0 },
    expires_at: { type: 'timestamp', notNull: true },
    /** Set when a club cuts a session short — a phone left in a field. */
    revoked_at: { type: 'timestamp' },
    created_by: { type: 'uuid', references: 'organization_users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createIndex('ticket_scan_sessions', ['event_id']);

  /**
   * One steward's phone, for the length of a session.
   *
   * A row rather than a signed token, because "who is scanning" is a question
   * the club asked to be able to answer — and a row can be revoked, which a
   * token cannot.
   */
  pgm.createTable('ticket_scan_devices', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    session_id: { type: 'uuid', notNull: true, references: 'ticket_scan_sessions', onDelete: 'CASCADE' },
    /** As the steward typed it. This is the name the club will read. */
    steward_name: { type: 'varchar(120)', notNull: true },
    /** sha256 of the bearer token; the token itself is never stored. */
    token_hash: { type: 'varchar(64)', notNull: true, unique: true },
    last_seen_at: { type: 'timestamp' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createIndex('ticket_scan_devices', ['session_id']);

  pgm.addColumns('ticket_scan_history', {
    /** Which phone, so a club can tell two stewards apart. */
    scan_device_id: { type: 'uuid', references: 'ticket_scan_devices', onDelete: 'SET NULL' },
    /**
     * The steward's name, written down rather than joined.
     *
     * The device row goes when the session is deleted; the history is a record
     * and has to outlive it. A name on the row is the difference between "who
     * let this person in" having an answer next season and not.
     */
    scanned_by_name: { type: 'varchar(120)' },
    /** Where the ticket was refused, when it was: `already_used`, `expired`… */
    refusal_reason: { type: 'varchar(40)' },
    /** When the scan happened, which offline is earlier than when it arrived. */
    scanned_at: { type: 'timestamp' },
  });

  /*
   * `ticket_scan_history_ticket_id_index` already exists — the original
   * ticketing migration created it. Named explicitly here so the intent is
   * visible; creating it again is what this comment replaces.
   */
};

exports.down = (pgm) => {
  pgm.dropColumns('ticket_scan_history', [
    'scan_device_id',
    'scanned_by_name',
    'refusal_reason',
    'scanned_at',
  ]);
  pgm.dropTable('ticket_scan_devices');
  pgm.dropTable('ticket_scan_sessions');
  pgm.dropConstraint('electronic_tickets', 'electronic_tickets_admits_check');
  pgm.dropColumns('electronic_tickets', ['admits']);
  pgm.dropConstraint('event_activities', 'event_activities_tickets_admit_check');
  pgm.dropColumns('event_activities', ['tickets_admit']);
};
