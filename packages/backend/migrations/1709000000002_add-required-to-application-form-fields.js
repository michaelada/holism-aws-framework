/**
 * Migration: Add required column to application_form_fields
 *
 * Adds a 'required' boolean column so that field mandatory/optional
 * status is persisted when editing form definitions.
 */

exports.up = (pgm) => {
  pgm.addColumn('application_form_fields', {
    required: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('application_form_fields', 'required');
};
