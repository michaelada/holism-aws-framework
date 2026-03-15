import { db } from '../database/pool';
import { logger } from '../config/logger';
import { MembershipNumbering, MembershipNumberUniqueness } from '../types/organization.types';

/**
 * Configuration for membership number generation
 */
export interface MembershipNumberConfig {
  mode: MembershipNumbering;
  uniqueness: MembershipNumberUniqueness;
  initialNumber: number;
}

/**
 * Service for generating membership numbers in internal mode
 * Uses database transactions with SELECT FOR UPDATE to ensure atomic number generation
 */
export class MembershipNumberGenerator {
  /**
   * Generate next membership number for internal mode
   * Uses transaction-based atomic increment with SELECT FOR UPDATE
   * 
   * @param organizationId - The organization ID
   * @param organizationTypeId - The organization type ID
   * @param config - Membership numbering configuration
   * @returns Generated membership number as string
   */
  async generateNumber(
    organizationId: string,
    organizationTypeId: string,
    config: MembershipNumberConfig
  ): Promise<string> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Determine scope for sequence lookup
      // For organization-level uniqueness, use organizationId
      // For organization type-level uniqueness, use null (type-level sequence)
      const scopeOrgId = config.uniqueness === 'organization' 
        ? organizationId 
        : null;
      
      // Get or create sequence record with lock
      // First, try to insert the sequence if it doesn't exist
      await client.query(
        `INSERT INTO membership_number_sequences 
         (organization_type_id, organization_id, next_number)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_type_id, organization_id) DO NOTHING`,
        [organizationTypeId, scopeOrgId, config.initialNumber]
      );
      
      // Then, select the sequence with FOR UPDATE to lock it
      const seqResult = await client.query(
        `SELECT next_number 
         FROM membership_number_sequences
         WHERE organization_type_id = $1 
         AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL))
         FOR UPDATE`,
        [organizationTypeId, scopeOrgId]
      );
      
      const currentNumber = seqResult.rows[0].next_number;
      
      // Increment sequence for next use
      await client.query(
        `UPDATE membership_number_sequences
         SET next_number = next_number + 1, updated_at = NOW()
         WHERE organization_type_id = $1 
         AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL))`,
        [organizationTypeId, scopeOrgId]
      );
      
      await client.query('COMMIT');
      
      logger.info(`Generated membership number: ${currentNumber} for org ${organizationId}`);
      return currentNumber.toString();
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error generating membership number:', error);
      throw error;
    } finally {
      client.release();
    }
  }


    /**
     * Generate membership number with retry logic for deadlock handling
     * Implements exponential backoff: 100ms, 200ms, 400ms
     *
     * @param organizationId - The organization ID
     * @param organizationTypeId - The organization type ID
     * @param config - Membership numbering configuration
     * @param maxRetries - Maximum number of retry attempts (default: 3)
     * @returns Generated membership number as string
     * @throws Error if max retries exceeded or non-deadlock error occurs
     */
    async generateWithRetry(
      organizationId: string,
      organizationTypeId: string,
      config: MembershipNumberConfig,
      maxRetries: number = 3
    ): Promise<string> {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await this.generateNumber(organizationId, organizationTypeId, config);
        } catch (error: any) {
          // Check if this is a PostgreSQL deadlock error (error code 40P01)
          const isDeadlock = error.code === '40P01';
          const isLastAttempt = attempt === maxRetries - 1;

          if (isDeadlock && !isLastAttempt) {
            // Calculate exponential backoff: 100ms, 200ms, 400ms
            const backoffMs = Math.pow(2, attempt) * 100;
            logger.warn(
              `Deadlock detected on attempt ${attempt + 1}/${maxRetries}, retrying after ${backoffMs}ms`
            );

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }

          // If it's the last attempt or not a deadlock, throw the error
          if (isLastAttempt && isDeadlock) {
            logger.error(`Failed to generate membership number after ${maxRetries} attempts due to deadlocks`);
            throw new Error(
              `Failed to generate membership number after ${maxRetries} retry attempts. Please try again.`
            );
          }

          // For non-deadlock errors, throw immediately
          throw error;
        }
      }

      // This should never be reached, but TypeScript requires it
      throw new Error('Unexpected error in generateWithRetry');
    }

}

// Create singleton instance
export const membershipNumberGenerator = new MembershipNumberGenerator();
