/* eslint-disable camelcase */

/**
 * One audit trail for the whole platform.
 *
 * Replaces `admin_audit_log` and `organization_audit_log`, which overlapped and
 * between them held one row. The old design could not say **who** did anything:
 * its actor was a foreign key into `users`, a table this platform never
 * populates — identity here is `organization_users.keycloak_user_id` — so every
 * write resolved the actor to null. An audit log that records what but never
 * who is not an audit log.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md.
 *
 * ## The actor is not a foreign key, deliberately
 *
 * Three kinds of person act here — a super admin, an org admin, an account user
 * — and they are not one table. More importantly an audit row has to **outlive
 * the user it describes**: "who deleted this account?" is precisely the question
 * you cannot answer if deleting the account cascades the evidence away. The
 * Keycloak subject is the one identifier that means the same thing everywhere,
 * and the name and email are copied in at write time so a later rename does not
 * rewrite history.
 *
 * ## Partitioned by month from the start
 *
 * Retention will eventually mean deleting old events, and `DELETE FROM
 * audit_events WHERE occurred_at < …` over millions of rows is a long
 * transaction that holds locks and leaves bloat. Dropping a partition is
 * instant. Partitioning later would mean rewriting the table; partitioning now
 * costs one helper that creates next month's partition.
 *
 * The primary key includes `occurred_at` because Postgres requires the partition
 * key to be part of every unique constraint.
 */

exports.up = (pgm) => {
  // Trigram index support, for the free-text search over `search_text`.
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm');

  pgm.sql(`
    CREATE TABLE audit_events (
      id                uuid        NOT NULL DEFAULT gen_random_uuid(),
      occurred_at       timestamptz NOT NULL DEFAULT NOW(),

      -- Who. See the note above on why none of this is a foreign key.
      actor_kc_user_id  varchar(64),
      actor_user_type   varchar(20) NOT NULL,
      actor_display     varchar(255),
      actor_email       varchar(255),

      -- Where. Null for platform-level actions with no organisation.
      organisation_id   uuid,

      -- What.
      category          varchar(40) NOT NULL,
      action            varchar(80) NOT NULL,
      outcome           varchar(20) NOT NULL DEFAULT 'success',
      entity_type       varchar(60),
      entity_id         varchar(64),
      -- The human name of the thing, so a reader never has to resolve an id.
      entity_label      varchar(255),

      -- Detail. \`changes\` is { field: { from, to } }, or { created } / { deleted }.
      changes           jsonb,
      context           jsonb,

      -- Everything the free-text filter searches, flattened at write time.
      search_text       text,

      PRIMARY KEY (id, occurred_at)
    ) PARTITION BY RANGE (occurred_at)
  `);

  /*
   * The filters the screens actually use, in the order they are combined:
   * a time range always, then organisation / actor / category / action.
   * `occurred_at DESC` because every view is newest-first.
   */
  pgm.sql(`CREATE INDEX audit_events_occurred_idx ON audit_events (occurred_at DESC)`);
  pgm.sql(`CREATE INDEX audit_events_org_idx ON audit_events (organisation_id, occurred_at DESC)`);
  pgm.sql(`CREATE INDEX audit_events_actor_idx ON audit_events (actor_kc_user_id, occurred_at DESC)`);
  pgm.sql(`CREATE INDEX audit_events_category_idx ON audit_events (category, occurred_at DESC)`);
  pgm.sql(`CREATE INDEX audit_events_action_idx ON audit_events (action, occurred_at DESC)`);
  pgm.sql(`CREATE INDEX audit_events_user_type_idx ON audit_events (actor_user_type, occurred_at DESC)`);
  /*
   * Free text. A trigram index is what makes `ILIKE '%KHP-0241%'` usable —
   * without it the search table-scans, which is exactly where an investigation
   * goes when it is looking for one membership number.
   */
  pgm.sql(`CREATE INDEX audit_events_search_idx ON audit_events USING gin (search_text gin_trgm_ops)`);

  /*
   * Partitions for the current month and the next two, plus a catch-all for
   * anything that arrives with a timestamp outside them.
   *
   * A row with no partition is an *error*, not a silent drop, so the default
   * partition exists to make that visible rather than to be relied on: the
   * rotation helper (`audit-partitions.ts`) keeps real months ahead of time.
   */
  pgm.sql(`
    DO $$
    DECLARE
      start_month date := date_trunc('month', NOW())::date;
      i int;
      from_date date;
      to_date date;
    BEGIN
      FOR i IN -1..2 LOOP
        from_date := (start_month + (i || ' month')::interval)::date;
        to_date   := (start_month + ((i + 1) || ' month')::interval)::date;
        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS audit_events_%s PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
          to_char(from_date, 'YYYYMM'), from_date, to_date
        );
      END LOOP;
    END $$
  `);

  pgm.sql(`CREATE TABLE IF NOT EXISTS audit_events_default PARTITION OF audit_events DEFAULT`);

  /*
   * Carry the old rows across.
   *
   * `organization_audit_log` holds one row and `admin_audit_log` none, so this
   * is a formality — but a formality worth performing, because "we dropped the
   * old audit log" should never be true without "and we kept what was in it".
   *
   * The actor is left null: the old row's `user_id` was already null, for the
   * reason this whole table exists.
   *
   * Guarded on the source table existing, and the drops below tolerate its
   * absence. Written unguarded, this migration could only ever run against a
   * database that still had both old tables: if it failed anywhere after the
   * drops — or was reversed, or the table was lost some other way — every
   * re-run died on `relation "organization_audit_log" does not exist`, leaving
   * an environment with no audit table and no way to build one. That is
   * precisely the state itsps.org was in.
   */
  pgm.sql(`
    DO $$
    BEGIN
      IF to_regclass('public.organization_audit_log') IS NOT NULL THEN
        INSERT INTO audit_events (
          occurred_at, actor_user_type, organisation_id,
          category, action, outcome, entity_type, entity_id, changes, search_text
        )
        SELECT
          created_at,
          'system',
          organization_id,
          'security',
          action,
          'success',
          entity_type,
          entity_id::text,
          changes,
          concat_ws(' ', action, entity_type, changes::text)
        FROM organization_audit_log;
      END IF;
    END $$
  `);

  pgm.dropTable('organization_audit_log', { ifExists: true });
  pgm.dropTable('admin_audit_log', { ifExists: true });
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS audit_events CASCADE');

  // Recreated empty. The rows migrated up cannot be split back apart, and
  // pretending otherwise would be worse than saying so.
  pgm.sql(`
    CREATE TABLE admin_audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      action varchar(100) NOT NULL,
      resource varchar(100) NOT NULL,
      resource_id varchar(255),
      changes jsonb,
      ip_address varchar(45),
      timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  pgm.sql(`
    CREATE TABLE organization_audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      user_id uuid,
      action varchar(100) NOT NULL,
      entity_type varchar(100) NOT NULL,
      entity_id uuid,
      changes jsonb,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};
