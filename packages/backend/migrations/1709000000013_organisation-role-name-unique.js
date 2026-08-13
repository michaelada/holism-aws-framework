/* eslint-disable camelcase */

/**
 * One role name per organisation.
 *
 * Needed because organisation creation now provisions a "Full Administrator"
 * role automatically. Without a unique key that insert cannot be made
 * idempotent, and any retry — a failed transaction, a double-submitted create
 * form, a replayed request — leaves the organisation with two identical roles.
 * Two roles with the same name are worse than confusing: an administrator
 * editing permissions has no way to tell which one is in force.
 *
 * The constraint is on `(organization_id, name)` rather than on `name` alone,
 * because roles are per organisation and every organisation is expected to have
 * its own "Full Administrator".
 *
 * Checked before writing this: no existing rows violate it.
 */

exports.up = (pgm) => {
  pgm.addConstraint(
    'organization_admin_roles',
    'organization_admin_roles_org_name_unique',
    { unique: ['organization_id', 'name'] }
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint(
    'organization_admin_roles',
    'organization_admin_roles_org_name_unique'
  );
};
