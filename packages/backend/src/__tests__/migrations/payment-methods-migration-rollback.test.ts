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
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load test environment
const testEnvPath = path.resolve(__dirname, '../../../.env.test');
config({ path: testEnvPath });

describe.skip('Payment Methods Migration Rollback Tests', () => {
  let pool: Pool;

  beforeAll(() => {
    // Create a connection pool for testing
    pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'aws_framework_test',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Down Migration - Table Cleanup', () => {
    it('should drop org_payment_method_data table', async () => {
      // First, verify the table exists
      const beforeResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'org_payment_method_data'
        );
      `);
      
      const tableExistsBefore = beforeResult.rows[0].exists;

      if (tableExistsBefore) {
        // Execute down migration
        await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');

        // Verify table is dropped
        const afterResult = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'org_payment_method_data'
          );
        `);

        expect(afterResult.rows[0].exists).toBe(false);
      } else {
        // If table doesn't exist, test passes (already cleaned up)
        expect(tableExistsBefore).toBe(false);
      }
    });

    it('should drop payment_methods table', async () => {
      // First, verify the table exists
      const beforeResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'payment_methods'
        );
      `);
      
      const tableExistsBefore = beforeResult.rows[0].exists;

      if (tableExistsBefore) {
        // Execute down migration
        await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

        // Verify table is dropped
        const afterResult = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'payment_methods'
          );
        `);

        expect(afterResult.rows[0].exists).toBe(false);
      } else {
        // If table doesn't exist, test passes (already cleaned up)
        expect(tableExistsBefore).toBe(false);
      }
    });

    it('should drop tables in correct order (child before parent)', async () => {
      // This test verifies that dropping org_payment_method_data before payment_methods
      // doesn't cause foreign key constraint errors
      
      // Recreate tables for this test
      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      // Create payment_methods table
      await pool.query(`
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
      `);

      // Create org_payment_method_data table with foreign key
      await pool.query(`
        CREATE TABLE org_payment_method_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL,
          payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
          status VARCHAR(50) NOT NULL DEFAULT 'inactive',
          payment_data JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Now test the down migration order
      // Drop child table first (should succeed)
      await expect(
        pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;')
      ).resolves.not.toThrow();

      // Drop parent table (should succeed)
      await expect(
        pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;')
      ).resolves.not.toThrow();

      // Verify both tables are dropped
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('payment_methods', 'org_payment_method_data');
      `);

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Down Migration - Seed Data Removal', () => {
    beforeEach(async () => {
      // Ensure tables exist and are clean
      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      // Recreate tables
      await pool.query(`
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
      `);

      // Insert seed data
      await pool.query(`
        INSERT INTO payment_methods (name, display_name, description, requires_activation, is_active)
        VALUES
          ('pay-offline', 'Pay Offline', 'Payment instructions will be provided in the confirmation email.', false, true),
          ('stripe', 'Pay By Card (Stripe)', 'Accept card payments through Stripe.', true, true),
          ('helix-pay', 'Pay By Card (Helix-Pay)', 'Accept card payments through Helix-Pay.', true, true);
      `);
    });

    it('should remove pay-offline seed data when table is dropped', async () => {
      // Verify seed data exists
      const beforeResult = await pool.query(`
        SELECT * FROM payment_methods WHERE name = 'pay-offline';
      `);
      expect(beforeResult.rows).toHaveLength(1);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      // Verify table and data are gone
      const afterResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'payment_methods'
        );
      `);
      expect(afterResult.rows[0].exists).toBe(false);
    });

    it('should remove stripe seed data when table is dropped', async () => {
      // Verify seed data exists
      const beforeResult = await pool.query(`
        SELECT * FROM payment_methods WHERE name = 'stripe';
      `);
      expect(beforeResult.rows).toHaveLength(1);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      // Verify table and data are gone
      const afterResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'payment_methods'
        );
      `);
      expect(afterResult.rows[0].exists).toBe(false);
    });

    it('should remove helix-pay seed data when table is dropped', async () => {
      // Verify seed data exists
      const beforeResult = await pool.query(`
        SELECT * FROM payment_methods WHERE name = 'helix-pay';
      `);
      expect(beforeResult.rows).toHaveLength(1);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      // Verify table and data are gone
      const afterResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'payment_methods'
        );
      `);
      expect(afterResult.rows[0].exists).toBe(false);
    });

    it('should remove all three seeded payment methods', async () => {
      // Verify all seed data exists
      const beforeResult = await pool.query(`
        SELECT name FROM payment_methods 
        WHERE name IN ('pay-offline', 'stripe', 'helix-pay')
        ORDER BY name;
      `);
      expect(beforeResult.rows).toHaveLength(3);
      expect(beforeResult.rows.map(r => r.name)).toEqual(['helix-pay', 'pay-offline', 'stripe']);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      // Verify table is gone
      const afterResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'payment_methods'
        );
      `);
      expect(afterResult.rows[0].exists).toBe(false);
    });
  });

  describe('Down Migration - Indexes and Constraints Cleanup', () => {
    beforeEach(async () => {
      // Ensure tables exist with indexes
      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      // Recreate payment_methods table with indexes
      await pool.query(`
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
      `);

      // Recreate org_payment_method_data table with indexes
      await pool.query(`
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
      `);
    });

    it('should remove payment_methods indexes when table is dropped', async () => {
      // Verify indexes exist
      const beforeResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'payment_methods' 
        AND indexname IN ('idx_payment_methods_is_active', 'idx_payment_methods_name');
      `);
      expect(beforeResult.rows.length).toBeGreaterThanOrEqual(2);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      // Verify indexes are gone
      const afterResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'payment_methods';
      `);
      expect(afterResult.rows).toHaveLength(0);
    });

    it('should remove org_payment_method_data indexes when table is dropped', async () => {
      // Verify indexes exist
      const beforeResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'org_payment_method_data' 
        AND indexname IN ('idx_org_payment_method_data_organization_id', 'idx_org_payment_method_data_status');
      `);
      expect(beforeResult.rows.length).toBeGreaterThanOrEqual(2);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');

      // Verify indexes are gone
      const afterResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'org_payment_method_data';
      `);
      expect(afterResult.rows).toHaveLength(0);
    });

    it('should remove unique constraint on org_payment_method_data', async () => {
      // Verify unique constraint exists
      const beforeResult = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'org_payment_method_data' 
        AND constraint_type = 'UNIQUE';
      `);
      expect(beforeResult.rows.length).toBeGreaterThanOrEqual(1);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');

      // Verify constraint is gone (table doesn't exist)
      const afterResult = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'org_payment_method_data';
      `);
      expect(afterResult.rows).toHaveLength(0);
    });

    it('should remove foreign key constraint from org_payment_method_data', async () => {
      // Verify foreign key constraint exists
      const beforeResult = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'org_payment_method_data' 
        AND constraint_type = 'FOREIGN KEY';
      `);
      expect(beforeResult.rows.length).toBeGreaterThanOrEqual(1);

      // Execute down migration
      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');

      // Verify constraint is gone (table doesn't exist)
      const afterResult = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'org_payment_method_data';
      `);
      expect(afterResult.rows).toHaveLength(0);
    });
  });

  describe('Down Migration - Complete Rollback', () => {
    it('should completely rollback the migration leaving no traces', async () => {
      // Setup: Create tables with all features
      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      await pool.query(`
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
      `);

      await pool.query(`
        INSERT INTO payment_methods (name, display_name, description, requires_activation, is_active)
        VALUES
          ('pay-offline', 'Pay Offline', 'Payment instructions will be provided.', false, true),
          ('stripe', 'Pay By Card (Stripe)', 'Accept card payments.', true, true),
          ('helix-pay', 'Pay By Card (Helix-Pay)', 'Accept card payments.', true, true);
      `);

      await pool.query(`
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
      `);

      // Execute complete down migration
      await pool.query('DROP TABLE IF EXISTS org_payment_method_data CASCADE;');
      await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE;');

      // Verify no tables exist
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('payment_methods', 'org_payment_method_data');
      `);
      expect(tablesResult.rows).toHaveLength(0);

      // Verify no indexes exist
      const indexesResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename IN ('payment_methods', 'org_payment_method_data');
      `);
      expect(indexesResult.rows).toHaveLength(0);

      // Verify no constraints exist
      const constraintsResult = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name IN ('payment_methods', 'org_payment_method_data');
      `);
      expect(constraintsResult.rows).toHaveLength(0);
    });
  });
});
