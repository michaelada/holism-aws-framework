exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create tenants table
  pgm.createTable('tenants', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
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
      notNull: true,
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
  });

  // Create indexes for tenants table
  pgm.createIndex('tenants', 'keycloak_group_id', {
    name: 'idx_tenants_keycloak_group_id',
  });

  pgm.createIndex('tenants', 'name', {
    name: 'idx_tenants_name',
  });

  // Create users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    keycloak_user_id: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    tenant_id: {
      type: 'uuid',
      references: 'tenants(id)',
      onDelete: 'SET NULL',
    },
    username: {
      type: 'varchar(255)',
      notNull: true,
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
    },
    preferences: {
      type: 'jsonb',
      default: '{}',
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
  });

  // Create indexes for users table
  pgm.createIndex('users', 'keycloak_user_id', {
    name: 'idx_users_keycloak_user_id',
  });

  pgm.createIndex('users', 'tenant_id', {
    name: 'idx_users_tenant_id',
  });

  pgm.createIndex('users', 'email', {
    name: 'idx_users_email',
  });

  // Create roles table
  pgm.createTable('roles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    keycloak_role_id: {
      type: 'varchar(255)',
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
    description: {
      type: 'text',
    },
    permissions: {
      type: 'jsonb',
      default: '[]',
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

  // Create index for roles table
  pgm.createIndex('roles', 'name', {
    name: 'idx_roles_name',
  });

  // Create admin_audit_log table
  pgm.createTable('admin_audit_log', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    action: {
      type: 'varchar(100)',
      notNull: true,
    },
    resource: {
      type: 'varchar(100)',
      notNull: true,
    },
    resource_id: {
      type: 'varchar(255)',
    },
    changes: {
      type: 'jsonb',
    },
    ip_address: {
      type: 'varchar(45)',
    },
    timestamp: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create indexes for admin_audit_log table
  pgm.createIndex('admin_audit_log', 'user_id', {
    name: 'idx_audit_log_user_id',
  });

  pgm.createIndex('admin_audit_log', 'timestamp', {
    name: 'idx_audit_log_timestamp',
  });

  pgm.createIndex('admin_audit_log', 'action', {
    name: 'idx_audit_log_action',
  });
};

exports.down = (pgm) => {
  // Drop tables in reverse order (respecting foreign key constraints)
  pgm.dropTable('admin_audit_log', { cascade: true });
  pgm.dropTable('roles', { cascade: true });
  pgm.dropTable('users', { cascade: true });
  pgm.dropTable('tenants', { cascade: true });
};
