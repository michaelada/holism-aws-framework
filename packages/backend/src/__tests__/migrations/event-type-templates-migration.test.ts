/**
 * Event type templates and the settings chain — migration 1709000000046.
 *
 * The spine of event scheduling (docs/EVENT_SCHEDULING_TASKS_S0_S1.md, S0-1).
 * Nothing reads these tables yet, which is exactly why the constraints are
 * worth proving now: the first code to write to them will be written against
 * whatever the schema actually permits, not against what the migration meant.
 *
 * **Every test runs inside a transaction that is rolled back.** The tables are
 * already migrated into the test database, so this checks the real schema in
 * `public` rather than rebuilding a copy of it — and leaves nothing behind for
 * the suites that follow.
 */

import { Pool, PoolClient } from 'pg';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../../.env.test') });

describe('Migration: event type templates and the settings chain', () => {
  let pool: Pool;
  let db: PoolClient;

  beforeAll(() => {
    pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      database: process.env.DATABASE_NAME || 'aws_framework_test',
      user: process.env.DATABASE_USER || 'framework_user',
      password: process.env.DATABASE_PASSWORD || 'framework_password',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    db = await pool.connect();
    await db.query('BEGIN');
  });

  afterEach(async () => {
    await db.query('ROLLBACK');
    db.release();
  });

  /** A template, and the id it was given. */
  const template = async (key: string, over: Record<string, unknown> = {}) => {
    const result = await db.query(
      `INSERT INTO event_type_templates (key, display_name, status, capability)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [key, 'Probe', over.status ?? 'draft', over.capability ?? null]
    );
    return result.rows[0].id as string;
  };

  const anOrganisation = async () =>
    (await db.query('SELECT id FROM organizations LIMIT 1')).rows[0]?.id as string;
  const anOrganisationType = async () =>
    (await db.query('SELECT id FROM organization_types LIMIT 1')).rows[0]?.id as string;

  /**
   * An event type of our own.
   *
   * The test database is **schema only** — it has organisations and
   * organisation types from the migrations, and no `event_types` at all. A test
   * that read one from the seed passed against a developer's dev database and
   * failed in CI, which is the wrong way round for a fixture.
   */
  const anEventType = async (name = 'Probe type') => {
    const result = await db.query(
      `INSERT INTO event_types (organisation_id, name, description)
       VALUES ($1, $2, 'Created by a migration test') RETURNING id`,
      [await anOrganisation(), name]
    );
    return result.rows[0].id as string;
  };

  describe('the tables exist in the shape the design assumes', () => {
    it('stores shape and settings separately', async () => {
      // The split is load-bearing: shape is the platform's, settings are the
      // club's. One column holding both would make the distinction a
      // convention rather than a fact.
      const columns = await db.query(
        `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_name = 'event_type_templates'`
      );
      const byName = new Map(columns.rows.map((row: any) => [row.column_name, row]));

      expect(byName.get('shape')).toMatchObject({ data_type: 'jsonb', is_nullable: 'NO' });
      expect(byName.get('default_settings')).toMatchObject({ data_type: 'jsonb', is_nullable: 'NO' });
      expect(byName.get('scheduler_kind')?.column_default).toContain('sequential-phases');
    });

    it('refuses a scheduler nobody has written', async () => {
      await expect(
        db.query(
          `INSERT INTO event_type_templates (key, display_name, scheduler_kind)
           VALUES ('probe.kind', 'Probe', 'wishful-thinking')`
        )
      ).rejects.toThrow(/scheduler_kind_check/);
    });

    it('refuses a status that is neither draft nor published', async () => {
      await expect(
        db.query(
          `INSERT INTO event_type_templates (key, display_name, status)
           VALUES ('probe.status', 'Probe', 'nearly')`
        )
      ).rejects.toThrow(/status_check/);
    });

    it('keeps a template key unique, because code refers to it', async () => {
      await template('probe.unique');
      await expect(template('probe.unique')).rejects.toThrow(/unique|duplicate/i);
    });
  });

  describe('an override belongs to exactly one level', () => {
    it('refuses one naming both an organisation type and an organisation', async () => {
      const id = await template('probe.both');

      await expect(
        db.query(
          `INSERT INTO event_type_setting_overrides
             (template_id, organization_type_id, organisation_id)
           VALUES ($1, $2, $3)`,
          [id, await anOrganisationType(), await anOrganisation()]
        )
      ).rejects.toThrow(/one_scope_check/);
    });

    it('refuses one naming neither', async () => {
      const id = await template('probe.neither');

      await expect(
        db.query(`INSERT INTO event_type_setting_overrides (template_id) VALUES ($1)`, [id])
      ).rejects.toThrow(/one_scope_check/);
    });

    it('allows one per template per level, and only one', async () => {
      const id = await template('probe.dup');
      const organisationId = await anOrganisation();

      await db.query(
        `INSERT INTO event_type_setting_overrides (template_id, organisation_id) VALUES ($1, $2)`,
        [id, organisationId]
      );

      /*
       * The trap this proves is closed: a plain unique constraint across
       * (template_id, organization_type_id, organisation_id) would NOT catch
       * this, because in Postgres a NULL never equals a NULL and both rows
       * would be accepted. Hence the two partial indexes.
       */
      await expect(
        db.query(
          `INSERT INTO event_type_setting_overrides (template_id, organisation_id) VALUES ($1, $2)`,
          [id, organisationId]
        )
      ).rejects.toThrow(/org_unique|duplicate/i);
    });
  });

  describe('locking is a federation’s power, not a club’s', () => {
    it('lets an organisation type lock a setting', async () => {
      const id = await template('probe.lock.type');

      const inserted = await db.query(
        `INSERT INTO event_type_setting_overrides
           (template_id, organization_type_id, locked_keys)
         VALUES ($1, $2, '["minutesPerCompetitor"]') RETURNING id`,
        [id, await anOrganisationType()]
      );

      expect(inserted.rows).toHaveLength(1);
    });

    it('refuses a club locking a setting against itself', async () => {
      // Not a convention — a constraint. A club locking its own setting is
      // not a thing anybody means to do, and it would be invisible afterwards.
      const id = await template('probe.lock.org');

      await expect(
        db.query(
          `INSERT INTO event_type_setting_overrides
             (template_id, organisation_id, locked_keys)
           VALUES ($1, $2, '["minutesPerCompetitor"]')`,
          [id, await anOrganisation()]
        )
      ).rejects.toThrow(/lock_scope_check/);
    });

    it('allows a club an override with nothing locked', async () => {
      const id = await template('probe.lock.none');

      const inserted = await db.query(
        `INSERT INTO event_type_setting_overrides (template_id, organisation_id, settings)
         VALUES ($1, $2, '{"minutesPerCompetitor": 6}') RETURNING locked_keys`,
        [id, await anOrganisation()]
      );

      expect(inserted.rows[0].locked_keys).toEqual([]);
    });
  });

  describe('what happens when a template is retired', () => {
    it('does not take the club’s event type with it', async () => {
      /*
       * The important one. `events.event_type_id` references `event_types`, so
       * cascading here would delete the type an event was run under — and with
       * it, potentially, the event. SET NULL leaves the club's own list intact
       * and simply stops it behaving like a discipline.
       */
      const id = await template('probe.retire');
      const eventTypeId = await anEventType('Retire probe');

      await db.query('UPDATE event_types SET template_id = $1 WHERE id = $2', [id, eventTypeId]);
      await db.query('DELETE FROM event_type_templates WHERE id = $1', [id]);

      const after = await db.query(
        'SELECT id, template_id FROM event_types WHERE id = $1',
        [eventTypeId]
      );
      expect(after.rows).toHaveLength(1);
      expect(after.rows[0].template_id).toBeNull();
    });

    it('does take its own overrides with it', async () => {
      const id = await template('probe.cascade');
      await db.query(
        `INSERT INTO event_type_setting_overrides (template_id, organisation_id) VALUES ($1, $2)`,
        [id, await anOrganisation()]
      );

      await db.query('DELETE FROM event_type_templates WHERE id = $1', [id]);

      const orphans = await db.query(
        'SELECT count(*)::int AS n FROM event_type_setting_overrides WHERE template_id = $1',
        [id]
      );
      expect(orphans.rows[0].n).toBe(0);
    });
  });

  describe('clubs that never buy this see no change', () => {
    it('adds an event type with no template, exactly as before', async () => {
      // The whole compatibility story: `template_id` is nullable, nothing has
      // to supply it, and null is the normal state.
      const eventTypeId = await anEventType('Untouched');

      const row = await db.query('SELECT template_id FROM event_types WHERE id = $1', [
        eventTypeId,
      ]);
      expect(row.rows[0].template_id).toBeNull();
    });

    it('leaves the rows that already exist alone', async () => {
      const rows = await db.query(
        'SELECT count(template_id)::int AS linked FROM event_types WHERE template_id IS NOT NULL'
      );

      expect(rows.rows[0].linked).toBe(0);
    });
  });
});
