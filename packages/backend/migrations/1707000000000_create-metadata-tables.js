exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create field_definitions table
  pgm.createTable('field_definitions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    short_name: {
      type: 'varchar(100)',
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
    datatype: {
      type: 'varchar(50)',
      notNull: true,
    },
    datatype_properties: {
      type: 'jsonb',
      default: '{}',
    },
    validation_rules: {
      type: 'jsonb',
      default: '[]',
    },
    mandatory: {
      type: 'boolean',
      default: false,
      notNull: true,
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

  // Create index on short_name for field_definitions
  pgm.createIndex('field_definitions', 'short_name', {
    name: 'idx_field_definitions_short_name',
  });

  // Create object_definitions table
  pgm.createTable('object_definitions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    short_name: {
      type: 'varchar(100)',
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
    display_properties: {
      type: 'jsonb',
      default: '{}',
    },
    wizard_config: {
      type: 'jsonb',
    },
    field_groups: {
      type: 'jsonb',
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

  // Create index on short_name for object_definitions
  pgm.createIndex('object_definitions', 'short_name', {
    name: 'idx_object_definitions_short_name',
  });

  // Create object_fields relationship table
  pgm.createTable('object_fields', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    object_id: {
      type: 'uuid',
      notNull: true,
      references: 'object_definitions(id)',
      onDelete: 'CASCADE',
    },
    field_id: {
      type: 'uuid',
      notNull: true,
      references: 'field_definitions(id)',
      onDelete: 'RESTRICT',
    },
    mandatory: {
      type: 'boolean',
      default: false,
    },
    display_order: {
      type: 'integer',
      notNull: true,
    },
    in_table: {
      type: 'boolean',
      default: true,
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create unique constraint on object_id and field_id combination
  pgm.addConstraint('object_fields', 'unique_object_field', {
    unique: ['object_id', 'field_id'],
  });

  // Create indexes for object_fields
  pgm.createIndex('object_fields', 'object_id', {
    name: 'idx_object_fields_object_id',
  });

  pgm.createIndex('object_fields', 'field_id', {
    name: 'idx_object_fields_field_id',
  });
};

exports.down = (pgm) => {
  // Drop tables in reverse order (respecting foreign key constraints)
  pgm.dropTable('object_fields', { cascade: true });
  pgm.dropTable('object_definitions', { cascade: true });
  pgm.dropTable('field_definitions', { cascade: true });
};
