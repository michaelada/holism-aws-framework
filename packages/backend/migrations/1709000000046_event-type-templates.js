/* eslint-disable camelcase */

/**
 * Event type templates, and the settings chain beneath them.
 *
 * The spine of event scheduling and scoring. See
 * docs/EVENT_SCHEDULING_AND_SCORING_PROPOSAL.md §2, and
 * docs/EVENT_SCHEDULING_TASKS_S0_S1.md task S0-1.
 *
 * ## What this is for
 *
 * `event_types` is a club's own free-text list — Kildare has a "Show Jumping"
 * row and Laois has a different row of the same name — and it carries no
 * behaviour at all. A discipline that knows how to schedule and score itself
 * has to be defined **once, by the platform**, or two hundred clubs each keep
 * their own copy of the rules and "we improved eventing" becomes unshippable.
 *
 * So a template is the platform's definition, and a club's event type points at
 * one. `template_id` is nullable, and null is what every existing row is: a
 * club that never buys either capability sees no change whatsoever.
 *
 * ## Shape and settings are different things
 *
 * A template holds both, and the split is load-bearing:
 *
 *  - **`shape`** — which phases exist, their order, the resource kinds, how the
 *    entity is resolved. **Not overridable.** A club needing different phases
 *    needs a *new template*, which is a super-admin action taking minutes; what
 *    it must not be is a per-club edit, because that is how one definition of
 *    eventing becomes two hundred and the calculators stop meaning anything.
 *  - **`default_settings`** — minutes per competitor, the gap between a rider's
 *    own rounds, break rules, the objections window. Every one of these is a
 *    statement about how a club runs a day rather than about the discipline,
 *    and every one is overridable.
 *
 * ## The overrides store differences, not copies
 *
 * `event_type_setting_overrides` holds **only what differs** at its level. That
 * is the whole reason for the table's existence: raising a platform default
 * then reaches every club that never overrode it, which copying whole objects
 * down the chain would silently prevent.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('event_type_templates', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },

    /**
     * The stable identifier code refers to — `equestrian.eventing`.
     *
     * Not the display name: that is translated and a club may see it worded
     * differently, while a calculator and a saved event both need to name the
     * same discipline for ever.
     */
    key: { type: 'varchar(100)', notNull: true, unique: true },

    display_name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },

    /**
     * Which capability reveals this template to a club.
     *
     * Null means "no gate beyond the scheduling capability itself" — a generic
     * template every club may use. Deliberately a plain name rather than a
     * foreign key to `capabilities`: that table is seeded and amended by
     * migrations, and a template referencing a capability row that a later
     * migration renames should fail loudly at the gate rather than cascade.
     */
    capability: { type: 'varchar(100)' },

    /**
     * Which scheduler builds a day for this discipline.
     *
     * One value today. `heats-and-finals` (swimming) and `bracket` (tennis) are
     * the known future tenants, and they differ in how slots are *populated*
     * rather than in anything around them — see the proposal §3.5.
     */
    scheduler_kind: { type: 'varchar(50)', notNull: true, default: 'sequential-phases' },

    /** Phases, their order, resource kinds, entity resolution. Not overridable. */
    shape: { type: 'jsonb', notNull: true, default: '{}' },

    /** What a club starts from and may change. */
    default_settings: { type: 'jsonb', notNull: true, default: '{}' },

    /**
     * A draft is invisible to clubs.
     *
     * Publishing is deliberate because a club pointing an event type at a
     * half-defined discipline gets a scheduler with no phases.
     */
    status: { type: 'varchar(20)', notNull: true, default: 'draft' },

    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('event_type_templates', 'event_type_templates_status_check', {
    check: "status IN ('draft', 'published')",
  });

  pgm.addConstraint('event_type_templates', 'event_type_templates_scheduler_kind_check', {
    check: "scheduler_kind IN ('sequential-phases', 'heats-and-finals', 'bracket')",
  });

  /*
   * The club-facing read is "every published template whose capability I hold",
   * which is the most frequent query this table will ever answer.
   */
  pgm.createIndex('event_type_templates', ['status', 'capability']);

  /**
   * One level of the settings chain: what an organisation type, or one
   * organisation, changes about a template's defaults.
   */
  pgm.createTable('event_type_setting_overrides', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },

    template_id: {
      type: 'uuid',
      notNull: true,
      references: 'event_type_templates',
      onDelete: 'CASCADE',
    },

    /*
     * Two nullable foreign keys rather than a `scope` word and an untyped
     * `scope_id`.
     *
     * The task breakdown proposed the latter; this is better and the difference
     * is worth the extra column. A polymorphic id has no referential integrity,
     * so an organisation type deleted tomorrow leaves override rows pointing at
     * nothing and no constraint notices. Two real keys let the database cascade
     * and let a reader see what a row refers to without consulting a string.
     */
    organization_type_id: {
      type: 'uuid',
      references: 'organization_types',
      onDelete: 'CASCADE',
    },
    organisation_id: {
      type: 'uuid',
      references: 'organizations',
      onDelete: 'CASCADE',
    },

    /** **Only what differs at this level.** See the note at the top of the file. */
    settings: { type: 'jsonb', notNull: true, default: '{}' },

    /**
     * Setting keys a club may not change — a federation fixing its rules.
     *
     * Meaningful at the organisation-type level only, and constrained below
     * rather than left as a convention: a locked key written against a single
     * organisation would be a club locking itself out of its own setting, which
     * is not a thing anybody means to do.
     */
    locked_keys: { type: 'jsonb', notNull: true, default: '[]' },

    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  // Exactly one of the two levels, never both and never neither.
  pgm.addConstraint('event_type_setting_overrides', 'event_type_setting_overrides_one_scope_check', {
    check: 'num_nonnulls(organization_type_id, organisation_id) = 1',
  });

  pgm.addConstraint('event_type_setting_overrides', 'event_type_setting_overrides_lock_scope_check', {
    check: "organization_type_id IS NOT NULL OR locked_keys = '[]'::jsonb",
  });

  /*
   * One row per template per level. Partial indexes rather than a single
   * unique across three columns, because a unique constraint containing a NULL
   * does not constrain anything in Postgres — two rows for the same template
   * and organisation would both be accepted.
   */
  pgm.createIndex('event_type_setting_overrides', ['template_id', 'organization_type_id'], {
    unique: true,
    where: 'organization_type_id IS NOT NULL',
    name: 'event_type_setting_overrides_type_unique',
  });

  pgm.createIndex('event_type_setting_overrides', ['template_id', 'organisation_id'], {
    unique: true,
    where: 'organisation_id IS NOT NULL',
    name: 'event_type_setting_overrides_org_unique',
  });

  /**
   * A club's event type may derive its behaviour from a template.
   *
   * **Nullable, and that is the normal state.** Every row today is null and
   * stays null; a club with no scheduling capability never sees this column.
   *
   * `SET NULL` rather than `CASCADE`: retiring a template must not delete a
   * club's event type, because `events.event_type_id` references it and an
   * event would lose the type it was run under.
   */
  pgm.addColumns('event_types', {
    template_id: {
      type: 'uuid',
      references: 'event_type_templates',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex('event_types', 'template_id');
};

exports.down = (pgm) => {
  pgm.dropColumns('event_types', ['template_id']);
  pgm.dropTable('event_type_setting_overrides');
  pgm.dropTable('event_type_templates');
};
