/**
 * Migration: Add url_code to organizations
 *
 * The account-user application addresses an organisation by a short,
 * URL-friendly code — itsplainsailing.com/account/khpc — so every
 * organisation needs one and it has to be unique.
 *
 * Existing rows are backfilled from their name. Three things can go wrong with
 * a generated slug, and all three are handled here rather than left to fail
 * against the unique index:
 *
 *   - it collides with another organisation's slug   -> numeric suffix
 *   - it would shadow one of the application's own
 *     paths, so /account/admin could never resolve
 *     to an organisation                             -> '-org' suffix
 *   - it is empty or a single character              -> '-org' suffix
 *
 * RESERVED must stay in step with RESERVED_URL_CODES in
 * src/utils/url-code.ts, which enforces the same rule on new organisations.
 */

exports.shorthands = undefined;

// Kept deliberately broad: a word only has to be plausible as a future path
// segment to be worth reserving, and reserving one costs nothing.
const RESERVED = [
  'account', 'accounts', 'admin', 'administrator', 'api', 'app', 'assets',
  'auth', 'cart', 'cdn', 'checkout', 'docs', 'health', 'help', 'images',
  'login', 'logout', 'metrics', 'new', 'orgadmin', 'password', 'payment',
  'payments', 'profile', 'public', 'register', 'settings', 'signin', 'signup',
  'static', 'support', 'switch', 'user', 'users', 'www',
  // Added by migration 1709000000033; listed here so a fresh database
  // backfilled by this migration reserves them too.
  'events', 'event', 'whats-on', 'sitemap', 'robots',
];

const SLUG_MAX = 50;
// Leaves room for a '-<n>' collision suffix inside SLUG_MAX.
const BASE_MAX = 40;

exports.up = (pgm) => {
  pgm.addColumns('organizations', {
    url_code: { type: `varchar(${SLUG_MAX})` },
  });

  const reservedArray = `ARRAY[${RESERVED.map((w) => `'${w}'`).join(', ')}]::text[]`;

  pgm.sql(`
    WITH slugged AS (
      SELECT
        id,
        rtrim(
          left(
            COALESCE(
              NULLIF(
                trim(BOTH '-' FROM regexp_replace(
                  lower(COALESCE(name, display_name, '')), '[^a-z0-9]+', '-', 'g'
                )),
                ''
              ),
              'org'
            ),
            ${BASE_MAX}
          ),
          '-'
        ) AS base
      FROM organizations
    ),
    guarded AS (
      SELECT
        id,
        CASE
          WHEN length(base) < 2 OR base = ANY(${reservedArray}) THEN base || '-org'
          ELSE base
        END AS base
      FROM slugged
    ),
    numbered AS (
      SELECT
        id,
        base,
        row_number() OVER (PARTITION BY base ORDER BY id) AS rn
      FROM guarded
    )
    UPDATE organizations o
    SET url_code = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END
    FROM numbered n
    WHERE o.id = n.id;
  `);

  pgm.alterColumn('organizations', 'url_code', { notNull: true });

  pgm.addConstraint('organizations', 'organizations_url_code_unique', {
    unique: ['url_code'],
  });

  // Lower-case alphanumerics and hyphens, starting with an alphanumeric, two
  // characters or more. Enforced in the database as well as the service
  // because a malformed code silently breaks routing rather than erroring.
  pgm.addConstraint('organizations', 'organizations_url_code_format', {
    check: `url_code ~ '^[a-z0-9][a-z0-9-]{1,${SLUG_MAX - 1}}$'`,
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('organizations', 'organizations_url_code_format');
  pgm.dropConstraint('organizations', 'organizations_url_code_unique');
  pgm.dropColumns('organizations', ['url_code']);
};
