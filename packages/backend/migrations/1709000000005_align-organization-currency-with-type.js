/**
 * Migration: An organisation trades in its organisation type's currency
 *
 * Card handling fees carry a fixed cash amount held on the organisation type
 * and inherited by its organisations. A €0.25 fixed fee inherited by an
 * organisation trading in GBP is meaningless, so the two currencies can no
 * longer diverge.
 *
 * Until now organizations.currency was nullable and set independently of the
 * type on the super-admin form. This aligns the existing data and makes the
 * column mandatory; organization.service enforces the rule from here on.
 *
 * Any organisation whose currency genuinely differed is listed as a NOTICE
 * before being changed — the value is about to be overwritten, and that is
 * worth seeing in the migration output rather than discovering later.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      mismatch RECORD;
      total INT := 0;
    BEGIN
      FOR mismatch IN
        SELECT o.name, o.currency AS org_currency, ot.currency AS type_currency,
               ot.name AS type_name
        FROM organizations o
        JOIN organization_types ot ON ot.id = o.organization_type_id
        WHERE o.currency IS NOT NULL AND o.currency <> ot.currency
        ORDER BY o.name
      LOOP
        total := total + 1;
        RAISE NOTICE
          'Organisation "%" trades in % but its type "%" uses % — changing it to %',
          mismatch.name, mismatch.org_currency, mismatch.type_name,
          mismatch.type_currency, mismatch.type_currency;
      END LOOP;

      IF total > 0 THEN
        RAISE NOTICE '% organisation(s) had a currency differing from their type.', total;
      END IF;
    END $$;
  `);

  pgm.sql(`
    UPDATE organizations o
    SET currency = ot.currency,
        updated_at = NOW()
    FROM organization_types ot
    WHERE ot.id = o.organization_type_id
      AND (o.currency IS NULL OR o.currency <> ot.currency)
  `);

  pgm.alterColumn('organizations', 'currency', { notNull: true });
};

exports.down = (pgm) => {
  // The previous per-organisation currencies are not recoverable, so this only
  // relaxes the constraint.
  pgm.alterColumn('organizations', 'currency', { notNull: false });
};
