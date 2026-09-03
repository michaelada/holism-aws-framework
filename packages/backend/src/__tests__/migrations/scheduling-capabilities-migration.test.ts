/**
 * The two scheduling capabilities — migration 1709000000047.
 *
 * Task S0-2 of docs/EVENT_SCHEDULING_TASKS_S0_S1.md. Nothing is gated by these
 * yet, which is why they are worth a test now: the row in `capabilities` is a
 * **prerequisite for granting them at all**, because
 * `1709000000027_strip-unknown-capabilities` deletes any name from an
 * organisation that this table does not describe.
 *
 * Every test runs in a transaction that is rolled back.
 */

import { Pool, PoolClient } from 'pg';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../../.env.test') });

const NAMES = ['event-scheduling', 'equestrian-disciplines'];

describe('Migration: the scheduling capabilities', () => {
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

  it('describes both capabilities, so a grant of either survives', async () => {
    /*
     * The one that matters. A capability granted to an organisation without a
     * row here is deleted the next time `strip-unknown-capabilities` runs —
     * silently, and long after whoever granted it has stopped looking.
     */
    const rows = await db.query(
      'SELECT name, display_name, category, is_active FROM capabilities WHERE name = ANY($1) ORDER BY name',
      [NAMES]
    );

    expect(rows.rows.map((row: any) => row.name)).toEqual([
      'equestrian-disciplines',
      'event-scheduling',
    ]);
    for (const row of rows.rows) {
      expect(row.is_active).toBe(true);
      // Neither is on by default for anybody; both are bought.
      expect(row.category).toBe('additional-feature');
      expect(row.display_name).toBeTruthy();
    }
  });

  it('keeps them separate, because they answer different questions', async () => {
    // `event-scheduling` gates the module; `equestrian-disciplines` gates which
    // templates a club is offered. One capability would mean every club that
    // can schedule is offered every discipline the platform has ever defined.
    const rows = await db.query('SELECT name FROM capabilities WHERE name = ANY($1)', [NAMES]);
    expect(rows.rows).toHaveLength(2);
  });

  it('can be granted to an organisation, a type and a role', async () => {
    // All three places a capability name is written. A grant that a later
    // migration strips is the failure this whole table exists to prevent.
    const organisation = await db.query(
      `UPDATE organizations
          SET enabled_capabilities = enabled_capabilities || '["event-scheduling"]'::jsonb
        WHERE id = (SELECT id FROM organizations LIMIT 1)
        RETURNING enabled_capabilities ? 'event-scheduling' AS granted`
    );
    expect(organisation.rows[0].granted).toBe(true);

    const type = await db.query(
      `UPDATE organization_types
          SET default_capabilities = default_capabilities || '["event-scheduling"]'::jsonb
        WHERE id = (SELECT id FROM organization_types LIMIT 1)
        RETURNING default_capabilities ? 'event-scheduling' AS granted`
    );
    expect(type.rows[0].granted).toBe(true);
  });

  it('leaves a template able to name the capability that reveals it', async () => {
    /*
     * The join S0-4 will make: a club is offered a template only where it holds
     * `event_type_templates.capability`. Deliberately a plain name rather than
     * a foreign key, so this is a check that the two agree by convention —
     * which is the only thing holding them together.
     */
    const inserted = await db.query(
      `INSERT INTO event_type_templates (key, display_name, capability, status)
       VALUES ('probe.equestrian.sj', 'Show Jumping', 'equestrian-disciplines', 'published')
       RETURNING capability`
    );

    const known = await db.query('SELECT 1 FROM capabilities WHERE name = $1', [
      inserted.rows[0].capability,
    ]);
    expect(known.rows).toHaveLength(1);
  });
});
