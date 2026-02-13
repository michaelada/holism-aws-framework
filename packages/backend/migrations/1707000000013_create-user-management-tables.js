/**
 * Migration: Create User Management Tables
 * 
 * This migration creates additional user management tables:
 * - org_admin_users (view/materialized view of organization_users with user_type='admin')
 * - account_users (view/materialized view of organization_users with user_type='account')
 * 
 * Note: The base organization_users table already exists from migration 1707000000003.
 * This migration creates views to separate admin and account users for easier querying.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create view for org admin users
  pgm.createView('org_admin_users', {}, `
    SELECT 
      id,
      organization_id,
      keycloak_user_id,
      email,
      first_name,
      last_name,
      status,
      last_login,
      created_at,
      updated_at,
      created_by
    FROM organization_users
    WHERE user_type = 'admin'
  `);

  // Create view for account users
  pgm.createView('account_users', {}, `
    SELECT 
      id,
      organization_id,
      keycloak_user_id,
      email,
      first_name,
      last_name,
      status,
      last_login,
      created_at,
      updated_at,
      created_by
    FROM organization_users
    WHERE user_type = 'account'
  `);
};

exports.down = (pgm) => {
  pgm.dropView('account_users');
  pgm.dropView('org_admin_users');
};
