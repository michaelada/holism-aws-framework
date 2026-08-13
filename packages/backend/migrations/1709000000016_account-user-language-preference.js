/* eslint-disable camelcase */

/**
 * A member's own language, overriding their club's default (screen P1).
 *
 * `organizations.language` decides what a club's members see. A member who
 * reads French in an Irish club has had no way to say so.
 *
 * **Why a column, when the value belongs to the identity rather than to one
 * club.** The obvious home is the Keycloak user's `locale` attribute, and it is
 * written there too — that is what makes the *login page* appear in the
 * member's language, which no column of ours can achieve. But the account app
 * resolves an organisation on every load and picks the locale there, and
 * reading a Keycloak attribute on that path would put an admin-API round trip
 * in front of every page load, with a failure mode that blanks the language
 * when Keycloak is briefly unavailable.
 *
 * So it is stored in both places, for two different readers. The column is
 * duplicated per club exactly as `first_name` and `phone` already are, and is
 * kept consistent the same way: `account-profile.service.ts` writes every row
 * belonging to the identity, never just the club being viewed.
 *
 * Nullable, and null is the default rather than a gap: it means "follow the
 * organisation", which is what every existing member does today.
 */

exports.up = (pgm) => {
  pgm.addColumn('organization_users', {
    preferred_language: {
      type: 'varchar(10)',
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('organization_users', 'preferred_language');
};
