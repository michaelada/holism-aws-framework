/* eslint-disable camelcase */

/**
 * Where an administrator of several organisations starts a new session.
 *
 * **This is a default, not an authority.** What decides which organisation a
 * request acts on is the request itself — the id in the URL, or the
 * `X-Organisation-Id` header the shell sends. This row only answers "which one
 * should we open on?" when a fresh session has not said yet.
 *
 * The distinction is the whole reason it is safe to store. A server-side
 * *current* organisation would make two tabs on two clubs fight, and would put
 * the answer to "which club is this request about?" outside the request. A
 * remembered starting point has neither problem: each tab sends its own header
 * from the moment it loads.
 *
 * Not folded into `user_onboarding_preferences` despite that table being keyed
 * the same way. That one records what a user has been shown — dismissed
 * welcomes, visited modules — and this is not that; a table named for
 * onboarding holding tenancy state is where the next reader stops trusting the
 * names.
 *
 * See docs/ORGADMIN_MULTI_ORGANISATION.md §2.4.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('org_admin_last_organisation', {
    /** The Keycloak subject. One row per identity, whatever they administer. */
    keycloak_user_id: { type: 'text', primaryKey: true },

    /*
     * Cascades: if the organisation goes, so does the memory of it. The
     * resolver re-checks membership on every request regardless, so a stale row
     * could never grant access — but it could send an administrator to a club
     * that no longer exists, and there is no reason to keep it.
     */
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations',
      onDelete: 'CASCADE',
    },

    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('org_admin_last_organisation');
};
