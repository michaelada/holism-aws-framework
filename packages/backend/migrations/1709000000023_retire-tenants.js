/* eslint-disable camelcase */

/**
 * Retire tenants. The top tier is the organisation type.
 *
 * ### What a tenant actually was
 *
 * `.claude/modules/architecture.md` described a three-tier model — tenant,
 * organisation, user — with the tenant as "the top-level customer boundary".
 * The schema never implemented it. `organizations` has no `tenant_id` and never
 * did; an organisation belongs to an **organisation type**, which is what
 * actually fixes its currency, locale, default capabilities and fee rates.
 *
 * The only foreign key pointing at `tenants` in the whole database was
 * `users.tenant_id`. Nothing in the org-admin application, the member
 * application, checkout, the capability model or events read a tenant. Creating
 * one inserted a row, made a Keycloak group and changed nothing else.
 *
 * A concept that exists in the documentation, the menu and one nullable column
 * — but in no behaviour — is worse than no concept at all: it invites people to
 * model against a boundary that does not enforce anything.
 *
 * ### What replaces it on `users`
 *
 * `users` is the platform-level registry the super admin maintains, distinct
 * from `organization_users` where every real org-admin and member lives. Its
 * rows were optionally scoped to a tenant; they are now optionally scoped to an
 * **organisation**, which is the boundary the rest of the platform actually
 * uses. `ON DELETE SET NULL` rather than CASCADE: a platform user record
 * outliving its organisation is a loose end to tidy, not a reason to delete a
 * person.
 *
 * ### Carrying data across
 *
 * A tenant was never linked to an organisation, so there is no mapping to
 * apply — any `tenant_id` present becomes NULL, and the column is dropped with
 * the table. This is safe precisely because nothing consumed the value.
 */

exports.up = (pgm) => {
  pgm.addColumns('users', {
    organization_id: {
      type: 'uuid',
      references: 'organizations',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex('users', 'organization_id');

  /*
   * No data migration from tenant_id.
   *
   * There is no tenant → organisation relationship anywhere in the schema to
   * derive one from, so anything other than NULL would be a guess. Recorded
   * explicitly rather than left implicit, because a silent data drop is the
   * kind of thing a future reader is right to be suspicious of.
   */
  pgm.dropColumns('users', ['tenant_id']);

  pgm.dropTable('tenants');
};

exports.down = (pgm) => {
  pgm.createTable('tenants', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    keycloak_group_id: { type: 'varchar(255)' },
    name: { type: 'varchar(255)', notNull: true },
    display_name: { type: 'varchar(255)' },
    domain: { type: 'varchar(255)' },
    status: { type: 'varchar(50)', default: 'active' },
    settings: { type: 'jsonb', default: '{}' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addColumns('users', {
    tenant_id: { type: 'uuid', references: 'tenants', onDelete: 'SET NULL' },
  });

  // The tenants themselves are not recoverable; nothing recorded which
  // organisation, if any, a given tenant corresponded to.
  pgm.dropColumns('users', ['organization_id']);
};
