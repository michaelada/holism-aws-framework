/* eslint-disable camelcase */

/**
 * A per-organisation Stripe Connect application fee, copied from the type.
 *
 * ### What moves and what does not
 *
 * Only the **application fee** — the split between the platform and the club —
 * becomes per-organisation. The three handling-fee elements (`fixed_fee`,
 * `percentage_fee`, `tax_percentage`) stay on `organization_type_payment_fees`
 * and nowhere else, because those decide what the *member* is charged. Letting
 * member-facing pricing vary club by club is a different decision entirely and
 * is deliberately not made here.
 *
 * ### Copy-on-create, not live inheritance
 *
 * The type's value is a template for new organisations. Editing a type does
 * **not** re-price the organisations already under it — each carries its own
 * row from the moment it is created. The alternative, where a type edit flows
 * through to every organisation, would let one form submission move revenue on
 * every club of that type; this is money already quoted to clubs commercially.
 *
 * ### Why the backfill is not optional
 *
 * Copy-on-create only describes organisations created from now on. Every
 * organisation that already exists resolves its fee through its type today, so
 * the migration copies each type's current value onto each of its organisations.
 * Without that step, either every existing club reverts to "take the whole
 * handling fee" (a silent revenue change in the platform's favour) or the
 * resolution has to keep reading the type forever, which is the live model we
 * rejected. The copy is faithful, NULLs included — see below.
 *
 * ### NULL still means "take the handling fee"
 *
 * Unchanged from migration 1709000000012. Both columns are nullable and a
 * NULL pair means the platform takes the whole handling fee, which is the
 * arrangement in force before any of this was configurable. Copying a NULL pair
 * onto an organisation therefore preserves its behaviour exactly.
 */

exports.up = (pgm) => {
  pgm.createTable('organization_payment_application_fees', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations',
      onDelete: 'CASCADE',
    },
    payment_method_id: {
      type: 'uuid',
      notNull: true,
      references: 'payment_methods',
      onDelete: 'CASCADE',
    },
    /**
     * Fixed element of the platform's cut, in the organisation's currency
     * (which is its type's — the two cannot diverge). NULL = not configured.
     */
    application_fee_fixed: {
      type: 'decimal(10,2)',
    },
    /**
     * Percentage element, applied to the value of the items sold — not to the
     * handling fee. A percentage of our own surcharge would compound it.
     */
    application_fee_percentage: {
      type: 'decimal(5,2)',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint(
    'organization_payment_application_fees',
    'org_payment_application_fees_unique',
    { unique: ['organization_id', 'payment_method_id'] }
  );

  pgm.addConstraint(
    'organization_payment_application_fees',
    'org_payment_application_fees_non_negative',
    {
      check:
        '(application_fee_fixed IS NULL OR application_fee_fixed >= 0) AND ' +
        '(application_fee_percentage IS NULL OR application_fee_percentage >= 0)',
    }
  );

  /*
   * Both or neither, exactly as on the type table. A half-configured pair reads
   * as "0% plus a fixed 50c" when what was meant was "I only filled in one
   * box", and the difference is the platform's revenue on every sale.
   */
  pgm.addConstraint(
    'organization_payment_application_fees',
    'org_payment_application_fees_complete',
    {
      check:
        '(application_fee_fixed IS NULL AND application_fee_percentage IS NULL) OR ' +
        '(application_fee_fixed IS NOT NULL AND application_fee_percentage IS NOT NULL)',
    }
  );

  pgm.createIndex('organization_payment_application_fees', 'organization_id');

  /*
   * The backfill. One row per (organisation, payment method) that the
   * organisation's type already has a fee row for, carrying that row's
   * application fee verbatim — NULLs included, so an unconfigured type yields
   * unconfigured organisations and nothing about their behaviour changes.
   */
  pgm.sql(`
    INSERT INTO organization_payment_application_fees
      (organization_id, payment_method_id, application_fee_fixed, application_fee_percentage)
    SELECT o.id,
           f.payment_method_id,
           f.application_fee_fixed,
           f.application_fee_percentage
    FROM organizations o
    JOIN organization_type_payment_fees f
      ON f.organization_type_id = o.organization_type_id
    ON CONFLICT ON CONSTRAINT org_payment_application_fees_unique DO NOTHING
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('organization_payment_application_fees');
};
