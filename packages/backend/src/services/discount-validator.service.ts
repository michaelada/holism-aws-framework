import { db } from '../database/pool';
import { logger } from '../config/logger';
import { Discount, ValidationResult, ValidationError } from '../types/discount.types';

/**
 * Discount Validator Service
 * 
 * Handles all discount validation logic including:
 * - Code validation and lookup
 * - Eligibility checking (membership types, user groups, minimum purchase)
 * - Usage limit enforcement
 * - Validity period checking
 * - Comprehensive discount validation
 */
/**
 * Accept either spelling of the membership-type criterion.
 *
 * The type and this validator call it `membershipTypes`; the events discount
 * form has always written `membershipTypeIds`. Nothing reconciled them, so a
 * discount restricted to certain membership types read as having no restriction
 * at all and applied to everyone.
 *
 * The form now writes the canonical key, but discounts saved before that still
 * carry the old one — so both are read here rather than migrating the stored
 * JSONB, which would have to guess at rows this code has never seen.
 */
function normaliseCriteria(criteria: any): any {
  if (!criteria) return criteria;
  const membershipTypes = criteria.membershipTypes ?? criteria.membershipTypeIds;
  return membershipTypes ? { ...criteria, membershipTypes } : criteria;
}

export class DiscountValidatorService {
  /**
   * Look up discount by code within an organization
   */
  async validateCode(code: string, organisationId: string): Promise<Discount | null> {
    try {
      const result = await db.query(
        `SELECT 
          id, organisation_id as "organisationId", module_type as "moduleType",
          name, description, code,
          discount_type as "discountType", discount_value as "discountValue",
          application_scope as "applicationScope", quantity_rules as "quantityRules",
          eligibility_criteria as "eligibilityCriteria",
          valid_from as "validFrom", valid_until as "validUntil",
          usage_limits as "usageLimits",
          combinable, priority, status,
          created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"
        FROM discounts
        WHERE code = $1 AND organisation_id = $2 AND status = 'active'`,
        [code, organisationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error validating discount code:', error);
      throw error;
    }
  }

  /**
   * Check if user meets eligibility criteria
   */
  async validateEligibility(
    discount: Discount,
    userId: string,
    amount: number
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!discount.eligibilityCriteria) {
      return { valid: true, errors: [] };
    }

    const criteria = normaliseCriteria(discount.eligibilityCriteria);

    // Check minimum purchase amount
    if (criteria.minimumPurchaseAmount && amount < criteria.minimumPurchaseAmount) {
      errors.push({
        code: 'MINIMUM_PURCHASE_NOT_MET',
        message: `Minimum purchase amount of ${criteria.minimumPurchaseAmount} not met`,
        field: 'amount',
      });
    }

    // Check membership types (if specified)
    if (criteria.membershipTypes && criteria.membershipTypes.length > 0) {
      try {
        const membershipResult = await db.query(
          // `members`, not `memberships` — there is no such table, and this
          // query previously always threw, so membership-based discount
          // eligibility could never be satisfied. The columns match exactly.
          `SELECT membership_type_id
          FROM members
          WHERE user_id = $1 AND status = 'active'
          AND membership_type_id = ANY($2::uuid[])`,
          [userId, criteria.membershipTypes]
        );

        if (membershipResult.rows.length === 0) {
          errors.push({
            code: 'MEMBERSHIP_TYPE_NOT_MET',
            message: 'User does not have required membership type',
            field: 'membershipType',
          });
        }
      } catch (error) {
        logger.error('Error checking membership eligibility:', error);
        errors.push({
          code: 'ELIGIBILITY_CHECK_FAILED',
          message: 'Failed to verify membership eligibility',
        });
      }
    }

    // Check user groups (if specified)
    if (criteria.userGroups && criteria.userGroups.length > 0) {
      try {
        const groupResult = await db.query(
          `SELECT user_group_id
          FROM user_group_members
          WHERE user_id = $1 AND user_group_id = ANY($2::uuid[])`,
          [userId, criteria.userGroups]
        );

        if (groupResult.rows.length === 0) {
          errors.push({
            code: 'USER_GROUP_NOT_MET',
            message: 'User is not in required user group',
            field: 'userGroup',
          });
        }
      } catch (error) {
        // Fails closed, matching the membership check above. This previously
        // swallowed the error and granted eligibility, because the
        // user_group_members table did not exist. It does now, so a failure
        // here is a real fault — and a discount that silently applies to
        // everyone when a query breaks is worse than one that refuses.
        logger.error('Error checking user group eligibility:', error);
        errors.push({
          code: 'ELIGIBILITY_CHECK_FAILED',
          message: 'Failed to verify user group eligibility',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if usage limits have been reached
   */
  async validateUsageLimits(
    discount: Discount,
    userId: string
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!discount.usageLimits) {
      return { valid: true, errors: [] };
    }

    const limits = discount.usageLimits;

    // Check total usage limit
    if (limits.totalUsageLimit !== undefined) {
      const currentCount = limits.currentUsageCount || 0;
      if (currentCount >= limits.totalUsageLimit) {
        errors.push({
          code: 'USAGE_LIMIT_REACHED',
          message: 'Discount usage limit has been reached',
        });
      }
    }

    // Check per-user usage limit
    if (limits.perUserLimit !== undefined) {
      try {
        const userUsageResult = await db.query(
          `SELECT COUNT(*) as count
          FROM discount_usage
          WHERE discount_id = $1 AND user_id = $2`,
          [discount.id, userId]
        );

        const userUsageCount = parseInt(userUsageResult.rows[0].count, 10);
        if (userUsageCount >= limits.perUserLimit) {
          errors.push({
            code: 'USER_USAGE_LIMIT_REACHED',
            message: 'You have reached the usage limit for this discount',
          });
        }
      } catch (error) {
        logger.error('Error checking user usage limit:', error);
        throw error;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if discount is within validity period
   */
  async validateValidity(discount: Discount): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const now = new Date();

    // Check if discount is active
    if (discount.status !== 'active') {
      errors.push({
        code: 'DISCOUNT_INACTIVE',
        message: 'Discount is not active',
        field: 'status',
      });
    }

    // Check valid_from date
    if (discount.validFrom && new Date(discount.validFrom) > now) {
      errors.push({
        code: 'DISCOUNT_NOT_YET_VALID',
        message: 'Discount is not yet valid',
        field: 'validFrom',
      });
    }

    // Check valid_until date
    if (discount.validUntil && new Date(discount.validUntil) < now) {
      errors.push({
        code: 'DISCOUNT_EXPIRED',
        message: 'Discount has expired',
        field: 'validUntil',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Comprehensive discount validation
   * Checks all validation rules in sequence
   */
  async validateDiscount(
    discount: Discount,
    userId: string,
    amount: number,
    quantity: number
  ): Promise<ValidationResult> {
    const allErrors: ValidationError[] = [];

    // 1. Check validity period and status
    const validityResult = await this.validateValidity(discount);
    allErrors.push(...validityResult.errors);

    // If not valid, no need to check further
    if (!validityResult.valid) {
      return {
        valid: false,
        errors: allErrors,
      };
    }

    // 2. Check usage limits
    const usageResult = await this.validateUsageLimits(discount, userId);
    allErrors.push(...usageResult.errors);

    // 3. Check eligibility criteria
    const eligibilityResult = await this.validateEligibility(discount, userId, amount);
    allErrors.push(...eligibilityResult.errors);

    // 4. Check quantity rules (if quantity-based)
    if (discount.applicationScope === 'quantity-based' && discount.quantityRules) {
      if (quantity < discount.quantityRules.minimumQuantity) {
        allErrors.push({
          code: 'MINIMUM_QUANTITY_NOT_MET',
          message: `Minimum quantity of ${discount.quantityRules.minimumQuantity} not met`,
          field: 'quantity',
        });
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
    };
  }
}

export const discountValidatorService = new DiscountValidatorService();
