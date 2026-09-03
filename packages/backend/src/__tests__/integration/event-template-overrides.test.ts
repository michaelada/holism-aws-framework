/**
 * The two upserts, against a real schema (task S0-4).
 *
 * `ON CONFLICT (a, b) WHERE ...` has to name a partial unique index whose
 * predicate matches, and mismatching one fails at run time with "no unique or
 * exclusion constraint matching the ON CONFLICT specification" — never at
 * compile time, and never in a unit test that mocks the pool. So these run the
 * statements the service issues, imported from it rather than copied.
 *
 * The constraints the migration added are worth the same treatment: they are
 * the only thing keeping a club from locking a setting against itself.
 *
 * Every test runs in a transaction that is rolled back.
 */

import { Pool, PoolClient } from 'pg';
import { config } from 'dotenv';
import path from 'path';
import {
  UPSERT_TYPE_OVERRIDE_SQL,
  UPSERT_ORG_OVERRIDE_SQL,
} from '../../services/event-type-template.service';

config({ path: path.resolve(__dirname, '../../../.env.test') });

describe('Integration: writing setting overrides', () => {
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

  /**
   * A club of its own, created inside the transaction.
   *
   * **Not one of the seeded clubs.** These tests change a club's capabilities,
   * and Jest runs suites in parallel against one database — so mutating a
   * shared row holds a lock on it for the length of the test and any other
   * suite touching the same club waits, or fails. Own fixtures cost two inserts
   * and remove the contention entirely.
   */
  const ownClub = async (capabilities: string[] = []) => {
    const suffix = Math.random().toString(36).slice(2, 10);
    const type = await db.query(
      `INSERT INTO organization_types
         (name, display_name, currency, language, default_locale,
          membership_numbering, membership_number_uniqueness, initial_membership_number)
       VALUES ($1, $1, 'GBP', 'en', 'en-GB', 'internal', 'organization', 1)
       RETURNING id`,
      [`probe-type-${suffix}`]
    );
    const org = await db.query(
      `INSERT INTO organizations
         (organization_type_id, keycloak_group_id, name, display_name, currency,
          url_code, enabled_capabilities)
       VALUES ($1, $2, $2, $2, 'GBP', $2, $3::jsonb)
       RETURNING id, organization_type_id`,
      [type.rows[0].id, `probe-${suffix}`, JSON.stringify(capabilities)]
    );
    return org.rows[0] as { id: string; organization_type_id: string };
  };

  const aClub = async () => ownClub();

  const aTemplate = async () =>
    (
      await db.query(
        `INSERT INTO event_type_templates (key, display_name, status)
         VALUES ('probe.overrides', 'Probe', 'published') RETURNING id`
      )
    ).rows[0].id as string;

  /**
   * Assert one statement is refused, inside a savepoint.
   *
   * A constraint violation aborts the whole transaction, so a second violation
   * asserted after the first reports "current transaction is aborted" instead
   * of the constraint it broke — and would pass a looser matcher while proving
   * nothing.
   */
  const expectRefused = async (sql: string, params: unknown[], constraint: RegExp) => {
    await db.query('SAVEPOINT probe');
    await expect(db.query(sql, params)).rejects.toThrow(constraint);
    await db.query('ROLLBACK TO SAVEPOINT probe');
  };

  const rowsFor = async (templateId: string) =>
    (
      await db.query(
        `SELECT organization_type_id, organisation_id, settings, locked_keys
           FROM event_type_setting_overrides WHERE template_id = $1`,
        [templateId]
      )
    ).rows;

  describe('an organisation type’s rules', () => {
    it('inserts, then updates the same row rather than adding a second', async () => {
      const club = await aClub();
      const templateId = await aTemplate();

      await db.query(UPSERT_TYPE_OVERRIDE_SQL, [
        templateId,
        club.organization_type_id,
        JSON.stringify({ competitorGapMinutes: 30 }),
        JSON.stringify([]),
      ]);
      await db.query(UPSERT_TYPE_OVERRIDE_SQL, [
        templateId,
        club.organization_type_id,
        JSON.stringify({ competitorGapMinutes: 25 }),
        JSON.stringify(['competitorGapMinutes']),
      ]);

      const rows = await rowsFor(templateId);
      expect(rows).toHaveLength(1);
      expect(rows[0].settings).toEqual({ competitorGapMinutes: 25 });
      expect(rows[0].locked_keys).toEqual(['competitorGapMinutes']);
    });
  });

  describe('a club’s own rules', () => {
    it('inserts, then updates the same row', async () => {
      const club = await aClub();
      const templateId = await aTemplate();

      await db.query(UPSERT_ORG_OVERRIDE_SQL, [
        templateId,
        club.id,
        JSON.stringify({ arenaCount: 2 }),
      ]);
      await db.query(UPSERT_ORG_OVERRIDE_SQL, [
        templateId,
        club.id,
        JSON.stringify({ arenaCount: 3 }),
      ]);

      const rows = await rowsFor(templateId);
      expect(rows).toHaveLength(1);
      expect(rows[0].settings).toEqual({ arenaCount: 3 });
    });

    it('sits alongside its type’s row without colliding with it', async () => {
      // The two partial indexes are separate, and a club overriding a setting
      // its federation also sets is the ordinary case, not a conflict.
      const club = await aClub();
      const templateId = await aTemplate();

      await db.query(UPSERT_TYPE_OVERRIDE_SQL, [
        templateId,
        club.organization_type_id,
        JSON.stringify({ arenaCount: 1 }),
        JSON.stringify([]),
      ]);
      await db.query(UPSERT_ORG_OVERRIDE_SQL, [
        templateId,
        club.id,
        JSON.stringify({ arenaCount: 3 }),
      ]);

      expect(await rowsFor(templateId)).toHaveLength(2);
    });
  });

  describe('what the schema refuses', () => {
    it('will not let a club lock a setting against itself', async () => {
      // Locking is a federation's power. A row scoped to one organisation with
      // locked keys would be a club locking itself out of its own setting.
      const club = await aClub();
      const templateId = await aTemplate();

      await expectRefused(
        `INSERT INTO event_type_setting_overrides (template_id, organisation_id, locked_keys)
         VALUES ($1, $2, '["arenaCount"]')`,
        [templateId, club.id],
        /lock_scope_check/
      );
    });

    it('will not let a row belong to both levels, or to neither', async () => {
      const club = await aClub();
      const templateId = await aTemplate();

      await expectRefused(
        `INSERT INTO event_type_setting_overrides
           (template_id, organization_type_id, organisation_id)
         VALUES ($1, $2, $3)`,
        [templateId, club.organization_type_id, club.id],
        /one_scope_check/
      );

      await expectRefused(
        `INSERT INTO event_type_setting_overrides (template_id) VALUES ($1)`,
        [templateId],
        /one_scope_check/
      );
    });
  });
});
