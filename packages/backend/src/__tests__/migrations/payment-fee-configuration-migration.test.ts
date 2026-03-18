/**
 * Migration Tests for Payment Fee Configuration
 *
 * Tests that the migration SQL file:
 * - Uses IF NOT EXISTS for all six column additions (idempotency)
 * - Specifies correct column types and defaults
 * - Covers all four target tables
 *
 * Requirements: 7.7
 * Feature: payment-fee-configuration, Property 5: Migration idempotency
 */

import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../database/migrations/010_add_payment_fee_configuration.sql'
);
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

describe('Payment Fee Configuration Migration', () => {
  describe('Migration file structure', () => {
    it('should exist and be non-empty', () => {
      expect(migrationSQL).toBeDefined();
      expect(migrationSQL.trim().length).toBeGreaterThan(0);
    });
  });

  describe('IF NOT EXISTS idempotency (Property 5)', () => {
    /**
     * **Validates: Requirements 7.7**
     *
     * Every ALTER TABLE ADD COLUMN statement must use IF NOT EXISTS
     * so the migration can be run multiple times safely.
     */
    const expectedColumns = [
      { table: 'membership_types', column: 'fee' },
      { table: 'membership_types', column: 'handling_fee_included' },
      { table: 'registration_types', column: 'fee' },
      { table: 'registration_types', column: 'handling_fee_included' },
      { table: 'calendars', column: 'handling_fee_included' },
      { table: 'merchandise_types', column: 'handling_fee_included' },
    ];

    it.each(expectedColumns)(
      'should use IF NOT EXISTS for $table.$column',
      ({ table, column }) => {
        const pattern = new RegExp(
          `ALTER\\s+TABLE\\s+${table}\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${column}`,
          'i'
        );
        expect(migrationSQL).toMatch(pattern);
      }
    );

    it('should contain exactly six ALTER TABLE ADD COLUMN IF NOT EXISTS statements', () => {
      const matches = migrationSQL.match(
        /ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi
      );
      expect(matches).toHaveLength(6);
    });
  });

  describe('Column types and defaults', () => {
    /**
     * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
     */
    const feeColumns = [
      { table: 'membership_types', column: 'fee' },
      { table: 'registration_types', column: 'fee' },
    ];

    const booleanColumns = [
      { table: 'membership_types', column: 'handling_fee_included' },
      { table: 'registration_types', column: 'handling_fee_included' },
      { table: 'calendars', column: 'handling_fee_included' },
      { table: 'merchandise_types', column: 'handling_fee_included' },
    ];

    it.each(feeColumns)(
      'should define $table.$column as DECIMAL(10,2) DEFAULT 0.00',
      ({ table, column }) => {
        const pattern = new RegExp(
          `ALTER\\s+TABLE\\s+${table}\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${column}\\s+DECIMAL\\(10,\\s*2\\)\\s+DEFAULT\\s+0\\.00`,
          'i'
        );
        expect(migrationSQL).toMatch(pattern);
      }
    );

    it.each(booleanColumns)(
      'should define $table.$column as BOOLEAN DEFAULT false',
      ({ table, column }) => {
        const pattern = new RegExp(
          `ALTER\\s+TABLE\\s+${table}\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${column}\\s+BOOLEAN\\s+DEFAULT\\s+false`,
          'i'
        );
        expect(migrationSQL).toMatch(pattern);
      }
    );
  });

  describe('Table coverage', () => {
    const expectedTables = [
      'membership_types',
      'registration_types',
      'calendars',
      'merchandise_types',
    ];

    it.each(expectedTables)('should include ALTER TABLE for %s', (table) => {
      const pattern = new RegExp(`ALTER\\s+TABLE\\s+${table}`, 'i');
      expect(migrationSQL).toMatch(pattern);
    });
  });
});
