/* eslint-disable camelcase */

/**
 * One person may be both an administrator and a member of the same club.
 *
 * `organization_users_org_kc_user_unique` was `(organization_id,
 * keycloak_user_id)` — one row per identity per organisation, whatever its
 * `user_type`. That made the two applications mutually exclusive on a single
 * email address: an administrator of a club who opened the account app and
 * pressed "Create an account" hit the constraint, and the platform told them to
 * sign in with a different email address.
 *
 * That is not the intent. Running a club and taking part in it are ordinary
 * things for one person to do, and requiring two email addresses to do both is
 * an artefact of this constraint rather than a decision anybody made.
 *
 * `user_type` joins the key, so the uniqueness that *is* wanted still holds:
 * one administrator row and one member row per identity per organisation, and
 * no duplicates of either. Nothing else needs to change to make this safe —
 * both applications already resolve their own row by type
 * (`organisation-scope.middleware` filters `'org-admin'`,
 * `account-organisation.service` filters `'account-user'`), so a person with
 * both rows is two independent relationships that never see each other.
 *
 * See docs/ONE_EMAIL_BOTH_APPS.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropConstraint('organization_users', 'organization_users_org_kc_user_unique');

  pgm.addConstraint('organization_users', 'organization_users_org_kc_user_type_unique', {
    unique: ['organization_id', 'keycloak_user_id', 'user_type'],
  });
};

exports.down = (pgm) => {
  /*
   * Only reversible while nobody has taken up the offer.
   *
   * Once one person holds both rows at one club, the old constraint cannot be
   * recreated without deciding which of the two to delete — and that is a
   * decision about somebody's data, not a schema detail, so it is not made
   * here. The migration fails instead, which is the honest outcome: resolve the
   * duplicates deliberately, then run it again.
   */
  pgm.dropConstraint('organization_users', 'organization_users_org_kc_user_type_unique');

  pgm.addConstraint('organization_users', 'organization_users_org_kc_user_unique', {
    unique: ['organization_id', 'keycloak_user_id'],
  });
};
