/* eslint-disable camelcase */

/**
 * The two capabilities event scheduling needs.
 *
 * Task S0-2 of docs/EVENT_SCHEDULING_TASKS_S0_S1.md. Nothing is gated by these
 * yet — the module they will gate does not exist — and that is deliberate: the
 * rows have to be here before anything can be granted them, and granting is a
 * separate act by the super admin.
 *
 * ## Why two, and not one
 *
 * They answer different questions and are held by different people.
 *
 *  - **`event-scheduling`** — *may this club build a running order at all?*
 *    It gates the module, its routes and its menu item, exactly as
 *    `event-ticketing` gates ticketing.
 *  - **`equestrian-disciplines`** — *which event type templates may this club
 *    see?* A template row names the capability that reveals it
 *    (`event_type_templates.capability`, migration 1709000000046), so a club
 *    holding this one is offered Show Jumping, Dressage and Eventing, and a
 *    tennis club is not. Later disciplines add a capability beside this one and
 *    change nothing else.
 *
 * Collapsing them into one would mean every club that can schedule anything is
 * offered every discipline the platform has ever defined, which is the opposite
 * of what a capability is for.
 *
 * ## The row in `capabilities` comes first
 *
 * `1709000000027_strip-unknown-capabilities` deletes any name from an
 * organisation that does not appear in this table. A capability granted without
 * a row here is silently removed the next time that runs — so this migration is
 * the prerequisite for granting either of them, not a formality.
 */

exports.shorthands = undefined;

const CAPABILITIES = [
  {
    name: 'event-scheduling',
    display_name: 'Event Scheduling',
    description: 'Build and publish a running order for an event and its activities',
  },
  {
    name: 'equestrian-disciplines',
    display_name: 'Equestrian Disciplines',
    description:
      'Show jumping, dressage and eventing event types, with their scheduling and scoring rules',
  },
];

exports.up = (pgm) => {
  for (const capability of CAPABILITIES) {
    /*
     * `additional-feature`, not `core-service`. The two categories in use
     * separate what every organisation gets from what one buys, and neither of
     * these is on by default for anybody.
     *
     * `ON CONFLICT DO NOTHING` so re-running against a database that already
     * has the row is a no-op rather than a failure.
     */
    pgm.sql(`
      INSERT INTO capabilities (name, display_name, description, category, is_active)
      VALUES (
        '${capability.name}',
        '${capability.display_name}',
        '${capability.description}',
        'additional-feature',
        true
      )
      ON CONFLICT (name) DO NOTHING
    `);
  }
};

exports.down = (pgm) => {
  for (const capability of CAPABILITIES) {
    /*
     * Ungranted before deleted, and in that order.
     *
     * Removing the row while organisations still list the name leaves a grant
     * that `strip-unknown-capabilities` would later delete anyway — but between
     * the two, a club is holding a capability nothing can describe. Taking it
     * back explicitly means the reverse of this migration leaves no trace,
     * which is what makes it safe to run.
     */
    pgm.sql(`
      UPDATE organizations
      SET enabled_capabilities = enabled_capabilities - '${capability.name}'
      WHERE enabled_capabilities ? '${capability.name}'
    `);
    pgm.sql(`
      UPDATE organization_types
      SET default_capabilities = default_capabilities - '${capability.name}'
      WHERE default_capabilities ? '${capability.name}'
    `);
    /*
     * An admin role's own permissions carry capability names too, and a role
     * still naming a deleted capability is the fault behind "the club has the
     * capability and the menu item is missing" — see the announcements module
     * summary. The reverse has to clean all three places.
     */
    pgm.sql(`
      UPDATE organization_admin_roles
      SET capability_permissions = capability_permissions - '${capability.name}'
      WHERE capability_permissions ? '${capability.name}'
    `);
    pgm.sql(`DELETE FROM capabilities WHERE name = '${capability.name}'`);
  }
};
