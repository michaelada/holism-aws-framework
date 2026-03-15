/**
 * Unit Tests for Membership Number Generator Service
 * Feature: membership-numbering-configuration
 */

import { MembershipNumberGenerator } from '../membership-number-generator.service';
import { db } from '../../database/pool';

describe('MembershipNumberGenerator', () => {
  let generator: MembershipNumberGenerator;
  let testOrgTypeId: string;
  let testOrgId1: string;
  let testOrgId2: string;

  beforeAll(async () => {
    try {
      await db.initialize();
    } catch (error) {
      console.log('Database initialization:', error instanceof Error ? error.message : 'Already initialized');
    }

    // Run migration to create membership_number_sequences table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS membership_number_sequences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_type_id UUID NOT NULL,
          organization_id UUID,
          next_number INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_sequence_scope UNIQUE(organization_type_id, organization_id)
        );
      `);

      // Add foreign key constraints
      await db.query(`
        ALTER TABLE membership_number_sequences
          DROP CONSTRAINT IF EXISTS fk_sequences_organization_type;
        
        ALTER TABLE membership_number_sequences
          ADD CONSTRAINT fk_sequences_organization_type
          FOREIGN KEY (organization_type_id) 
          REFERENCES organization_types(id) 
          ON DELETE CASCADE;
      `);

      await db.query(`
        ALTER TABLE membership_number_sequences
          DROP CONSTRAINT IF EXISTS fk_sequences_organization;
        
        ALTER TABLE membership_number_sequences
          ADD CONSTRAINT fk_sequences_organization
          FOREIGN KEY (organization_id) 
          REFERENCES organizations(id) 
          ON DELETE CASCADE;
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_sequences_org_type 
          ON membership_number_sequences(organization_type_id);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_sequences_org 
          ON membership_number_sequences(organization_id);
      `);
    } catch (error) {
      console.log('Migration setup:', error instanceof Error ? error.message : 'Already exists');
    }

    // Create test organization type
    const orgTypeResult = await db.query(
      `INSERT INTO organization_types (name, display_name, currency, language, default_locale, default_capabilities)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [`test-org-type-numgen-${Date.now()}`, 'Test Org Type NumGen', 'GBP', 'en', 'en-GB', '[]']
    );
    testOrgTypeId = orgTypeResult.rows[0].id;

    // Create test organizations
    const org1Result = await db.query(
      `INSERT INTO organizations (name, organization_type_id, language, currency, keycloak_group_id, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [`test-org-1-${Date.now()}`, testOrgTypeId, 'en', 'GBP', `test-org-1-${Date.now()}`, 'Test Org 1']
    );
    testOrgId1 = org1Result.rows[0].id;

    const org2Result = await db.query(
      `INSERT INTO organizations (name, organization_type_id, language, currency, keycloak_group_id, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [`test-org-2-${Date.now()}`, testOrgTypeId, 'en', 'GBP', `test-org-2-${Date.now()}`, 'Test Org 2']
    );
    testOrgId2 = org2Result.rows[0].id;
  });

  beforeEach(() => {
    generator = new MembershipNumberGenerator();
  });

  afterEach(async () => {
    // Clean up sequences after each test
    try {
      await db.query('DELETE FROM membership_number_sequences WHERE organization_type_id = $1', [testOrgTypeId]);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await db.query('DELETE FROM membership_number_sequences WHERE organization_type_id = $1', [testOrgTypeId]);
      await db.query('DELETE FROM organizations WHERE id IN ($1, $2)', [testOrgId1, testOrgId2]);
      await db.query('DELETE FROM organization_types WHERE id = $1', [testOrgTypeId]);
      
      // Drop the test table
      await db.query('DROP TABLE IF EXISTS membership_number_sequences CASCADE');
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    try {
      await db.close();
    } catch (error) {
      console.error('Database close error:', error);
    }
  });

  describe('generateNumber', () => {
    it('should generate initial number for organization-level uniqueness', async () => {
      const config = {
        mode: 'internal' as const,
        uniqueness: 'organization' as const,
        initialNumber: 1000000
      };

      const number = await generator.generateNumber(testOrgId1, testOrgTypeId, config);

      expect(number).toBe('1000000');
    });

    it('should generate sequential numbers for organization-level uniqueness', async () => {
      const config = {
        mode: 'internal' as const,
        uniqueness: 'organization' as const,
        initialNumber: 1000000
      };

      const number1 = await generator.generateNumber(testOrgId1, testOrgTypeId, config);
      const number2 = await generator.generateNumber(testOrgId1, testOrgTypeId, config);
      const number3 = await generator.generateNumber(testOrgId1, testOrgTypeId, config);

      expect(number1).toBe('1000000');
      expect(number2).toBe('1000001');
      expect(number3).toBe('1000002');
    });

    it('should generate independent sequences for different organizations (organization-level)', async () => {
      const config = {
        mode: 'internal' as const,
        uniqueness: 'organization' as const,
        initialNumber: 1000000
      };

      const org1Number1 = await generator.generateNumber(testOrgId1, testOrgTypeId, config);
      const org2Number1 = await generator.generateNumber(testOrgId2, testOrgTypeId, config);
      const org1Number2 = await generator.generateNumber(testOrgId1, testOrgTypeId, config);
      const org2Number2 = await generator.generateNumber(testOrgId2, testOrgTypeId, config);

      // Each organization should have its own sequence
      expect(org1Number1).toBe('1000000');
      expect(org2Number1).toBe('1000000');
      expect(org1Number2).toBe('1000001');
      expect(org2Number2).toBe('1000001');
    });

    it('should generate shared sequence for organization type-level uniqueness', async () => {
      const config = {
        mode: 'internal' as const,
        uniqueness: 'organization_type' as const,
        initialNumber: 2000000
      };

      const org1Number1 = await generator.generateNumber(testOrgId1, testOrgTypeId, config);
      const org2Number1 = await generator.generateNumber(testOrgId2, testOrgTypeId, config);
      const org1Number2 = await generator.generateNumber(testOrgId1, testOrgTypeId, config);

      // All organizations of the same type should share the sequence
      expect(org1Number1).toBe('2000000');
      expect(org2Number1).toBe('2000001');
      expect(org1Number2).toBe('2000002');
    });

    it('should handle custom initial numbers', async () => {
      const config = {
        mode: 'internal' as const,
        uniqueness: 'organization' as const,
        initialNumber: 5000000
      };

      const number1 = await generator.generateNumber(testOrgId1, testOrgTypeId, config);
      const number2 = await generator.generateNumber(testOrgId1, testOrgTypeId, config);

      expect(number1).toBe('5000000');
      expect(number2).toBe('5000001');
    });

    it('should create sequence record if it does not exist', async () => {
      const config = {
        mode: 'internal' as const,
        uniqueness: 'organization' as const,
        initialNumber: 1000000
      };

      // Verify no sequence exists
      const beforeResult = await db.query(
        'SELECT * FROM membership_number_sequences WHERE organization_type_id = $1 AND organization_id = $2',
        [testOrgTypeId, testOrgId1]
      );
      expect(beforeResult.rows.length).toBe(0);

      // Generate number
      await generator.generateNumber(testOrgId1, testOrgTypeId, config);

      // Verify sequence was created
      const afterResult = await db.query(
        'SELECT * FROM membership_number_sequences WHERE organization_type_id = $1 AND organization_id = $2',
        [testOrgTypeId, testOrgId1]
      );
      expect(afterResult.rows.length).toBe(1);
      expect(afterResult.rows[0].next_number).toBe(1000001); // Should be incremented
    });

    it('should use existing sequence record if it exists', async () => {
      const config = {
        mode: 'internal' as const,
        uniqueness: 'organization' as const,
        initialNumber: 1000000
      };

      // Create sequence manually with a specific value
      await db.query(
        `INSERT INTO membership_number_sequences (organization_type_id, organization_id, next_number)
         VALUES ($1, $2, $3)`,
        [testOrgTypeId, testOrgId1, 3000000]
      );

      // Generate number should use existing sequence
      const number = await generator.generateNumber(testOrgId1, testOrgTypeId, config);

      expect(number).toBe('3000000');
    });

    it('should rollback transaction on error', async () => {
      const config = {
        mode: 'internal' as const,
        uniqueness: 'organization' as const,
        initialNumber: 1000000
      };

      // Create an invalid scenario by using a non-existent organization type
      const invalidOrgTypeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        generator.generateNumber(testOrgId1, invalidOrgTypeId, config)
      ).rejects.toThrow();

      // Verify no sequence was created
      const result = await db.query(
        'SELECT * FROM membership_number_sequences WHERE organization_type_id = $1',
        [invalidOrgTypeId]
      );
      expect(result.rows.length).toBe(0);
    });
  });

  describe('generateWithRetry', () => {
  it('should successfully generate number on first attempt', async () => {
    const config = {
      mode: 'internal' as const,
      uniqueness: 'organization' as const,
      initialNumber: 1000000
    };

    const number = await generator.generateWithRetry(testOrgId1, testOrgTypeId, config);

    expect(number).toBe('1000000');
  });

  it('should retry on deadlock error and eventually succeed', async () => {
    const config = {
      mode: 'internal' as const,
      uniqueness: 'organization' as const,
      initialNumber: 1000000
    };

    let attemptCount = 0;
    const originalGenerateNumber = generator.generateNumber.bind(generator);

    // Mock generateNumber to simulate deadlock on first attempt, then succeed
    jest.spyOn(generator, 'generateNumber').mockImplementation(async (...args) => {
      attemptCount++;
      if (attemptCount === 1) {
        const error: any = new Error('Deadlock detected');
        error.code = '40P01'; // PostgreSQL deadlock error code
        throw error;
      }
      return originalGenerateNumber(...args);
    });

    const startTime = Date.now();
    const number = await generator.generateWithRetry(testOrgId1, testOrgTypeId, config);
    const duration = Date.now() - startTime;

    expect(number).toBe('1000000');
    expect(attemptCount).toBe(2);
    // Should have waited ~100ms for first retry
    expect(duration).toBeGreaterThanOrEqual(100);
    expect(duration).toBeLessThan(300); // Allow some margin
  });

  it('should implement exponential backoff (100ms, 200ms, 400ms)', async () => {
    const config = {
      mode: 'internal' as const,
      uniqueness: 'organization' as const,
      initialNumber: 1000000
    };

    let attemptCount = 0;
    const originalGenerateNumber = generator.generateNumber.bind(generator);

    // Mock generateNumber to simulate deadlock on first two attempts, then succeed
    jest.spyOn(generator, 'generateNumber').mockImplementation(async (...args) => {
      attemptCount++;
      if (attemptCount <= 2) {
        const error: any = new Error('Deadlock detected');
        error.code = '40P01';
        throw error;
      }
      return originalGenerateNumber(...args);
    });

    const startTime = Date.now();
    const number = await generator.generateWithRetry(testOrgId1, testOrgTypeId, config);
    const duration = Date.now() - startTime;

    expect(number).toBe('1000000');
    expect(attemptCount).toBe(3);
    // Should have waited ~100ms + ~200ms = ~300ms total
    expect(duration).toBeGreaterThanOrEqual(300);
    expect(duration).toBeLessThan(500); // Allow some margin
  });

  it('should throw clear error after max retries exceeded', async () => {
    const config = {
      mode: 'internal' as const,
      uniqueness: 'organization' as const,
      initialNumber: 1000000
    };

    // Mock generateNumber to always throw deadlock error
    jest.spyOn(generator, 'generateNumber').mockImplementation(async () => {
      const error: any = new Error('Deadlock detected');
      error.code = '40P01';
      throw error;
    });

    await expect(
      generator.generateWithRetry(testOrgId1, testOrgTypeId, config)
    ).rejects.toThrow('Failed to generate membership number after 3 retry attempts. Please try again.');
  });

  it('should throw non-deadlock errors immediately without retry', async () => {
    const config = {
      mode: 'internal' as const,
      uniqueness: 'organization' as const,
      initialNumber: 1000000
    };

    let attemptCount = 0;

    // Mock generateNumber to throw a non-deadlock error
    jest.spyOn(generator, 'generateNumber').mockImplementation(async () => {
      attemptCount++;
      const error: any = new Error('Connection error');
      error.code = '08006'; // Different error code
      throw error;
    });

    const startTime = Date.now();

    await expect(
      generator.generateWithRetry(testOrgId1, testOrgTypeId, config)
    ).rejects.toThrow('Connection error');

    const duration = Date.now() - startTime;

    // Should fail immediately without retry
    expect(attemptCount).toBe(1);
    expect(duration).toBeLessThan(50); // No backoff delay
  });

  it('should respect custom maxRetries parameter', async () => {
    const config = {
      mode: 'internal' as const,
      uniqueness: 'organization' as const,
      initialNumber: 1000000
    };

    let attemptCount = 0;

    // Mock generateNumber to always throw deadlock error
    jest.spyOn(generator, 'generateNumber').mockImplementation(async () => {
      attemptCount++;
      const error: any = new Error('Deadlock detected');
      error.code = '40P01';
      throw error;
    });

    await expect(
      generator.generateWithRetry(testOrgId1, testOrgTypeId, config, 5)
    ).rejects.toThrow('Failed to generate membership number after 5 retry attempts. Please try again.');

    expect(attemptCount).toBe(5);
  });

  it('should handle deadlock on last attempt correctly', async () => {
    const config = {
      mode: 'internal' as const,
      uniqueness: 'organization' as const,
      initialNumber: 1000000
    };

    let attemptCount = 0;

    // Mock generateNumber to throw deadlock on exactly the 3rd attempt
    jest.spyOn(generator, 'generateNumber').mockImplementation(async () => {
      attemptCount++;
      const error: any = new Error('Deadlock detected');
      error.code = '40P01';
      throw error;
    });

    await expect(
      generator.generateWithRetry(testOrgId1, testOrgTypeId, config, 3)
    ).rejects.toThrow('Failed to generate membership number after 3 retry attempts. Please try again.');

    expect(attemptCount).toBe(3);
  });
});
});
