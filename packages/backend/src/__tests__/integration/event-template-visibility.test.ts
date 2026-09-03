/**
 * The capability gate, against a real database.
 *
 * Task S0-4's acceptance criterion is that **the list is the gate**: a club is
 * never handed a template it has no capability for, so no screen has to decide
 * what to hide. That gate is a `WHERE` clause, which a mocked pool cannot
 * exercise — so this runs the query the service actually issues, imported from
 * it rather than copied, and the copy cannot drift.
 *
 * Two capabilities are in play and both matter: `event-scheduling` turns the
 * module on, and a template's own capability reveals that discipline within it.
 * A club holding the discipline but not the module must still see nothing.
 *
 * Every test runs in a transaction that is rolled back.
 */

import { Pool, PoolClient } from 'pg';
import { config } from 'dotenv';
import path from 'path';
import {
  TEMPLATES_FOR_ORGANISATION_SQL,
  SCHEDULING_CAPABILITY,
} from '../../services/event-type-template.service';

config({ path: path.resolve(__dirname, '../../../.env.test') });

describe('Integration: which templates an organisation may see', () => {
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

  /** One club, with exactly the capabilities named and no others. */
  const aClubHolding = async (...capabilities: string[]) => (await ownClub(capabilities)).id;

  const aTemplate = async (
    key: string,
    { capability = null as string | null, status = 'published' } = {}
  ) =>
    (
      await db.query(
        `INSERT INTO event_type_templates (key, display_name, capability, status)
         VALUES ($1, $1, $2, $3) RETURNING id`,
        [key, capability, status]
      )
    ).rows[0].id as string;

  const visibleTo = async (organisationId: string): Promise<string[]> =>
    (
      await db.query(TEMPLATES_FOR_ORGANISATION_SQL, [organisationId, SCHEDULING_CAPABILITY])
    ).rows.map((row) => row.key as string);

  it('shows an ungated template to a club with the scheduling module', async () => {
    const club = await aClubHolding(SCHEDULING_CAPABILITY);
    await aTemplate('probe.generic');

    expect(await visibleTo(club)).toContain('probe.generic');
  });

  it('shows nothing at all without the scheduling module', async () => {
    // Even the ungated template: "no gate beyond event-scheduling" is not
    // "no gate".
    const club = await aClubHolding('memberships');
    await aTemplate('probe.generic');

    expect(await visibleTo(club)).toEqual([]);
  });

  it('hides a discipline the club has not been granted', async () => {
    const club = await aClubHolding(SCHEDULING_CAPABILITY);
    await aTemplate('probe.eventing', { capability: 'equestrian-disciplines' });

    expect(await visibleTo(club)).not.toContain('probe.eventing');
  });

  it('reveals that discipline once the club holds its capability', async () => {
    const club = await aClubHolding(SCHEDULING_CAPABILITY, 'equestrian-disciplines');
    await aTemplate('probe.eventing', { capability: 'equestrian-disciplines' });

    expect(await visibleTo(club)).toContain('probe.eventing');
  });

  it('still hides it from a club holding the discipline but not the module', async () => {
    const club = await aClubHolding('equestrian-disciplines');
    await aTemplate('probe.eventing', { capability: 'equestrian-disciplines' });

    expect(await visibleTo(club)).toEqual([]);
  });

  it('never lists a draft, whatever the club holds', async () => {
    const club = await aClubHolding(SCHEDULING_CAPABILITY, 'equestrian-disciplines');
    await aTemplate('probe.unfinished', { status: 'draft' });

    expect(await visibleTo(club)).not.toContain('probe.unfinished');
  });

  it('treats a club with no capabilities recorded as holding none', async () => {
    // `enabled_capabilities` is nullable, and COALESCE is what stops a null
    // making the whole predicate null — which would hide nothing rather than
    // everything, the wrong way round for a gate.
    const club = await aClubHolding();
    await db.query('UPDATE organizations SET enabled_capabilities = NULL WHERE id = $1', [club]);
    await aTemplate('probe.generic');

    expect(await visibleTo(club)).toEqual([]);
  });
});
