/**
 * Migration: Add membership numbering configuration to organization_types
 * 
 * This migration adds configurable membership numbering rules at the Organization Type level,
 * allowing Super Admins to control how membership numbers are generated and managed.
 * 
 * Adds three new columns:
 * - membership_numbering: Controls whether numbers are system-generated ('internal') or user-provided ('external')
 * - membership_number_uniqueness: Defines uniqueness scope ('organization_type' or 'organization')
 * - initial_membership_number: Starting number for internal sequential generation (default: 1000000)
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add membership_numbering column
  pgm.addColumn('organization_types', {
    membership_numbering: {
      type: 'varchar(20)',
      notNull: true,
      default: 'internal',
    },
  });

  // Add membership_number_uniqueness column
  pgm.addColumn('organization_types', {
    membership_number_uniqueness: {
      type: 'varchar(20)',
      notNull: true,
      default: 'organization',
    },
  });

  // Add initial_membership_number column
  pgm.addColumn('organization_types', {
    initial_membership_number: {
      type: 'integer',
      notNull: true,
      default: 1000000,
    },
  });

  // Add check constraint for membership_numbering
  pgm.addConstraint('organization_types', 'check_membership_numbering', {
    check: "membership_numbering IN ('internal', 'external')",
  });

  // Add check constraint for membership_number_uniqueness
  pgm.addConstraint('organization_types', 'check_membership_number_uniqueness', {
    check: "membership_number_uniqueness IN ('organization_type', 'organization')",
  });

  // Add check constraint for initial_membership_number (must be positive)
  pgm.addConstraint('organization_types', 'check_initial_membership_number', {
    check: 'initial_membership_number > 0',
  });

  // Update existing organization types to have default values
  pgm.sql(`
    UPDATE organization_types 
    SET 
      membership_numbering = 'internal',
      membership_number_uniqueness = 'organization',
      initial_membership_number = 1000000
    WHERE membership_numbering IS NULL 
       OR membership_number_uniqueness IS NULL 
       OR initial_membership_number IS NULL;
  `);

  // Add comments to document the columns
  pgm.sql(`
    COMMENT ON COLUMN organization_types.membership_numbering IS 
    'Controls membership number generation mode: internal (system-generated) or external (user-provided)';
  `);

  pgm.sql(`
    COMMENT ON COLUMN organization_types.membership_number_uniqueness IS 
    'Defines uniqueness scope for membership numbers: organization_type (unique across all orgs of this type) or organization (unique within each org)';
  `);

  pgm.sql(`
    COMMENT ON COLUMN organization_types.initial_membership_number IS 
    'Starting number for internal sequential generation. Must be a positive integer. Default: 1000000';
  `);
};

exports.down = (pgm) => {
  // Drop constraints first
  pgm.dropConstraint('organization_types', 'check_membership_numbering');
  pgm.dropConstraint('organization_types', 'check_membership_number_uniqueness');
  pgm.dropConstraint('organization_types', 'check_initial_membership_number');

  // Drop columns
  pgm.dropColumn('organization_types', 'membership_numbering');
  pgm.dropColumn('organization_types', 'membership_number_uniqueness');
  pgm.dropColumn('organization_types', 'initial_membership_number');
};
