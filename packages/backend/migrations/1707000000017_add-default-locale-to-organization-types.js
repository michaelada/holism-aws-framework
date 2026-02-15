/**
 * Migration: Add default_locale to organization_types table
 * 
 * This migration adds internationalization support by adding a default_locale
 * column to the organization_types table. This allows each organization type
 * to specify its preferred language/locale.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add default_locale column with default value 'en-GB'
  pgm.addColumn('organization_types', {
    default_locale: {
      type: 'varchar(10)',
      notNull: true,
      default: 'en-GB',
    },
  });

  // Update any existing rows to have the default locale
  pgm.sql(`
    UPDATE organization_types 
    SET default_locale = 'en-GB' 
    WHERE default_locale IS NULL OR default_locale = '' OR default_locale = '''en-GB''';
  `);

  // Add check constraint to validate locale format 'xx-XX'
  pgm.addConstraint('organization_types', 'organization_types_locale_format_check', {
    check: "default_locale ~ '^[a-z]{2}-[A-Z]{2}$'",
  });

  // Add index on default_locale for query performance
  pgm.createIndex('organization_types', 'default_locale');

  // Add comment to document the column
  pgm.sql(`
    COMMENT ON COLUMN organization_types.default_locale IS 
    'Default locale for organizations of this type. Format: xx-XX (e.g., en-GB, fr-FR). Supported locales: en-GB, fr-FR, es-ES, it-IT, de-DE, pt-PT';
  `);
};

exports.down = (pgm) => {
  // Drop index first
  pgm.dropIndex('organization_types', 'default_locale');
  
  // Drop constraint
  pgm.dropConstraint('organization_types', 'organization_types_locale_format_check');
  
  // Drop column
  pgm.dropColumn('organization_types', 'default_locale');
};
