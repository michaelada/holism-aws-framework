import { db } from '../database/pool';
import { logger } from '../config/logger';
import { MembershipNumberUniqueness } from '../types/organization.types';

/**
 * Validation result for membership number uniqueness checks
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Service for validating membership number uniqueness in external mode
 * Checks if a membership number already exists within the configured scope
 */
export class MembershipNumberValidator {
  /**
   * Validate membership number uniqueness for external mode
   * 
   * @param membershipNumber - The membership number to validate
   * @param organizationId - The organization ID
   * @param organizationTypeId - The organization type ID
   * @param uniqueness - The uniqueness scope (organization or organization_type)
   * @returns Validation result with valid boolean and optional error message
   */
  async validateUniqueness(
    membershipNumber: string,
    organizationId: string,
    organizationTypeId: string,
    uniqueness: MembershipNumberUniqueness
  ): Promise<ValidationResult> {
    try {
      let query: string;
      let params: any[];
      
      if (uniqueness === 'organization') {
        // Check uniqueness within organization
        query = `
          SELECT COUNT(*) as count 
          FROM members 
          WHERE membership_number = $1 
          AND organisation_id = $2
        `;
        params = [membershipNumber, organizationId];
      } else {
        // Check uniqueness across organization type
        query = `
          SELECT COUNT(*) as count 
          FROM members m
          JOIN organizations o ON m.organisation_id = o.id
          WHERE m.membership_number = $1 
          AND o.organization_type_id = $2
        `;
        params = [membershipNumber, organizationTypeId];
      }
      
      const result = await db.query(query, params);
      const count = parseInt(result.rows[0].count);
      
      if (count > 0) {
        const scope = uniqueness === 'organization' 
          ? 'this organization' 
          : 'this organization type';
        
        logger.warn(
          `Membership number ${membershipNumber} already exists in ${scope} (org: ${organizationId}, type: ${organizationTypeId})`
        );
        
        return {
          valid: false,
          error: `Membership number ${membershipNumber} already exists in ${scope}`
        };
      }
      
      logger.info(
        `Membership number ${membershipNumber} is unique in ${uniqueness} scope (org: ${organizationId})`
      );
      
      return { valid: true };
    } catch (error) {
      logger.error('Error validating membership number uniqueness:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const membershipNumberValidator = new MembershipNumberValidator();
