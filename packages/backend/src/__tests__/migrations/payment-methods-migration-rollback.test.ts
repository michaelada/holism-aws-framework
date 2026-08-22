/**
 * Migration Rollback Tests for Payment Methods Configuration
 *
 * Tests that the down migration properly cleans up:
 * - payment_methods table
 * - org_payment_method_data table
 * - seed data
 * - indexes and constraints
 *
 * Requirements: 1.1, 2.1, 7.1
 *
 * ## Why this suite works in a schema of its own
 *
 * It proves a down migration behaves by building the tables in their
 * post-migration shape and then dropping them. Done in `public`, that deletes
 * the tables every other suite in the run depends on — the backend tests share
 * one database and jest runs them in a single worker, so whatever came next
 * found the schema gone. That is why the whole suite was `describe.skip`.
 *
 * Everything here therefore happens in `migration_test`: the pool's
 * `search_path` points at it, every catalogue query is scoped to it, and it is
 * dropped when the suite finishes. `public` is never touched, so the fixtures
 * can be created and destroyed as freely as the tests need.
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load test environment
const testEnvPath = path.resolve(__dirname, '../../../.env.test');
config({ path: testEnvPath });

/** Schema these migration fixtures live in, so `public` is never disturbed. */
const SCHEMA = 'migration_test';

const connection = () => ({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'aws_framework_test',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

/** The tables as the migration leaves them, indexes and constraints included. */
const CREATE_PAYMENT_METHODS = `
  CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    requires_activation BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_payment_methods_is_active ON payment_methods(is_active);
  CREATE INDEX idx_payment_methods_name ON payment_methods(name);
`;

const CREATE_ORG_PAYMENT_METHOD_DATA = `
  CREATE TABLE org_payment_method_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'inactive',
    payment_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, payment_method_id)
  );
  CREATE INDEX idx_org_payment_method_data_organization_id ON org_payment_method_data(organization_id);
  CREATE INDEX idx_org_payment_method_data_status ON org_payment_method_data(status);
`;

const SEED_PAYMENT_METHODS = `
  INSERT INTO payment_methods (name, display_name, description, requires_activation, is_active)
  VALUES
    ('pay-offline', 'Pay Offline', 'Payment instructions will be provided in the confirmation email.', false, true),
    ('stripe', 'Pay By Card (Stripe)', 'Accept card payments through Stripe.', true, true),
    ('helix-pay', 'Pay By Card (Helix-Pay)', 'Accept card payments through Helix-Pay.', true, true);
`;

describe('Payment Methods Migration Rollback Tests', () => {
  let pool: Pool;

  /** Both tables, as the migration leaves them, in the scratch schema. */
  const createTables = async () => {
    await dropTables();
    await pool.query(CREATE_PAYMENT_METHODS);
    await pool.query(CREATE_ORG_PAYMENT_METHOD_DATA);
  };

  /** The down migration: child before parent, which is the order under test. */
  const dropTables = async () => {
    await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');
    await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');
  };

  const tablesNamed = async (...names: string[]) => {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = ANY($2)`,
      [SCHEMA, names]
    );
    return result.rows.map((row) => row.table_name);
  };

  const indexesOn = async (...tables: string[]) => {
    const result = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = ANY($2)`,
      [SCHEMA, tables]
    );
    return result.rows.map((row) => row.indexname);
  };

  const constraintsOn = async (table: string, type?: string) => {
    const result = await pool.query(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_schema = $1 AND table_name = $2
         AND ($3::text IS NULL OR constraint_type = $3)`,
      [SCHEMA, table, type ?? null]
    );
    return result.rows.map((row) => row.constraint_name);
  };

  beforeAll(async () => {
    // The schema has to exist before anything resolves against it, and creating
    // it is independent of the search_path the working pool uses.
    const bootstrap = new Pool(connection());
    await bootstrap.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await bootstrap.query(`CREATE SCHEMA ${SCHEMA}`);
    await bootstrap.end();

    pool = new Pool({ ...connection(), options: `-c search_path=${SCHEMA}` });
  });

  afterAll(async () => {
    /*
     * Dropped through the pool that is already open, rather than a fresh one.
     * Jest force-exits at the end of the run, and a connection opened during
     * teardown can be cut off before its query lands — which left the schema
     * behind. A session can drop the schema its own `search_path` names.
     */
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.end();
  });

  describe('Down Migration - Table Cleanup', () => {
    beforeEach(createTables);

    it('should drop org_payment_method_data table', async () => {
      expect(await tablesNamed('org_payment_method_data')).toEqual(['org_payment_method_data']);

      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');

      expect(await tablesNamed('org_payment_method_data')).toEqual([]);
    });

    it('should drop payment_methods table', async () => {
      expect(await tablesNamed('payment_methods')).toEqual(['payment_methods']);

      // CASCADE, because the child table still references it.
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      expect(await tablesNamed('payment_methods')).toEqual([]);
    });

    it('should drop tables in correct order (child before parent)', async () => {
      // The child holds the foreign key, so dropping it first must not need
      // CASCADE to succeed — which is what makes the migration's order safe.
      await expect(pool.query('DROP TABLE org_payment_method_data;')).resolves.toBeDefined();
      await expect(pool.query('DROP TABLE payment_methods;')).resolves.toBeDefined();

      expect(await tablesNamed('payment_methods', 'org_payment_method_data')).toEqual([]);
    });
  });

  describe('Down Migration - Seed Data Removal', () => {
    beforeEach(async () => {
      await createTables();
      await pool.query(SEED_PAYMENT_METHODS);
    });

    it.each(['pay-offline', 'stripe', 'helix-pay'])(
      'should remove %s seed data when table is dropped',
      async (name) => {
        const before = await pool.query('SELECT * FROM payment_methods WHERE name = $1', [name]);
        expect(before.rows).toHaveLength(1);

        await dropTables();

        expect(await tablesNamed('payment_methods')).toEqual([]);
      }
    );

    it('should remove all three seeded payment methods', async () => {
      const before = await pool.query('SELECT name FROM payment_methods ORDER BY name');
      expect(before.rows.map((row) => row.name)).toEqual(['helix-pay', 'pay-offline', 'stripe']);

      await dropTables();

      expect(await tablesNamed('payment_methods')).toEqual([]);
    });
  });

  describe('Down Migration - Indexes and Constraints Cleanup', () => {
    beforeEach(createTables);

    it('should remove payment_methods indexes when table is dropped', async () => {
      expect(await indexesOn('payment_methods')).toEqual(
        expect.arrayContaining(['idx_payment_methods_is_active', 'idx_payment_methods_name'])
      );

      await dropTables();

      expect(await indexesOn('payment_methods')).toEqual([]);
    });

    it('should remove org_payment_method_data indexes when table is dropped', async () => {
      expect(await indexesOn('org_payment_method_data')).toEqual(
        expect.arrayContaining([
          'idx_org_payment_method_data_organization_id',
          'idx_org_payment_method_data_status',
        ])
      );

      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');

      expect(await indexesOn('org_payment_method_data')).toEqual([]);
    });

    it('should remove unique constraint on org_payment_method_data', async () => {
      expect((await constraintsOn('org_payment_method_data', 'UNIQUE')).length).toBeGreaterThanOrEqual(1);

      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');

      expect(await constraintsOn('org_payment_method_data')).toEqual([]);
    });

    it('should remove foreign key constraint from org_payment_method_data', async () => {
      expect(
        (await constraintsOn('org_payment_method_data', 'FOREIGN KEY')).length
      ).toBeGreaterThanOrEqual(1);

      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');

      expect(await constraintsOn('org_payment_method_data')).toEqual([]);
    });
  });

  describe('Down Migration - Complete Rollback', () => {
    it('should completely rollback the migration leaving no traces', async () => {
      await createTables();
      await pool.query(SEED_PAYMENT_METHODS);

      await dropTables();

      expect(await tablesNamed('payment_methods', 'org_payment_method_data')).toEqual([]);
      expect(await indexesOn('payment_methods', 'org_payment_method_data')).toEqual([]);
      expect(await constraintsOn('payment_methods')).toEqual([]);
      expect(await constraintsOn('org_payment_method_data')).toEqual([]);
    });
  });
});
