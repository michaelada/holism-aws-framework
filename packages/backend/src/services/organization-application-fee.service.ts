import { db } from '../database/pool';
import { logger } from '../config/logger';
import {
  ApplicationFeeRates,
  validateApplicationFeeRates,
} from './organization-type-payment-fee.service';

/**
 * The Stripe Connect application fee, per organisation and payment method.
 *
 * ### What this owns, and what it does not
 *
 * Only the **application fee** — how a card payment is split between the
 * platform and the club. The three handling-fee elements stay on
 * `organization_type_payment_fees` and are configured per organisation type
 * only, because those decide what the *member* pays. Nothing here reads or
 * writes them.
 *
 * ### Copy-on-create, not live inheritance
 *
 * An organisation receives a copy of its type's application fee when it is
 * created, and from that moment the two are independent. Editing the type does
 * not reach back into organisations that already exist — see
 * docs/ORGANISATION_APPLICATION_FEE.md §1.3 for why that model was chosen over
 * the live one.
 */

export interface OrganisationApplicationFee extends ApplicationFeeRates {
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodDisplayName: string;
  /**
   * The type's current value for the same method, carried alongside so the UI
   * can show what this organisation started from and whether it has diverged.
   */
  typeDefaultFixed: number | null;
  typeDefaultPercentage: number | null;
  /**
   * `organisation` when the organisation has its own row; `type-fallback` when
   * it does not and the type's value is standing in. See §2.2 of the design.
   */
  source: 'organisation' | 'type-fallback';
}

export interface OrganisationApplicationFees {
  organisationId: string;
  organisationTypeId: string;
  organisationTypeName: string;
  currency: string;
  fees: OrganisationApplicationFee[];
}

const toNumber = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

class OrganizationApplicationFeeService {
  /**
   * Every card payment method the organisation's type carries fees for, with
   * the organisation's own value where it has one and the type's where it does
   * not.
   *
   * Driven from the **type's** fee rows rather than the organisation's, so a
   * method configured on the type always appears — including one added after
   * the organisation was created, which is precisely the case that has no
   * organisation row yet.
   */
  async getForOrganisation(organisationId: string): Promise<OrganisationApplicationFees | null> {
    const org = await db.query(
      `SELECT o.id, o.organization_type_id, o.currency, t.display_name AS type_name
       FROM organizations o
       JOIN organization_types t ON t.id = o.organization_type_id
       WHERE o.id = $1`,
      [organisationId]
    );

    if (!org.rows[0]) return null;

    const result = await db.query(
      `SELECT pm.id                          AS payment_method_id,
              pm.name                        AS payment_method_name,
              pm.display_name                AS payment_method_display_name,
              tf.application_fee_fixed       AS type_fixed,
              tf.application_fee_percentage  AS type_percentage,
              of.application_fee_fixed       AS org_fixed,
              of.application_fee_percentage  AS org_percentage,
              (of.id IS NOT NULL)            AS has_org_row
       FROM organization_type_payment_fees tf
       JOIN payment_methods pm ON pm.id = tf.payment_method_id
       LEFT JOIN organization_payment_application_fees of
         ON of.organization_id = $1 AND of.payment_method_id = tf.payment_method_id
       WHERE tf.organization_type_id = $2
       ORDER BY pm.display_name`,
      [organisationId, org.rows[0].organization_type_id]
    );

    return {
      organisationId,
      organisationTypeId: org.rows[0].organization_type_id,
      organisationTypeName: org.rows[0].type_name,
      currency: org.rows[0].currency,
      fees: result.rows.map((row) => ({
        paymentMethodId: row.payment_method_id,
        paymentMethodName: row.payment_method_name,
        paymentMethodDisplayName: row.payment_method_display_name,
        applicationFeeFixed: row.has_org_row ? toNumber(row.org_fixed) : toNumber(row.type_fixed),
        applicationFeePercentage: row.has_org_row
          ? toNumber(row.org_percentage)
          : toNumber(row.type_percentage),
        typeDefaultFixed: toNumber(row.type_fixed),
        typeDefaultPercentage: toNumber(row.type_percentage),
        source: row.has_org_row ? 'organisation' : 'type-fallback',
      })),
    };
  }

  /**
   * Replace the organisation's application fees.
   *
   * Every entry is validated before anything is written, and the writes share
   * one transaction: a half-applied save would leave one payment method on the
   * new split and another on the old, which is worse than the save failing.
   */
  async setForOrganisation(
    organisationId: string,
    entries: Array<{ paymentMethodId: string } & Partial<Record<keyof ApplicationFeeRates, unknown>>>
  ): Promise<OrganisationApplicationFees | null> {
    // Validate the whole payload first — `validateApplicationFeeRates` throws
    // on a half-filled pair, and it should do so before any row is touched.
    const validated = entries.map((entry) => ({
      paymentMethodId: entry.paymentMethodId,
      ...validateApplicationFeeRates(entry),
    }));

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      for (const entry of validated) {
        await client.query(
          `INSERT INTO organization_payment_application_fees
             (organization_id, payment_method_id, application_fee_fixed, application_fee_percentage)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ON CONSTRAINT org_payment_application_fees_unique
           DO UPDATE SET application_fee_fixed = EXCLUDED.application_fee_fixed,
                         application_fee_percentage = EXCLUDED.application_fee_percentage,
                         updated_at = CURRENT_TIMESTAMP`,
          [
            organisationId,
            entry.paymentMethodId,
            entry.applicationFeeFixed,
            entry.applicationFeePercentage,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getForOrganisation(organisationId);
  }

  /**
   * Copy the type's application fees onto a newly created organisation.
   *
   * `DO NOTHING` on conflict rather than overwriting: if a row somehow already
   * exists for this organisation it was set deliberately, and a creation-time
   * copy must never be the thing that overwrites a deliberate value.
   *
   * NULLs are copied as NULLs. An unconfigured type yields an unconfigured
   * organisation, which the checkout reads as "take the handling fee" — exactly
   * what that organisation would have done before this table existed.
   */
  async copyFromType(organisationId: string, organisationTypeId: string): Promise<number> {
    const result = await db.query(
      `INSERT INTO organization_payment_application_fees
         (organization_id, payment_method_id, application_fee_fixed, application_fee_percentage)
       SELECT $1, tf.payment_method_id, tf.application_fee_fixed, tf.application_fee_percentage
       FROM organization_type_payment_fees tf
       WHERE tf.organization_type_id = $2
       ON CONFLICT ON CONSTRAINT org_payment_application_fees_unique DO NOTHING`,
      [organisationId, organisationTypeId]
    );

    logger.info(
      `Copied ${result.rowCount} application fee row(s) from type ${organisationTypeId} ` +
        `to organisation ${organisationId}`
    );
    return result.rowCount ?? 0;
  }

  /**
   * Re-copy one payment method's value from the type, discarding the
   * organisation's own.
   *
   * Explicit and per-organisation, which is why it does not contradict
   * copy-on-create: an operator asked for this organisation to be brought back
   * in line, rather than a type edit reaching out to touch it.
   */
  async resetToTypeDefault(
    organisationId: string,
    paymentMethodId: string
  ): Promise<OrganisationApplicationFees | null> {
    await db.query(
      `INSERT INTO organization_payment_application_fees
         (organization_id, payment_method_id, application_fee_fixed, application_fee_percentage)
       SELECT o.id, tf.payment_method_id, tf.application_fee_fixed, tf.application_fee_percentage
       FROM organizations o
       JOIN organization_type_payment_fees tf
         ON tf.organization_type_id = o.organization_type_id
       WHERE o.id = $1 AND tf.payment_method_id = $2
       ON CONFLICT ON CONSTRAINT org_payment_application_fees_unique
       DO UPDATE SET application_fee_fixed = EXCLUDED.application_fee_fixed,
                     application_fee_percentage = EXCLUDED.application_fee_percentage,
                     updated_at = CURRENT_TIMESTAMP`,
      [organisationId, paymentMethodId]
    );

    return this.getForOrganisation(organisationId);
  }
}

export const organizationApplicationFeeService = new OrganizationApplicationFeeService();
