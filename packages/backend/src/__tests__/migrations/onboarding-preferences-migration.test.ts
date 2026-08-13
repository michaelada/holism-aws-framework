/**
 * Migration Tests for Onboarding Preferences
 *
 * Tests that the migration properly creates:
 * - user_onboarding_preferences table
 * - Required columns with correct types
 * - Indexes for efficient lookups
 * - Foreign key constraints
 *
 * **This describes migration 023 as it was written, not the table as it is
 * today.** The `user_id` foreign key to `organization_users` asserted below was
 * a mistake — every writer passes the Keycloak subject, not an
 * `organization_users.id` — and it is removed by
 * `1709000000019_onboarding-preferences-keycloak-user-id.js`. For the current
 * shape, and for tests that run the real migration SQL rather than a copy of
 * the DDL, see `onboarding-preferences-keycloak-user-id.test.ts` and
 * `docs/ONBOARDING_DISMISSAL_IGNORED.md`.
 *
 * Requirements: 4.1, 9.5
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load test environment
const testEnvPath = path.resolve(__dirname, '../../../.env.test');
config({ path: testEnvPath });

/** Schema these migration fixtures live in, so `public` is never disturbed. */
const MIGRATION_TEST_SCHEMA = 'migration_test';

describe('Onboarding Preferences Migration Tests', () => {
  let pool: Pool;

  beforeAll(async () => {
    // Create a connection pool for testing
    /*
     * A scratch schema, not `public`.
     *
     * This suite proves a migration behaves by dropping the table and building
     * it in its pre-migration shape. Done in `public`, that deletes the table
     * every other suite in the run depends on — the tests share one database,
     * and jest runs them in a single worker, so whatever comes afterwards finds
     * the schema gone. Confining the pool's search_path here keeps both the
     * creates and the drops inside a schema nobody else reads.
     */
    pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'aws_framework_test',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      options: `-c search_path=${MIGRATION_TEST_SCHEMA}`,
    });

    // The schema itself has to exist before anything resolves against it, and
    // creating it is independent of the search_path.
    const bootstrap = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'aws_framework_test',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
    });
    await bootstrap.query(`CREATE SCHEMA IF NOT EXISTS ${MIGRATION_TEST_SCHEMA}`);
    await bootstrap.end();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Migration Structure Validation', () => {
    it('should have valid migration file structure', () => {
      // This test validates that the migration file exists and has the correct structure
      const migration = require('../../../migrations/1707000000023_create-onboarding-preferences-table.js');
      
      expect(migration).toBeDefined();
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });
  });

  describe('Table Creation', () => {
    beforeEach(async () => {
      // Clean up before each test
      await pool.query('DROP TABLE IF EXISTS user_onboarding_preferences CASCADE;');
    });

    afterEach(async () => {
      // Clean up after each test
      await pool.query('DROP TABLE IF EXISTS user_onboarding_preferences CASCADE;');
    });

    it('should create user_onboarding_preferences table with correct schema', async () => {
      // Create the table
      await pool.query(`
        CREATE TABLE user_onboarding_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          -- Schema-qualified: the fixture table lives in the scratch schema, the
          -- table it points at is the real one.
          user_id UUID NOT NULL UNIQUE REFERENCES public.organization_users(id) ON DELETE CASCADE,
          welcome_dismissed BOOLEAN NOT NULL DEFAULT false,
          modules_visited JSONB NOT NULL DEFAULT '[]',
          last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Verify table exists
      const tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = '${MIGRATION_TEST_SCHEMA}' 
          AND table_name = 'user_onboarding_preferences'
        );
      `);
      
      expect(tableResult.rows[0].exists).toBe(true);
    });

    it('should have all required columns with correct types', async () => {
      // Create the table
      await pool.query(`
        CREATE TABLE user_onboarding_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          -- Schema-qualified: the fixture table lives in the scratch schema, the
          -- table it points at is the real one.
          user_id UUID NOT NULL UNIQUE REFERENCES public.organization_users(id) ON DELETE CASCADE,
          welcome_dismissed BOOLEAN NOT NULL DEFAULT false,
          modules_visited JSONB NOT NULL DEFAULT '[]',
          last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Verify columns
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = '${MIGRATION_TEST_SCHEMA}'
        AND table_name = 'user_onboarding_preferences'
        ORDER BY ordinal_position;
      `);

      const columns = columnsResult.rows;
      
      // Check id column
      const idColumn = columns.find(c => c.column_name === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn?.data_type).toBe('uuid');
      expect(idColumn?.is_nullable).toBe('NO');

      // Check user_id column
      const userIdColumn = columns.find(c => c.column_name === 'user_id');
      expect(userIdColumn).toBeDefined();
      expect(userIdColumn?.data_type).toBe('uuid');
      expect(userIdColumn?.is_nullable).toBe('NO');

      // Check welcome_dismissed column
      const welcomeColumn = columns.find(c => c.column_name === 'welcome_dismissed');
      expect(welcomeColumn).toBeDefined();
      expect(welcomeColumn?.data_type).toBe('boolean');
      expect(welcomeColumn?.is_nullable).toBe('NO');

      // Check modules_visited column
      const modulesColumn = columns.find(c => c.column_name === 'modules_visited');
      expect(modulesColumn).toBeDefined();
      expect(modulesColumn?.data_type).toBe('jsonb');
      expect(modulesColumn?.is_nullable).toBe('NO');

      // Check last_updated column
      const lastUpdatedColumn = columns.find(c => c.column_name === 'last_updated');
      expect(lastUpdatedColumn).toBeDefined();
      expect(lastUpdatedColumn?.data_type).toContain('timestamp');
      expect(lastUpdatedColumn?.is_nullable).toBe('NO');

      // Check created_at column
      const createdAtColumn = columns.find(c => c.column_name === 'created_at');
      expect(createdAtColumn).toBeDefined();
      expect(createdAtColumn?.data_type).toContain('timestamp');
      expect(createdAtColumn?.is_nullable).toBe('NO');
    });

    it('should have unique constraint on user_id', async () => {
      // Create the table
      await pool.query(`
        CREATE TABLE user_onboarding_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          -- Schema-qualified: the fixture table lives in the scratch schema, the
          -- table it points at is the real one.
          user_id UUID NOT NULL UNIQUE REFERENCES public.organization_users(id) ON DELETE CASCADE,
          welcome_dismissed BOOLEAN NOT NULL DEFAULT false,
          modules_visited JSONB NOT NULL DEFAULT '[]',
          last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Verify unique constraint exists
      const constraintResult = await pool.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema = '${MIGRATION_TEST_SCHEMA}'
        AND table_name = 'user_onboarding_preferences'
        AND constraint_type = 'UNIQUE';
      `);

      expect(constraintResult.rows.length).toBeGreaterThanOrEqual(1);
    });

    // Superseded: migration 1709000000019 drops this constraint, because the
    // id being stored is a Keycloak subject and never matched organization_users.
    it('should have foreign key constraint to organization_users (as originally written)', async () => {
      // Create the table
      await pool.query(`
        CREATE TABLE user_onboarding_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          -- Schema-qualified: the fixture table lives in the scratch schema, the
          -- table it points at is the real one.
          user_id UUID NOT NULL UNIQUE REFERENCES public.organization_users(id) ON DELETE CASCADE,
          welcome_dismissed BOOLEAN NOT NULL DEFAULT false,
          modules_visited JSONB NOT NULL DEFAULT '[]',
          last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Verify foreign key constraint exists
      const fkResult = await pool.query(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          -- Not matched on schema: the referencing table is in the scratch
          -- schema and the table it points at is in public.
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = '${MIGRATION_TEST_SCHEMA}'
          AND tc.table_name = 'user_onboarding_preferences';
      `);

      expect(fkResult.rows.length).toBeGreaterThanOrEqual(1);
      const fk = fkResult.rows[0];
      expect(fk.column_name).toBe('user_id');
      expect(fk.foreign_table_name).toBe('organization_users');
      expect(fk.foreign_column_name).toBe('id');
    });
  });

  describe('Indexes', () => {
    beforeEach(async () => {
      // Clean up before each test
      await pool.query('DROP TABLE IF EXISTS user_onboarding_preferences CASCADE;');
    });

    afterEach(async () => {
      // Clean up after each test
      await pool.query('DROP TABLE IF EXISTS user_onboarding_preferences CASCADE;');
    });

    it('should create index on user_id for efficient lookups', async () => {
      // Create the table
      await pool.query(`
        CREATE TABLE user_onboarding_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          -- Schema-qualified: the fixture table lives in the scratch schema, the
          -- table it points at is the real one.
          user_id UUID NOT NULL UNIQUE REFERENCES public.organization_users(id) ON DELETE CASCADE,
          welcome_dismissed BOOLEAN NOT NULL DEFAULT false,
          modules_visited JSONB NOT NULL DEFAULT '[]',
          last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create index
      await pool.query(`
        CREATE INDEX idx_user_onboarding_preferences_user_id 
        ON user_onboarding_preferences(user_id);
      `);

      // Verify index exists
      const indexResult = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = '${MIGRATION_TEST_SCHEMA}'
        AND tablename = 'user_onboarding_preferences'
        AND indexname = 'idx_user_onboarding_preferences_user_id';
      `);

      expect(indexResult.rows.length).toBe(1);
      expect(indexResult.rows[0].indexname).toBe('idx_user_onboarding_preferences_user_id');
    });

    it('should create index on last_updated for analytics queries', async () => {
      // Create the table
      await pool.query(`
        CREATE TABLE user_onboarding_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          -- Schema-qualified: the fixture table lives in the scratch schema, the
          -- table it points at is the real one.
          user_id UUID NOT NULL UNIQUE REFERENCES public.organization_users(id) ON DELETE CASCADE,
          welcome_dismissed BOOLEAN NOT NULL DEFAULT false,
          modules_visited JSONB NOT NULL DEFAULT '[]',
          last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create index
      await pool.query(`
        CREATE INDEX idx_user_onboarding_preferences_last_updated 
        ON user_onboarding_preferences(last_updated);
      `);

      // Verify index exists
      const indexResult = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = '${MIGRATION_TEST_SCHEMA}'
        AND tablename = 'user_onboarding_preferences'
        AND indexname = 'idx_user_onboarding_preferences_last_updated';
      `);

      expect(indexResult.rows.length).toBe(1);
      expect(indexResult.rows[0].indexname).toBe('idx_user_onboarding_preferences_last_updated');
    });
  });

  describe('Down Migration', () => {
    beforeEach(async () => {
      // Create table for down migration tests
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_onboarding_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          -- Schema-qualified: the fixture table lives in the scratch schema, the
          -- table it points at is the real one.
          user_id UUID NOT NULL UNIQUE REFERENCES public.organization_users(id) ON DELETE CASCADE,
          welcome_dismissed BOOLEAN NOT NULL DEFAULT false,
          modules_visited JSONB NOT NULL DEFAULT '[]',
          last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    });

    it('should drop user_onboarding_preferences table', async () => {
      // Verify table exists
      const beforeResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = '${MIGRATION_TEST_SCHEMA}' 
          AND table_name = 'user_onboarding_preferences'
        );
      `);
      expect(beforeResult.rows[0].exists).toBe(true);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS user_onboarding_preferences CASCADE;');

      // Verify table is dropped
      const afterResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = '${MIGRATION_TEST_SCHEMA}' 
          AND table_name = 'user_onboarding_preferences'
        );
      `);
      expect(afterResult.rows[0].exists).toBe(false);
    });

    it('should remove all indexes when table is dropped', async () => {
      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_onboarding_preferences_user_id 
        ON user_onboarding_preferences(user_id);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_onboarding_preferences_last_updated 
        ON user_onboarding_preferences(last_updated);
      `);

      // Verify indexes exist
      const beforeResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = '${MIGRATION_TEST_SCHEMA}'
        AND tablename = 'user_onboarding_preferences';
      `);
      expect(beforeResult.rows.length).toBeGreaterThanOrEqual(2);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS user_onboarding_preferences CASCADE;');

      // Verify indexes are gone
      const afterResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = '${MIGRATION_TEST_SCHEMA}'
        AND tablename = 'user_onboarding_preferences';
      `);
      expect(afterResult.rows).toHaveLength(0);
    });
  });
});
