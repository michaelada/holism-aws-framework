exports.shorthands = undefined;

exports.up = (pgm) => {
  // Remove mandatory column from field_definitions table
  // The mandatory property should only exist in object_fields (field assignments)
  pgm.dropColumn('field_definitions', 'mandatory');
};

exports.down = (pgm) => {
  // Add back mandatory column if we need to rollback
  pgm.addColumn('field_definitions', {
    mandatory: {
      type: 'boolean',
      default: false,
      notNull: true,
    },
  });
};
