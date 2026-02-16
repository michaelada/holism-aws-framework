/**
 * Migration: Update Capabilities
 * 
 * This migration updates the capabilities table:
 * - Removes: discounts, document-uploads, email-notifications, sms-notifications
 * - Adds: 14 new capabilities for document management, discounts by area, and integrations
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Remove old capabilities
  const capabilitiesToRemove = [
    'discounts',
    'document-uploads',
    'email-notifications',
    'sms-notifications'
  ];

  capabilitiesToRemove.forEach((name) => {
    pgm.sql(`DELETE FROM capabilities WHERE name = '${name}'`);
  });

  // Add new capabilities
  const newCapabilities = [
    ['event-document-management', 'Event Document Management', 'Manage document uploads for events', 'additional-feature'],
    ['membership-document-management', 'Membership Document Management', 'Manage document uploads for memberships', 'additional-feature'],
    ['registration-document-management', 'Registration Document Management', 'Manage document uploads for registrations', 'additional-feature'],
    ['entry-restrictions', 'Entry Restrictions', 'Configure entry restrictions and eligibility rules', 'additional-feature'],
    ['entry-discounts', 'Entry Discounts', 'Apply discount codes to event entries', 'additional-feature'],
    ['membership-discounts', 'Membership Discounts', 'Apply discount codes to memberships', 'additional-feature'],
    ['registration-discounts', 'Registration Discounts', 'Apply discount codes to registrations', 'additional-feature'],
    ['merchandise-discounts', 'Merchandise Discounts', 'Apply discount codes to merchandise', 'additional-feature'],
    ['calendar-discounts', 'Calendar Discounts', 'Apply discount codes to calendar bookings', 'additional-feature'],
    ['multi-area-discounts', 'Multi Area Discounts', 'Apply discounts across multiple areas', 'additional-feature'],
    ['public-search', 'Public Search', 'Enable public search functionality', 'additional-feature'],
    ['event-types', 'Event Types', 'Categorize events by type', 'additional-feature'],
    ['venues', 'Venues', 'Manage event venues and locations', 'additional-feature'],
    ['pcuk-integration', 'PCUK Integration', 'Integration with Paddle UK system', 'additional-feature'],
  ];

  newCapabilities.forEach(([name, displayName, description, category]) => {
    pgm.sql(`
      INSERT INTO capabilities (name, display_name, description, category, is_active)
      VALUES ('${name}', '${displayName}', '${description}', '${category}', true)
    `);
  });
};

exports.down = (pgm) => {
  // Remove the new capabilities
  const newCapabilityNames = [
    'event-document-management',
    'membership-document-management',
    'registration-document-management',
    'entry-restrictions',
    'entry-discounts',
    'membership-discounts',
    'registration-discounts',
    'merchandise-discounts',
    'calendar-discounts',
    'multi-area-discounts',
    'public-search',
    'event-types',
    'venues',
    'pcuk-integration'
  ];

  newCapabilityNames.forEach((name) => {
    pgm.sql(`DELETE FROM capabilities WHERE name = '${name}'`);
  });

  // Restore the old capabilities
  const oldCapabilities = [
    ['discounts', 'Discounts', 'Create discount codes and promotional offers', 'additional-feature'],
    ['document-uploads', 'Document Uploads', 'Allow file uploads and document management', 'additional-feature'],
    ['email-notifications', 'Email Notifications', 'Send automated email notifications to users', 'additional-feature'],
    ['sms-notifications', 'SMS Notifications', 'Send SMS notifications to users', 'additional-feature'],
  ];

  oldCapabilities.forEach(([name, displayName, description, category]) => {
    pgm.sql(`
      INSERT INTO capabilities (name, display_name, description, category, is_active)
      VALUES ('${name}', '${displayName}', '${description}', '${category}', true)
    `);
  });
};
