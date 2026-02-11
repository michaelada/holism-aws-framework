/**
 * Migration: Create Organization Management Tables
 * 
 * This migration creates the new organization management structure:
 * - organization_types
 * - capabilities
 * - organizations (replaces tenants)
 * - organization_users
 * - organization_admin_roles
 * - organization_user_roles
 * - organization_audit_log
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create capabilities table (system-wide catalog)
  pgm.createTable('capabilities', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    display_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    category: {
      type: 'varchar(100)',
    },
    is_active: {
      type: 'boolean',
      default: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('capabilities', 'name');
  pgm.createIndex('capabilities', 'category');

  // 2. Create organization_types table
  pgm.createTable('organization_types', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    display_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    currency: {
      type: 'varchar(3)',
      notNull: true,
      default: 'USD',
    },
    language: {
      type: 'varchar(10)',
      notNull: true,
      default: 'en',
    },
    default_capabilities: {
      type: 'jsonb',
      default: '[]',
    },
    status: {
      type: 'varchar(50)',
      default: 'active',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    created_by: {
      type: 'uuid',
    },
    updated_by: {
      type: 'uuid',
    },
  });

  pgm.createIndex('organization_types', 'name');
  pgm.createIndex('organization_types', 'status');

  // 3. Create organizations table (replaces tenants)
  pgm.createTable('organizations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_types(id)',
      onDelete: 'RESTRICT',
    },
    keycloak_group_id: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    display_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    domain: {
      type: 'varchar(255)',
    },
    status: {
      type: 'varchar(50)',
      default: 'active',
    },
    currency: {
      type: 'varchar(3)',
    },
    language: {
      type: 'varchar(10)',
    },
    enabled_capabilities: {
      type: 'jsonb',
      default: '[]',
    },
    settings: {
      type: 'jsonb',
      default: '{}',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    created_by: {
      type: 'uuid',
    },
    updated_by: {
      type: 'uuid',
    },
  });

  pgm.createIndex('organizations', 'organization_type_id');
  pgm.createIndex('organizations', 'name');
  pgm.createIndex('organizations', 'status');
  pgm.createIndex('organizations', 'keycloak_group_id');

  // 4. Create organization_users table
  pgm.createTable('organization_users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    keycloak_user_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    user_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
    },
    first_name: {
      type: 'varchar(255)',
    },
    last_name: {
      type: 'varchar(255)',
    },
    status: {
      type: 'varchar(50)',
      default: 'active',
    },
    last_login: {
      type: 'timestamp',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    created_by: {
      type: 'uuid',
    },
  });

  pgm.addConstraint('organization_users', 'organization_users_org_kc_user_unique', {
    unique: ['organization_id', 'keycloak_user_id'],
  });
  pgm.createIndex('organization_users', 'organization_id');
  pgm.createIndex('organization_users', 'keycloak_user_id');
  pgm.createIndex('organization_users', 'user_type');
  pgm.createIndex('organization_users', 'email');

  // 5. Create organization_admin_roles table
  pgm.createTable('organization_admin_roles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    keycloak_role_id: {
      type: 'varchar(255)',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    display_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    capability_permissions: {
      type: 'jsonb',
      default: '{}',
    },
    is_system_role: {
      type: 'boolean',
      default: false,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('organization_admin_roles', 'organization_id');
  pgm.createIndex('organization_admin_roles', 'name');

  // 6. Create organization_user_roles table
  pgm.createTable('organization_user_roles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
      onDelete: 'CASCADE',
    },
    organization_admin_role_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_admin_roles(id)',
      onDelete: 'CASCADE',
    },
    assigned_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    assigned_by: {
      type: 'uuid',
      references: 'organization_users(id)',
    },
  });

  pgm.addConstraint('organization_user_roles', 'organization_user_roles_user_role_unique', {
    unique: ['organization_user_id', 'organization_admin_role_id'],
  });
  pgm.createIndex('organization_user_roles', 'organization_user_id');
  pgm.createIndex('organization_user_roles', 'organization_admin_role_id');

  // 7. Create organization_audit_log table
  pgm.createTable('organization_audit_log', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      references: 'organization_users(id)',
    },
    action: {
      type: 'varchar(100)',
      notNull: true,
    },
    entity_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    entity_id: {
      type: 'uuid',
    },
    changes: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('organization_audit_log', 'organization_id');
  pgm.createIndex('organization_audit_log', 'user_id');
  pgm.createIndex('organization_audit_log', 'entity_type');
  pgm.createIndex('organization_audit_log', 'created_at');
};

exports.down = (pgm) => {
  // Drop tables in reverse order due to foreign key constraints
  pgm.dropTable('organization_audit_log');
  pgm.dropTable('organization_user_roles');
  pgm.dropTable('organization_admin_roles');
  pgm.dropTable('organization_users');
  pgm.dropTable('organizations');
  pgm.dropTable('organization_types');
  pgm.dropTable('capabilities');
};
