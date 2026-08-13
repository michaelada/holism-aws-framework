/* eslint-disable camelcase */

/**
 * A configurable Stripe Connect application fee per organisation type.
 *
 * ### Why this is not the handling fee
 *
 * They are two different amounts that happened to be equal:
 *
 *   - **The handling fee** is *added* to what the member pays. It is the
 *     surcharge shown on the basket, and it is what makes the member's total
 *     larger than the item price.
 *   - **The application fee** is taken *out* of the charge by Stripe Connect. It
 *     does not change what the member pays at all — it decides how the money
 *     already collected is split between the platform and the club.
 *
 * Until now the checkout set `application_fee_amount` to the whole handling
 * fee, so the platform took exactly the surcharge and the club received the
 * item price. That is a reasonable default but it is only one commercial
 * arrangement, and it cannot express "charge the member 1.5% but take 2% of
 * the sale", or the reverse.
 *
 * ### Why nullable rather than `DEFAULT 0`
 *
 * This is the important part. A `NOT NULL DEFAULT 0` column would mean every
 * existing organisation type silently switched to an application fee of zero —
 * the platform would take nothing, and the handling fee it had been collecting
 * would start settling into the clubs' balances. A revenue change, applied
 * retroactively, with no visible cause.
 *
 * So both columns are nullable and **NULL means "same as the handling fee"** —
 * exactly today's behaviour. A super admin opts in to a different arrangement
 * by setting them, and until then nothing moves.
 */

exports.up = (pgm) => {
  pgm.addColumns('organization_type_payment_fees', {
    /**
     * Fixed element of the platform's cut, in the organisation type's currency.
     * NULL means "not configured" — see the note above.
     */
    application_fee_fixed: {
      type: 'decimal(10,2)',
    },
    /**
     * Percentage element, applied to the value of the items sold — **not** to
     * the handling fee. Charging a percentage of our own surcharge would
     * compound it, and the platform's commission is on what the club sold.
     */
    application_fee_percentage: {
      type: 'decimal(5,2)',
    },
  });

  pgm.addConstraint(
    'organization_type_payment_fees',
    'organization_type_payment_fees_application_fee_non_negative',
    {
      check:
        '(application_fee_fixed IS NULL OR application_fee_fixed >= 0) AND ' +
        '(application_fee_percentage IS NULL OR application_fee_percentage >= 0)',
    }
  );

  /*
   * Both or neither. A half-configured pair reads as "0% plus a fixed 50c" when
   * what was meant was "I only filled in one box", and the difference is the
   * platform's revenue — so the database refuses the ambiguous state rather
   * than guessing which was intended.
   */
  pgm.addConstraint(
    'organization_type_payment_fees',
    'organization_type_payment_fees_application_fee_complete',
    {
      check:
        '(application_fee_fixed IS NULL AND application_fee_percentage IS NULL) OR ' +
        '(application_fee_fixed IS NOT NULL AND application_fee_percentage IS NOT NULL)',
    }
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint(
    'organization_type_payment_fees',
    'organization_type_payment_fees_application_fee_complete'
  );
  pgm.dropConstraint(
    'organization_type_payment_fees',
    'organization_type_payment_fees_application_fee_non_negative'
  );
  pgm.dropColumns('organization_type_payment_fees', [
    'application_fee_fixed',
    'application_fee_percentage',
  ]);
};
