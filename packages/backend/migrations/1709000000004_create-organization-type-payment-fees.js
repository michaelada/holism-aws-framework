/**
 * Migration: Card handling fees per organisation type
 *
 * A card payment carries a handling fee made of three parts: a fixed amount, a
 * percentage of the amount being charged to the card, and a tax percentage
 * applied to that fee. The super admin configures them on the organisation
 * type, and every organisation of that type inherits them — there is no
 * per-organisation override.
 *
 * Two pieces:
 *
 *   payment_methods.default_fee_config   Platform-wide starting values, used to
 *                                        pre-fill the create-organisation-type
 *                                        form. Kept in the database rather than
 *                                        the admin front end so a super admin
 *                                        can follow a provider's published rate
 *                                        change without a release.
 *
 *   organization_type_payment_fees       The rates actually in force, one row
 *                                        per (organisation type, card method).
 *                                        A table rather than JSONB because it is
 *                                        read on every cart load and a new
 *                                        provider must not need a schema change.
 *
 * Only card methods get a row. Pay Offline never carries a handling fee.
 */

exports.shorthands = undefined;

// Published card rates at the time of writing, as a starting point only — the
// super admin is expected to set the real commercial terms per organisation
// type. Tax defaults to 0 deliberately: it varies by jurisdiction, and a wrong
// non-zero default would silently overcharge every member. Zero is also the
// documented way to say "no tax element".
const DEFAULTS = {
  stripe: { fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 0 },
  'helix-pay': { fixedFee: 0.2, percentageFee: 1.75, taxPercentage: 0 },
};

exports.up = (pgm) => {
  pgm.addColumns('payment_methods', {
    default_fee_config: { type: 'jsonb', notNull: true, default: '{}' },
  });

  Object.entries(DEFAULTS).forEach(([name, config]) => {
    pgm.sql(`
      UPDATE payment_methods
      SET default_fee_config = '${JSON.stringify(config)}'::jsonb
      WHERE name = '${name}'
    `);
  });

  pgm.createTable('organization_type_payment_fees', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_types(id)',
      onDelete: 'CASCADE',
    },
    payment_method_id: {
      type: 'uuid',
      notNull: true,
      references: 'payment_methods(id)',
      onDelete: 'CASCADE',
    },
    // A currency amount, in the organisation type's currency.
    fixed_fee: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 0,
    },
    // 1.500 means 1.5%.
    percentage_fee: {
      type: 'decimal(6,3)',
      notNull: true,
      default: 0,
    },
    // Applied to the handling fee, not to the order. 0 means no tax element.
    tax_percentage: {
      type: 'decimal(6,3)',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.addConstraint(
    'organization_type_payment_fees',
    'org_type_payment_fees_unique',
    { unique: ['organization_type_id', 'payment_method_id'] }
  );

  pgm.addConstraint(
    'organization_type_payment_fees',
    'org_type_payment_fees_ranges',
    {
      check:
        'fixed_fee >= 0 ' +
        'AND percentage_fee >= 0 AND percentage_fee <= 100 ' +
        'AND tax_percentage >= 0 AND tax_percentage <= 100',
    }
  );

  pgm.createIndex('organization_type_payment_fees', 'organization_type_id');

  // Give every existing organisation type a row per card method, seeded from
  // the platform defaults, so no cart has to cope with a missing rate.
  pgm.sql(`
    INSERT INTO organization_type_payment_fees
      (organization_type_id, payment_method_id, fixed_fee, percentage_fee, tax_percentage)
    SELECT
      ot.id,
      pm.id,
      COALESCE((pm.default_fee_config->>'fixedFee')::decimal, 0),
      COALESCE((pm.default_fee_config->>'percentageFee')::decimal, 0),
      COALESCE((pm.default_fee_config->>'taxPercentage')::decimal, 0)
    FROM organization_types ot
    CROSS JOIN payment_methods pm
    WHERE pm.name IN (${Object.keys(DEFAULTS).map((n) => `'${n}'`).join(', ')})
    ON CONFLICT ON CONSTRAINT org_type_payment_fees_unique DO NOTHING
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('organization_type_payment_fees');
  pgm.dropColumns('payment_methods', ['default_fee_config']);
};
