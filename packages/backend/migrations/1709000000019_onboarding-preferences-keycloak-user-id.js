/**
 * Migration: onboarding preferences are keyed by the Keycloak user id
 *
 * `user_onboarding_preferences.user_id` was `uuid REFERENCES organization_users(id)`,
 * but every writer passes `req.user.userId` — the Keycloak subject from the JWT.
 * Those are different identifiers of different things, so **every save failed**
 * with `23503 foreign key violation` and a 500. The read path silently returned
 * defaults, so the whole feature looked like it worked and quietly forgot
 * everything: a user who ticked "Don't show this again" was shown the dialog
 * again on their next visit.
 *
 * The Keycloak id is also the *right* key. An onboarding preference is about a
 * person — "I have read the events introduction" — not about one of their
 * memberships. A user who administers two organisations has two
 * `organization_users` rows and should not be introduced to the same module
 * twice.
 *
 * **No foreign key replaces it.** Identity lives in Keycloak, not in this
 * database: `organization_users.keycloak_user_id` is a plain `varchar(255)` with
 * no table behind it, and the `users` table is written only by the super-admin
 * user service — org-admin and account users never appear there, so pointing at
 * it would reproduce the same failure through a different constraint.
 *
 * @see docs/ONBOARDING_DISMISSAL_IGNORED.md
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // The constraint that made the feature impossible.
  pgm.sql(`
    ALTER TABLE user_onboarding_preferences
    DROP CONSTRAINT IF EXISTS user_onboarding_preferences_user_id_fkey;
  `);

  pgm.sql(`
    ALTER TABLE user_onboarding_preferences
    ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;
  `);

  /*
   * Carry over anything that did get stored.
   *
   * In practice this is expected to find nothing — no code path could write a
   * row that satisfied the old constraint — but a row written by hand, or by a
   * seed script, is a real user's preference and is worth translating rather
   * than stranding.
   *
   * One person can hold several `organization_users` rows, so the translation
   * can collide with the unique constraint on `user_id`. Duplicates are folded
   * into the earliest row first — dismissals are additive, so the union is the
   * answer that respects every click the user made.
   */
  pgm.sql(`
    WITH mapped AS (
      SELECT p.id AS pref_id, p.created_at, ou.keycloak_user_id AS kc_id
      FROM user_onboarding_preferences p
      JOIN organization_users ou ON ou.id::text = p.user_id
    ),
    survivor AS (
      SELECT DISTINCT ON (kc_id) kc_id, pref_id AS keep_id
      FROM mapped
      ORDER BY kc_id, created_at, pref_id
    ),
    folded AS (
      SELECT s.keep_id,
             bool_or(p.welcome_dismissed) AS welcome_dismissed,
             COALESCE(
               jsonb_agg(DISTINCT e.value) FILTER (WHERE e.value IS NOT NULL),
               '[]'::jsonb
             ) AS modules_visited
      FROM survivor s
      JOIN mapped m ON m.kc_id = s.kc_id
      JOIN user_onboarding_preferences p ON p.id = m.pref_id
      LEFT JOIN LATERAL jsonb_array_elements(p.modules_visited) e ON TRUE
      GROUP BY s.keep_id
    )
    UPDATE user_onboarding_preferences p
    SET welcome_dismissed = f.welcome_dismissed,
        modules_visited = f.modules_visited
    FROM folded f
    WHERE p.id = f.keep_id;
  `);

  // Drop the now-merged duplicates, then re-key the survivors.
  pgm.sql(`
    DELETE FROM user_onboarding_preferences
    WHERE id IN (
      SELECT pref_id FROM (
        SELECT p.id AS pref_id,
               ROW_NUMBER() OVER (
                 PARTITION BY ou.keycloak_user_id ORDER BY p.created_at, p.id
               ) AS rn
        FROM user_onboarding_preferences p
        JOIN organization_users ou ON ou.id::text = p.user_id
      ) ranked
      WHERE rn > 1
    );
  `);

  pgm.sql(`
    UPDATE user_onboarding_preferences p
    SET user_id = ou.keycloak_user_id
    FROM organization_users ou
    WHERE ou.id::text = p.user_id;
  `);

  pgm.sql(`
    COMMENT ON COLUMN user_onboarding_preferences.user_id IS
    'Keycloak user id (JWT subject) — the person, not one of their organisation memberships. Intentionally has no foreign key: identity lives in Keycloak.';
  `);

  pgm.sql(`
    COMMENT ON COLUMN user_onboarding_preferences.modules_visited IS
    'Module ids whose introduction dialog the user dismissed with "Don''t show again". The accepted set is ONBOARDING_MODULE_IDS in src/utils/onboarding-modules.ts.';
  `);
};

exports.down = (pgm) => {
  /*
   * Lossy by nature. A Keycloak id maps to as many `organization_users` rows as
   * the person has memberships, so going back means choosing one arbitrarily —
   * and any preference belonging to a user with no membership row cannot be
   * represented at all, so it is dropped rather than blocking the rollback.
   */
  pgm.sql(`
    DELETE FROM user_onboarding_preferences p
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_users ou WHERE ou.keycloak_user_id = p.user_id
    );
  `);

  pgm.sql(`
    UPDATE user_onboarding_preferences p
    SET user_id = (
      SELECT ou.id::text
      FROM organization_users ou
      WHERE ou.keycloak_user_id = p.user_id
      ORDER BY ou.created_at
      LIMIT 1
    );
  `);

  pgm.sql(`
    ALTER TABLE user_onboarding_preferences
    ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
  `);

  pgm.sql(`
    ALTER TABLE user_onboarding_preferences
    ADD CONSTRAINT user_onboarding_preferences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES organization_users(id) ON DELETE CASCADE;
  `);

  pgm.sql(`
    COMMENT ON COLUMN user_onboarding_preferences.user_id IS
    'Reference to the organization user';
  `);
};
