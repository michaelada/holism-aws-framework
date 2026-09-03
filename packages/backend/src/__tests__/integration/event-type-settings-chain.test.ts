/**
 * The settings chain, against a real database.
 *
 * `event-type-template.service.test.ts` mocks the pool and proves the **merge**
 * — last wins, locks beat the club, sources are exact. It cannot prove the
 * **query**, and the query is where the isolation lives: the two overrides are
 * found by joining through the organisation's own type, so a mistake there
 * would hand one club another type's rules.
 *
 * That is a cross-organisation data fault, which this codebase treats as a
 * class of bug rather than a slip (docs/CROSS_ORGANISATION_ACCESS_FIX.md), so
 * it is worth a test that runs the SQL rather than a mock of it.
 *
 * Every test runs in a transaction that is rolled back.
 */

import { Pool, PoolClient } from 'pg';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../../.env.test') });

describe('Integration: resolving settings through the organisation’s own type', () => {
  let pool: Pool;
  let db: PoolClient;

  /** The query `resolveSettings` runs, verbatim. */
  const CHAIN_SQL = `
    SELECT t.default_settings,
           typ.settings     AS type_settings,
           typ.locked_keys  AS type_locked,
           org.settings     AS org_settings
      FROM event_type_templates t
      JOIN organizations o ON o.id = $2
      LEFT JOIN event_type_setting_overrides typ
             ON typ.template_id = t.id
            AND typ.organization_type_id = o.organization_type_id
      LEFT JOIN event_type_setting_overrides org
             ON org.template_id = t.id
            AND org.organisation_id = o.id
     WHERE t.id = $1`;

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

  /** Two organisations that belong to different organisation types. */
  const twoClubsOfDifferentTypes = async () => {
    const rows = await db.query(
      `SELECT id, organization_type_id FROM organizations
        WHERE organization_type_id IS NOT NULL ORDER BY id LIMIT 2`
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].organization_type_id).not.toBe(rows.rows[1].organization_type_id);
    return { ours: rows.rows[0], theirs: rows.rows[1] };
  };

  const aTemplate = async (defaults: Record<string, unknown> = {}) =>
    (
      await db.query(
        `INSERT INTO event_type_templates (key, display_name, status, default_settings)
         VALUES ('probe.chain', 'Probe', 'published', $1) RETURNING id`,
        [JSON.stringify(defaults)]
      )
    ).rows[0].id as string;

  const resolve = async (templateId: string, organisationId: string) =>
    (await db.query(CHAIN_SQL, [templateId, organisationId])).rows[0];

  it('gives a club the override on its own organisation type', async () => {
    const { ours } = await twoClubsOfDifferentTypes();
    const templateId = await aTemplate({ competitorGapMinutes: 20 });

    await db.query(
      `INSERT INTO event_type_setting_overrides (template_id, organization_type_id, settings)
       VALUES ($1, $2, '{"competitorGapMinutes": 30}')`,
      [templateId, ours.organization_type_id]
    );

    expect((await resolve(templateId, ours.id)).type_settings).toEqual({
      competitorGapMinutes: 30,
    });
  });

  it('does not give it to a club of another type', async () => {
    // The isolation the join exists for. A federation's rules must not reach
    // somebody else's clubs.
    const { ours, theirs } = await twoClubsOfDifferentTypes();
    const templateId = await aTemplate({ competitorGapMinutes: 20 });

    await db.query(
      `INSERT INTO event_type_setting_overrides (template_id, organization_type_id, settings)
       VALUES ($1, $2, '{"competitorGapMinutes": 30}')`,
      [templateId, ours.organization_type_id]
    );

    expect((await resolve(templateId, theirs.id)).type_settings).toBeNull();
  });

  it('does not give one club another club’s override', async () => {
    const { ours, theirs } = await twoClubsOfDifferentTypes();
    const templateId = await aTemplate();

    await db.query(
      `INSERT INTO event_type_setting_overrides (template_id, organisation_id, settings)
       VALUES ($1, $2, '{"competitorGapMinutes": 5}')`,
      [templateId, ours.id]
    );

    expect((await resolve(templateId, ours.id)).org_settings).toEqual({ competitorGapMinutes: 5 });
    expect((await resolve(templateId, theirs.id)).org_settings).toBeNull();
  });

  it('reads both levels at once, and the lock with them', async () => {
    const { ours } = await twoClubsOfDifferentTypes();
    const templateId = await aTemplate({ a: 1 });

    await db.query(
      `INSERT INTO event_type_setting_overrides
         (template_id, organization_type_id, settings, locked_keys)
       VALUES ($1, $2, '{"b": 2}', '["b"]')`,
      [templateId, ours.organization_type_id]
    );
    await db.query(
      `INSERT INTO event_type_setting_overrides (template_id, organisation_id, settings)
       VALUES ($1, $2, '{"c": 3}')`,
      [templateId, ours.id]
    );

    const row = await resolve(templateId, ours.id);

    expect(row.default_settings).toEqual({ a: 1 });
    expect(row.type_settings).toEqual({ b: 2 });
    expect(row.type_locked).toEqual(['b']);
    expect(row.org_settings).toEqual({ c: 3 });
  });

  it('returns nothing for an organisation that does not exist', async () => {
    // The `JOIN organizations` is what makes this so, and it is why the service
    // answers NotFoundError rather than resolving a template against nobody.
    const templateId = await aTemplate({ a: 1 });

    const rows = await db.query(CHAIN_SQL, [
      templateId,
      '00000000-0000-4000-8000-000000000000',
    ]);
    expect(rows.rows).toHaveLength(0);
  });
});
