/**
 * Migration Tests for Membership Type Discount IDs
 * 
 * Tests that the migration properly:
 * - Adds discount_ids JSONB column to membership_types table
 * - Sets default value to empty JSON array
 * - Creates GIN index for efficient lookups
 * - Is idempotent (can be run multiple times safely)
 * - Preserves existing data
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import fc from 'fast-check';

// Load test environment
const testEnvPath = path.resolve(__dirname, '../../../.env.test');
config({ path: testEnvPath });

describe('Feature: membership-discount-integration, Migration Tests', () => {
  let pool: Pool;
  const migrationPath = path.resolve(__dirname, '../../migrations/add-membership-type-discount-ids.sql');
  let migrationSQL: string;

  beforeAll(() => {
    // Create a connection pool for testing
    pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'aws_framework_test',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
    });

    // Read migration file
    migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Migration Structure Validation', () => {
    it('should have valid migration file', () => {
      expect(migrationSQL).toBeDefined();
      expect(migrationSQL).toContain('ALTER TABLE membership_types');
      expect(migrationSQL).toContain('ADD COLUMN IF NOT EXISTS discount_ids');
      expect(migrationSQL).toContain('CREATE INDEX IF NOT EXISTS');
    });
  });

  describe('Property 20: Migration Idempotency', () => {
    /**
     * **Validates: Requirements 7.5**
     * 
     * For any database state, running the discount_ids column migration multiple times 
     * should not cause errors, data loss, or duplicate columns.
     */
    it('should be idempotent - running migration multiple times should not cause errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // Run migration 2-5 times
          async (runCount) => {
            // Setup: Ensure clean state
            await pool.query('DROP TABLE IF EXISTS membership_types CASCADE;');
            
            // Create membership_types table without discount_ids column
            await pool.query(`
              CREATE TABLE membership_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organisation_id UUID NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                membership_form_id UUID NOT NULL,
                membership_status VARCHAR(50) DEFAULT 'open',
                is_rolling_membership BOOLEAN DEFAULT false,
                valid_until TIMESTAMP,
                number_of_months INTEGER,
                automatically_approve BOOLEAN DEFAULT false,
                member_labels JSONB DEFAULT '[]',
                supported_payment_methods JSONB DEFAULT '[]',
                use_terms_and_conditions BOOLEAN DEFAULT false,
                terms_and_conditions TEXT,
                membership_type_category VARCHAR(50) DEFAULT 'single',
                max_people_in_application INTEGER,
                min_people_in_application INTEGER,
                person_titles JSONB,
                person_labels JSONB,
                field_configuration JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              );
            `);

            // Run migration multiple times
            for (let i = 0; i < runCount; i++) {
              await expect(pool.query(migrationSQL)).resolves.not.toThrow();
            }

            // Verify column exists exactly once
            const columnResult = await pool.query(`
              SELECT COUNT(*) as count
              FROM information_schema.columns
              WHERE table_name = 'membership_types'
              AND column_name = 'discount_ids';
            `);
            
            expect(parseInt(columnResult.rows[0].count)).toBe(1);

            // Verify index exists
            const indexResult = await pool.query(`
              SELECT COUNT(*) as count
              FROM pg_indexes
              WHERE tablename = 'membership_types'
              AND indexname = 'idx_membership_types_discount_ids';
            `);
            
            expect(parseInt(indexResult.rows[0].count)).toBe(1);

            // Cleanup
            await pool.query('DROP TABLE IF EXISTS membership_types CASCADE;');
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });

  describe('Property 21: Migration Data Preservation', () => {
    /**
     * **Validates: Requirements 7.6**
     * 
     * For any existing membership type record, after running the discount_ids migration, 
     * all existing field values should remain unchanged.
     */
    it('should preserve existing data when adding discount_ids column', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              description: fc.string({ maxLength: 500 }),
              membershipStatus: fc.constantFrom('open', 'closed'),
              isRollingMembership: fc.boolean(),
              automaticallyApprove: fc.boolean(),
              membershipTypeCategory: fc.constantFrom('single', 'group'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (membershipTypes) => {
            // Setup: Ensure clean state
            await pool.query('DROP TABLE IF EXISTS membership_types CASCADE;');
            
            // Create membership_types table without discount_ids column
            await pool.query(`
              CREATE TABLE membership_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organisation_id UUID NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                membership_form_id UUID NOT NULL,
                membership_status VARCHAR(50) DEFAULT 'open',
                is_rolling_membership BOOLEAN DEFAULT false,
                valid_until TIMESTAMP,
                number_of_months INTEGER,
                automatically_approve BOOLEAN DEFAULT false,
                member_labels JSONB DEFAULT '[]',
                supported_payment_methods JSONB DEFAULT '[]',
                use_terms_and_conditions BOOLEAN DEFAULT false,
                terms_and_conditions TEXT,
                membership_type_category VARCHAR(50) DEFAULT 'single',
                max_people_in_application INTEGER,
                min_people_in_application INTEGER,
                person_titles JSONB,
                person_labels JSONB,
                field_configuration JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              );
            `);

            // Insert test data
            const insertedIds: string[] = [];
            for (const mt of membershipTypes) {
              const result = await pool.query(
                `INSERT INTO membership_types 
                 (organisation_id, name, description, membership_form_id, membership_status, 
                  is_rolling_membership, automatically_approve, membership_type_category)
                 VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), $3, $4, $5, $6)
                 RETURNING id, name, description, membership_status, is_rolling_membership, 
                           automatically_approve, membership_type_category`,
                [
                  mt.name,
                  mt.description,
                  mt.membershipStatus,
                  mt.isRollingMembership,
                  mt.automaticallyApprove,
                  mt.membershipTypeCategory,
                ]
              );
              insertedIds.push(result.rows[0].id);
            }

            // Capture data before migration
            const beforeResult = await pool.query(
              'SELECT id, name, description, membership_status, is_rolling_membership, automatically_approve, membership_type_category FROM membership_types ORDER BY id'
            );
            const beforeData = beforeResult.rows;

            // Run migration
            await pool.query(migrationSQL);

            // Capture data after migration
            const afterResult = await pool.query(
              'SELECT id, name, description, membership_status, is_rolling_membership, automatically_approve, membership_type_category FROM membership_types ORDER BY id'
            );
            const afterData = afterResult.rows;

            // Verify all data is preserved
            expect(afterData.length).toBe(beforeData.length);
            for (let i = 0; i < beforeData.length; i++) {
              expect(afterData[i].id).toBe(beforeData[i].id);
              expect(afterData[i].name).toBe(beforeData[i].name);
              expect(afterData[i].description).toBe(beforeData[i].description);
              expect(afterData[i].membership_status).toBe(beforeData[i].membership_status);
              expect(afterData[i].is_rolling_membership).toBe(beforeData[i].is_rolling_membership);
              expect(afterData[i].automatically_approve).toBe(beforeData[i].automatically_approve);
              expect(afterData[i].membership_type_category).toBe(beforeData[i].membership_type_category);
            }

            // Verify discount_ids column was added with default value
            const discountIdsResult = await pool.query(
              'SELECT id, discount_ids FROM membership_types ORDER BY id'
            );
            for (const row of discountIdsResult.rows) {
              expect(row.discount_ids).toEqual([]);
            }

            // Cleanup
            await pool.query('DROP TABLE IF EXISTS membership_types CASCADE;');
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });

  describe('Column and Index Creation', () => {
    beforeEach(async () => {
      // Clean up before each test
      await pool.query('DROP TABLE IF EXISTS membership_types CASCADE;');
      
      // Create membership_types table without discount_ids column
      await pool.query(`
        CREATE TABLE membership_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organisation_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          membership_form_id UUID NOT NULL,
          membership_status VARCHAR(50) DEFAULT 'open',
          is_rolling_membership BOOLEAN DEFAULT false,
          valid_until TIMESTAMP,
          number_of_months INTEGER,
          automatically_approve BOOLEAN DEFAULT false,
          member_labels JSONB DEFAULT '[]',
          supported_payment_methods JSONB DEFAULT '[]',
          use_terms_and_conditions BOOLEAN DEFAULT false,
          terms_and_conditions TEXT,
          membership_type_category VARCHAR(50) DEFAULT 'single',
          max_people_in_application INTEGER,
          min_people_in_application INTEGER,
          person_titles JSONB,
          person_labels JSONB,
          field_configuration JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    });

    afterEach(async () => {
      // Clean up after each test
      await pool.query('DROP TABLE IF EXISTS membership_types CASCADE;');
    });

    it('should add discount_ids column with correct type and default value', async () => {
      // Run migration
      await pool.query(migrationSQL);

      // Verify column exists with correct type
      const columnResult = await pool.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'membership_types'
        AND column_name = 'discount_ids';
      `);
      
      expect(columnResult.rows.length).toBe(1);
      expect(columnResult.rows[0].data_type).toBe('jsonb');
      expect(columnResult.rows[0].column_default).toContain("'[]'::jsonb");
    });

    it('should create GIN index on discount_ids column', async () => {
      // Run migration
      await pool.query(migrationSQL);

      // Verify index exists
      const indexResult = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'membership_types'
        AND indexname = 'idx_membership_types_discount_ids';
      `);
      
      expect(indexResult.rows.length).toBe(1);
      expect(indexResult.rows[0].indexdef).toContain('USING gin');
      expect(indexResult.rows[0].indexdef).toContain('discount_ids');
    });

    it('should set default value to empty JSON array for new records', async () => {
      // Run migration
      await pool.query(migrationSQL);

      // Insert a new record without specifying discount_ids
      const result = await pool.query(`
        INSERT INTO membership_types 
        (organisation_id, name, description, membership_form_id)
        VALUES (gen_random_uuid(), $1, $2, gen_random_uuid())
        RETURNING discount_ids
      `, [
        'Test Membership',
        'Test Description'
      ]);

      // Verify default value is empty array
      expect(result.rows[0].discount_ids).toEqual([]);
    });
  });
});
