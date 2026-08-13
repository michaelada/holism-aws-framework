import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError } from '../middleware/errors';
import { HandlingFeeConfig } from '../utils/handling-fee';
import { isCardPaymentMethod } from '../utils/payment-method';

/**
 * Card handling fees, configured by the super admin on an organisation type
 * and inherited by every organisation of that type.
 *
 * There is deliberately no per-organisation override: the fixed element is a
 * cash amount in the organisation type's currency, so letting an individual
 * organisation diverge would mean tracking which currency each rate is
 * expressed in. See docs/ACCOUNT_USER_APP_WIREFRAMES.md G5 and G12.
 */

/** Rates as stored and edited — major units, percentages as written. */
export interface PaymentFeeRates {
  fixedFee: number;
  percentageFee: number;
  taxPercentage: number;
}

/**
 * The platform's Connect cut for this organisation type and payment method.
 *
 * Both null means "not configured", which the checkout reads as "take the
 * handling fee" — the arrangement in force before this was configurable. The
 * database enforces that they are set together, because one filled box and one
 * empty one reads as a deliberate 0% when it is almost certainly an unfinished
 * form, and the difference is the platform's revenue.
 */
export interface ApplicationFeeRates {
  applicationFeeFixed: number | null;
  applicationFeePercentage: number | null;
}

export interface OrganizationTypePaymentFee extends PaymentFeeRates, ApplicationFeeRates {
  id: string;
  organizationTypeId: string;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodDisplayName: string;
  /** The currency the fixed element is expressed in. */
  currency: string;
}

export interface CardPaymentMethodDefault extends PaymentFeeRates {
  paymentMethodId: string;
  name: string;
  displayName: string;
}

const RATE_FIELDS: Array<keyof PaymentFeeRates> = [
  'fixedFee',
  'percentageFee',
  'taxPercentage',
];

/**
 * Validate a set of rates.
 *
 * A tax percentage of exactly 0 is valid and expected — it is how an
 * organisation type says "no tax element" — so this must not treat zero as
 * missing.
 */
export function validateRates(
  // Values arrive from JSON, so a numeric field may turn up as a string or as
  // an empty string from a cleared form input.
  rates: Partial<Record<keyof PaymentFeeRates, unknown>>
): PaymentFeeRates {
  const out = {} as PaymentFeeRates;

  RATE_FIELDS.forEach((field) => {
    const value = rates[field];
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`${field} is required`);
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new ValidationError(`${field} must be a number`);
    }
    if (num < 0) {
      throw new ValidationError(`${field} cannot be negative`);
    }
    if (field !== 'fixedFee' && num > 100) {
      throw new ValidationError(`${field} cannot exceed 100%`);
    }
    out[field] = num;
  });

  return out;
}

/**
 * Validate the optional application-fee pair.
 *
 * Absent is legitimate and means "not configured" — the checkout then takes the
 * handling fee, as it did before this was configurable. Only a **half**-filled
 * pair is rejected: one box completed and the other left blank reads as a
 * deliberate 0% when it is almost certainly an unfinished form, and the
 * difference is the platform's revenue on every sale.
 */
export function validateApplicationFeeRates(
  rates: Partial<Record<keyof ApplicationFeeRates, unknown>>
): ApplicationFeeRates {
  const blank = (value: unknown) => value === undefined || value === null || value === '';

  const fixedBlank = blank(rates.applicationFeeFixed);
  const percentageBlank = blank(rates.applicationFeePercentage);

  if (fixedBlank && percentageBlank) {
    return { applicationFeeFixed: null, applicationFeePercentage: null };
  }
  if (fixedBlank !== percentageBlank) {
    throw new ValidationError(
      'Set both the application fee amount and percentage, or neither'
    );
  }

  const out: ApplicationFeeRates = {
    applicationFeeFixed: Number(rates.applicationFeeFixed),
    applicationFeePercentage: Number(rates.applicationFeePercentage),
  };

  if (!Number.isFinite(out.applicationFeeFixed!) || out.applicationFeeFixed! < 0) {
    throw new ValidationError('applicationFeeFixed must be a number of at least 0');
  }
  if (
    !Number.isFinite(out.applicationFeePercentage!) ||
    out.applicationFeePercentage! < 0 ||
    out.applicationFeePercentage! > 100
  ) {
    throw new ValidationError('applicationFeePercentage must be between 0 and 100');
  }

  return out;
}

/** Convert a stored major-unit amount to the integer minor units the cart uses. */
function toMinorUnits(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

export class OrganizationTypePaymentFeeService {
  private rowToFee(row: any): OrganizationTypePaymentFee {
    return {
      id: row.id,
      organizationTypeId: row.organization_type_id,
      paymentMethodId: row.payment_method_id,
      paymentMethodName: row.payment_method_name,
      paymentMethodDisplayName: row.payment_method_display_name,
      currency: row.currency,
      fixedFee: Number(row.fixed_fee),
      percentageFee: Number(row.percentage_fee),
      taxPercentage: Number(row.tax_percentage),
      /*
       * Null is meaningful here and must survive: it says "not configured",
       * which the checkout reads as "take the handling fee". Coercing it to 0
       * with `Number(null)` would silently set the platform's cut to nothing.
       */
      applicationFeeFixed:
        row.application_fee_fixed === null || row.application_fee_fixed === undefined
          ? null
          : Number(row.application_fee_fixed),
      applicationFeePercentage:
        row.application_fee_percentage === null || row.application_fee_percentage === undefined
          ? null
          : Number(row.application_fee_percentage),
    };
  }

  /**
   * Every card method available on the platform, with this organisation type's
   * rates where set and the platform defaults where not.
   *
   * Returns a row per card method rather than only the configured ones, so the
   * admin form can render a complete set of cards without merging two lists.
   */
  async getFeesForOrganizationType(
    organizationTypeId: string
  ): Promise<OrganizationTypePaymentFee[]> {
    const result = await db.query(
      `SELECT
         pm.id                       AS payment_method_id,
         pm.name                     AS payment_method_name,
         pm.display_name             AS payment_method_display_name,
         pm.default_fee_config,
         f.id,
         f.organization_type_id,
         f.fixed_fee,
         f.percentage_fee,
         f.tax_percentage,
         f.application_fee_fixed,
         f.application_fee_percentage,
         ot.currency
       FROM payment_methods pm
       CROSS JOIN organization_types ot
       LEFT JOIN organization_type_payment_fees f
         ON f.payment_method_id = pm.id AND f.organization_type_id = ot.id
       WHERE ot.id = $1 AND pm.is_active = true
       ORDER BY pm.display_name`,
      [organizationTypeId]
    );

    return result.rows
      .filter((row: any) => isCardPaymentMethod(row.payment_method_name))
      .map((row: any) => {
        const defaults = row.default_fee_config || {};
        return this.rowToFee({
          ...row,
          organization_type_id: row.organization_type_id || organizationTypeId,
          // The application fee has no default: an unconfigured one means
          // "take the handling fee", which is not something a payment method
          // can supply a sensible starting value for.
          fixed_fee: row.fixed_fee ?? defaults.fixedFee ?? 0,
          percentage_fee: row.percentage_fee ?? defaults.percentageFee ?? 0,
          tax_percentage: row.tax_percentage ?? defaults.taxPercentage ?? 0,
        });
      });
  }

  /**
   * The platform's starting values, used to pre-fill the create form.
   *
   * These live on payment_methods rather than in the admin front end so a
   * super admin can follow a provider's published rate change without a
   * release.
   */
  async getCardMethodDefaults(): Promise<CardPaymentMethodDefault[]> {
    const result = await db.query(
      `SELECT id, name, display_name, default_fee_config
       FROM payment_methods
       WHERE is_active = true
       ORDER BY display_name`
    );

    return result.rows
      .filter((row: any) => isCardPaymentMethod(row.name))
      .map((row: any) => {
        const config = row.default_fee_config || {};
        return {
          paymentMethodId: row.id,
          name: row.name,
          displayName: row.display_name,
          fixedFee: Number(config.fixedFee ?? 0),
          percentageFee: Number(config.percentageFee ?? 0),
          taxPercentage: Number(config.taxPercentage ?? 0),
        };
      });
  }

  /**
   * Set the rates for one organisation type.
   *
   * Upserts rather than replacing wholesale: a method omitted from `entries`
   * keeps whatever it had, so a partial save cannot silently zero a rate that
   * the form did not happen to render.
   */
  async setFees(
    organizationTypeId: string,
    entries: Array<
      { paymentMethodId: string } & Partial<PaymentFeeRates> & Partial<ApplicationFeeRates>
    >
  ): Promise<OrganizationTypePaymentFee[]> {
    const cardMethods = await this.getCardMethodDefaults();
    const cardIds = new Set(cardMethods.map((m) => m.paymentMethodId));

    for (const entry of entries) {
      if (!cardIds.has(entry.paymentMethodId)) {
        // Pay Offline never carries a handling fee, and an unknown id is a
        // client bug worth surfacing rather than storing.
        throw new ValidationError(
          `Payment method ${entry.paymentMethodId} does not take a handling fee`
        );
      }
      const rates = { ...validateRates(entry), ...validateApplicationFeeRates(entry) };

      await db.query(
        `INSERT INTO organization_type_payment_fees
           (organization_type_id, payment_method_id, fixed_fee, percentage_fee, tax_percentage,
            application_fee_fixed, application_fee_percentage)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT ON CONSTRAINT org_type_payment_fees_unique
         DO UPDATE SET
           fixed_fee = EXCLUDED.fixed_fee,
           application_fee_fixed = EXCLUDED.application_fee_fixed,
           application_fee_percentage = EXCLUDED.application_fee_percentage,
           percentage_fee = EXCLUDED.percentage_fee,
           tax_percentage = EXCLUDED.tax_percentage,
           updated_at = NOW()`,
        [
          organizationTypeId,
          entry.paymentMethodId,
          rates.fixedFee,
          rates.percentageFee,
          rates.taxPercentage,
          rates.applicationFeeFixed ?? null,
          rates.applicationFeePercentage ?? null,
        ]
      );
    }

    logger.info(
      `Handling fees updated for organisation type ${organizationTypeId} ` +
        `(${entries.length} method(s))`
    );
    return this.getFeesForOrganizationType(organizationTypeId);
  }

  /**
   * The rates an organisation actually charges, keyed by payment method id and
   * expressed in minor units — the shape the cart calculator consumes.
   *
   * A method with no row resolves to no fee rather than an error: an
   * organisation type whose fees were never set simply charges nothing.
   */
  async resolveForOrganisation(
    organisationId: string
  ): Promise<Map<string, HandlingFeeConfig>> {
    const result = await db.query(
      `SELECT f.payment_method_id, f.fixed_fee, f.percentage_fee, f.tax_percentage,
              f.application_fee_fixed, f.application_fee_percentage
       FROM organizations o
       JOIN organization_type_payment_fees f
         ON f.organization_type_id = o.organization_type_id
       WHERE o.id = $1`,
      [organisationId]
    );

    const configs = new Map<string, HandlingFeeConfig>();
    result.rows.forEach((row: any) => {
      configs.set(row.payment_method_id, {
        fixedFee: toMinorUnits(row.fixed_fee),
        percentageFee: Number(row.percentage_fee),
        taxPercentage: Number(row.tax_percentage),
      });
    });
    return configs;
  }

  /**
   * How many organisations a rate change would affect.
   *
   * Editing an organisation type's fees changes what every one of its
   * organisations charges from the moment it is saved, so the admin screen
   * says so before saving.
   */
  async countOrganisationsOfType(organizationTypeId: string): Promise<number> {
    const result = await db.query(
      'SELECT COUNT(*)::int AS count FROM organizations WHERE organization_type_id = $1',
      [organizationTypeId]
    );
    return result.rows[0]?.count ?? 0;
  }
}

export const organizationTypePaymentFeeService =
  new OrganizationTypePaymentFeeService();
