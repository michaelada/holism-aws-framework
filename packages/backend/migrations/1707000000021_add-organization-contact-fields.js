/**
 * Add contact information fields to organizations table
 */

exports.up = (pgm) => {
  pgm.addColumns('organizations', {
    contact_name: {
      type: 'varchar(255)',
    },
    contact_email: {
      type: 'varchar(255)',
    },
    contact_mobile: {
      type: 'varchar(50)',
    },
  });

  // Add index on contact_email for faster lookups
  pgm.createIndex('organizations', 'contact_email');
};

exports.down = (pgm) => {
  pgm.dropIndex('organizations', 'contact_email');
  pgm.dropColumns('organizations', ['contact_name', 'contact_email', 'contact_mobile']);
};
