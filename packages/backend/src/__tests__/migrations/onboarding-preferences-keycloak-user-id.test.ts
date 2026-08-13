/**
 * The migration that made onboarding preferences storable at all.
 *
 * `user_id` was `uuid REFERENCES organization_users(id)` while every writer
 * passes the Keycloak subject from the JWT. Those identify different things, so
 * every save failed with `23503` and a 500 — and because the read path returns
 * defaults when it finds nothing, the feature looked like it worked while
 * forgetting everything.
 *
 * These tests run the migration's **own SQL** rather than a hand-written copy of
 * the schema. The suite that existed before this bug asserted the presence of
 * the foreign key against DDL it wrote itself, which is why it passed
 * throughout: it never stored a Keycloak id, and never touched the real table.
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';
import { userPreferencesService } from '../../services/user-preferences.service';

const testEnvPath = path.resolve(__dirname, '../../../.env.test');
config({ path: testEnvPath });

/**
 * node-pg-migrate's `pgm`, reduced to the one method this migration uses.
 * Collecting the statements and running them here is what makes this a test of
 * the migration rather than a test of a paraphrase of it.
 */
const runMigration = async (pool: Pool, direction: 'up' | 'down') => {
  const statements: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const migration = require('../../../migrations/1709000000019_onboarding-preferences-keycloak-user-id.js');

  migration[direction]({ sql: (statement: string) => statements.push(statement) });

  for (const statement of statements) {
    await pool.query(statement);
  }
};

/** The table exactly as migration 023 left it, foreign key and all. */
/**
 * The table as migrations 023 + 019 leave it: a Keycloak subject in `user_id`,
 * no foreign key, unique per user.
 *
 * The suite has to be able to put this back. It replaces the real table with
 * the pre-migration shape to prove the migration works, and the tests share one
 * database — leaving `public` without the table would break every suite that
 * runs afterwards.
 */
const createMigratedShape = async (pool: Pool) => {
  await pool.query('DROP TABLE IF EXISTS user_onboarding_preferences CASCADE;');
  await pool.query(`
    CREATE TABLE user_onboarding_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL UNIQUE,
      welcome_dismissed BOOLEAN NOT NULL DEFAULT false,
      modules_visited JSONB NOT NULL DEFAULT '[]',
      last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS user_onboarding_preferences_user_id_index ON user_onboarding_preferences (user_id)'
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS user_onboarding_preferences_last_updated_index ON user_onboarding_preferences (last_updated)'
  );
};

const createOldShape = async (pool: Pool) => {
  await pool.query('DROP TABLE IF EXISTS user_onboarding_preferences CASCADE;');
  await pool.query(`
    CREATE TABLE user_onboarding_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES organization_users(id) ON DELETE CASCADE,
      welcome_dismissed BOOLEAN NOT NULL DEFAULT false,
      modules_visited JSONB NOT NULL DEFAULT '[]',
      last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

describe('Onboarding preferences keyed by Keycloak user id', () => {
  let pool: Pool;
  let organisationId: string;
  let organisationTypeId: string;
  const created = { orgUserIds: [] as string[], organisationIds: [] as string[] };

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'aws_framework_test',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
    });

    // An organisation needs a type; the fixture owns its own so the suite does
    // not depend on whatever else is in the test database.
    const organisationType = await pool.query(
      `INSERT INTO organization_types (name, display_name)
       VALUES ($1, 'Onboarding FK test type')
       RETURNING id`,
      [`onboarding-fk-test-${randomUUID()}`]
    );
    organisationTypeId = organisationType.rows[0].id;

    organisationId = await addOrganisation();
  });

  /** A throwaway organisation of the fixture's own type. */
  async function addOrganisation(): Promise<string> {
    const suffix = randomUUID().slice(0, 8);
    const result = await pool.query(
      `INSERT INTO organizations
         (name, display_name, organization_type_id, keycloak_group_id, currency, url_code, status)
       VALUES ($1, $1, $2, $3, 'EUR', $4, 'active')
       RETURNING id`,
      [`Onboarding FK test ${suffix}`, organisationTypeId, randomUUID(), `onbfk${suffix}`]
    );
    created.organisationIds.push(result.rows[0].id);
    return result.rows[0].id as string;
  }

  afterAll(async () => {
    // Put the table back as the migrations leave it, rather than dropping it
    // and leaving the rest of the run without it.
    await createMigratedShape(pool);
    if (created.orgUserIds.length > 0) {
      await pool.query('DELETE FROM organization_users WHERE id = ANY($1::uuid[])', [
        created.orgUserIds,
      ]);
    }
    await pool.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [
      created.organisationIds,
    ]);
    await pool.query('DELETE FROM organization_types WHERE id = $1', [organisationTypeId]);
    await pool.end();
  });

  /**
   * An org-admin membership row for a given Keycloak user.
   *
   * `organization_users` is unique on (organisation, Keycloak user), so a person
   * with two membership rows has them in two *different* organisations — which
   * is exactly the case the merge has to survive.
   */
  const addOrgUser = async (keycloakUserId: string, inOrganisation = organisationId) => {
    const result = await pool.query(
      `INSERT INTO organization_users (organization_id, keycloak_user_id, user_type, email, status)
       VALUES ($1, $2, 'org-admin', $3, 'active')
       RETURNING id`,
      [inOrganisation, keycloakUserId, `${keycloakUserId}@example.com`]
    );
    created.orgUserIds.push(result.rows[0].id);
    return result.rows[0].id as string;
  };

  beforeEach(async () => {
    await createOldShape(pool);
  });

  describe('the schema afterwards', () => {
    beforeEach(async () => {
      await runMigration(pool, 'up');
    });

    it('holds the user id as text, not a uuid foreign key', async () => {
      const column = await pool.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'user_onboarding_preferences' AND column_name = 'user_id';
      `);

      expect(column.rows[0].data_type).toBe('character varying');
    });

    it('no longer constrains the user id to organization_users', async () => {
      const constraints = await pool.query(`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'user_onboarding_preferences';
      `);

      expect(constraints.rows).toHaveLength(0);
    });

    it('still allows only one preference row per person', async () => {
      const keycloakUserId = randomUUID();
      await pool.query(
        `INSERT INTO user_onboarding_preferences (user_id, welcome_dismissed)
         VALUES ($1, true)`,
        [keycloakUserId]
      );

      await expect(
        pool.query(
          `INSERT INTO user_onboarding_preferences (user_id, welcome_dismissed)
           VALUES ($1, false)`,
          [keycloakUserId]
        )
      ).rejects.toMatchObject({ code: '23505' });
    });

    /** The write that produced the 500 the whole time. */
    it('stores a dismissal for a Keycloak user with no organization_users row', async () => {
      const keycloakUserId = randomUUID();

      await pool.query(
        `INSERT INTO user_onboarding_preferences (user_id, welcome_dismissed, modules_visited)
         VALUES ($1, true, $2)`,
        [keycloakUserId, JSON.stringify(['settings', 'ticketing'])]
      );

      const stored = await pool.query(
        'SELECT welcome_dismissed, modules_visited FROM user_onboarding_preferences WHERE user_id = $1',
        [keycloakUserId]
      );

      expect(stored.rows[0].welcome_dismissed).toBe(true);
      expect(stored.rows[0].modules_visited).toEqual(['settings', 'ticketing']);
    });
  });

  describe('preferences that were already stored', () => {
    it('are re-keyed to the person who owns them', async () => {
      const keycloakUserId = randomUUID();
      const orgUserId = await addOrgUser(keycloakUserId);
      await pool.query(
        `INSERT INTO user_onboarding_preferences (user_id, welcome_dismissed, modules_visited)
         VALUES ($1, true, $2)`,
        [orgUserId, JSON.stringify(['events'])]
      );

      await runMigration(pool, 'up');

      const rows = await pool.query(
        'SELECT user_id, welcome_dismissed, modules_visited FROM user_onboarding_preferences'
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].user_id).toBe(keycloakUserId);
      expect(rows.rows[0].welcome_dismissed).toBe(true);
      expect(rows.rows[0].modules_visited).toEqual(['events']);
    });

    /**
     * One person, two organisations, two rows — and one unique constraint. The
     * union is the answer that respects every click they made.
     */
    it('are merged, not dropped, when one person had several membership rows', async () => {
      const keycloakUserId = randomUUID();
      const firstOrgUserId = await addOrgUser(keycloakUserId);
      const secondOrgUserId = await addOrgUser(keycloakUserId, await addOrganisation());

      await pool.query(
        `INSERT INTO user_onboarding_preferences (user_id, welcome_dismissed, modules_visited, created_at)
         VALUES ($1, false, $2, CURRENT_TIMESTAMP - INTERVAL '1 day')`,
        [firstOrgUserId, JSON.stringify(['events'])]
      );
      await pool.query(
        `INSERT INTO user_onboarding_preferences (user_id, welcome_dismissed, modules_visited)
         VALUES ($1, true, $2)`,
        [secondOrgUserId, JSON.stringify(['settings', 'events'])]
      );

      await runMigration(pool, 'up');

      const rows = await pool.query(
        'SELECT user_id, welcome_dismissed, modules_visited FROM user_onboarding_preferences'
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].user_id).toBe(keycloakUserId);
      // Dismissals are additive: ticked anywhere means ticked.
      expect(rows.rows[0].welcome_dismissed).toBe(true);
      expect([...rows.rows[0].modules_visited].sort()).toEqual(['events', 'settings']);
    });
  });

  /**
   * The end-to-end version of the reported bug: the service, the real table, a
   * Keycloak id. This is the path that returned 500 on every "Don't show this
   * again" click.
   */
  describe('through the service', () => {
    beforeEach(async () => {
      await runMigration(pool, 'up');
      userPreferencesService.setPool(pool);
    });

    it('saves and reloads a module dismissal', async () => {
      const keycloakUserId = randomUUID();

      await userPreferencesService.updateOnboardingPreferences(keycloakUserId, {
        modulesVisited: ['settings'],
      });

      expect(await userPreferencesService.getOnboardingPreferences(keycloakUserId)).toEqual({
        welcomeDismissed: false,
        modulesVisited: ['settings'],
      });
    });

    it('adds later dismissals to the earlier ones', async () => {
      const keycloakUserId = randomUUID();

      await userPreferencesService.updateOnboardingPreferences(keycloakUserId, {
        modulesVisited: ['settings'],
      });
      await userPreferencesService.updateOnboardingPreferences(keycloakUserId, {
        modulesVisited: ['settings', 'ticketing'],
      });
      await userPreferencesService.updateOnboardingPreferences(keycloakUserId, {
        welcomeDismissed: true,
      });

      const preferences = await userPreferencesService.getOnboardingPreferences(keycloakUserId);
      expect(preferences.welcomeDismissed).toBe(true);
      expect([...preferences.modulesVisited].sort()).toEqual(['settings', 'ticketing']);
    });

    it('reports defaults for someone who has dismissed nothing', async () => {
      expect(await userPreferencesService.getOnboardingPreferences(randomUUID())).toEqual({
        welcomeDismissed: false,
        modulesVisited: [],
      });
    });
  });

  describe('rolling back', () => {
    it('restores the uuid column and its foreign key', async () => {
      const keycloakUserId = randomUUID();
      const orgUserId = await addOrgUser(keycloakUserId);
      await pool.query(
        `INSERT INTO user_onboarding_preferences (user_id, welcome_dismissed)
         VALUES ($1, true)`,
        [orgUserId]
      );

      await runMigration(pool, 'up');
      await runMigration(pool, 'down');

      const column = await pool.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'user_onboarding_preferences' AND column_name = 'user_id';
      `);
      expect(column.rows[0].data_type).toBe('uuid');

      const constraints = await pool.query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY' AND table_name = 'user_onboarding_preferences';
      `);
      expect(constraints.rows).toHaveLength(1);

      const rows = await pool.query('SELECT user_id FROM user_onboarding_preferences');
      expect(rows.rows[0].user_id).toBe(orgUserId);
    });

    /** Rolling back cannot represent a person with no membership row. */
    it('drops preferences it cannot express, rather than failing', async () => {
      await runMigration(pool, 'up');
      await pool.query(
        `INSERT INTO user_onboarding_preferences (user_id, welcome_dismissed)
         VALUES ($1, true)`,
        [randomUUID()]
      );

      await runMigration(pool, 'down');

      const rows = await pool.query('SELECT user_id FROM user_onboarding_preferences');
      expect(rows.rows).toHaveLength(0);
    });
  });
});
