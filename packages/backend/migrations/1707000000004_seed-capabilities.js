/**
 * Migration: Seed Capabilities
 * 
 * This migration seeds the capabilities table with predefined capabilities
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  const capabilities = [
    // Core Services
    ['event-management', 'Event Management', 'Manage events, activities, and registrations', 'core-service'],
    ['memberships', 'Memberships', 'Manage membership types and subscriptions', 'core-service'],
    ['merchandise', 'Merchandise', 'Sell merchandise and club gear online', 'core-service'],
    ['calendar-bookings', 'Calendar Bookings', 'Time slot booking and facility management', 'core-service'],
    ['registrations', 'Registrations', 'Custom registration forms and submissions', 'core-service'],
    
    // Additional Features
    ['event-ticketing', 'Event Ticketing', 'Generate and manage event tickets', 'additional-feature'],
    ['payment-processing', 'Payment Processing', 'Accept online payments and manage transactions', 'additional-feature'],
    ['reporting', 'Reporting & Analytics', 'Generate reports and view analytics', 'additional-feature'],
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

  capabilities.forEach(([name, displayName, description, category]) => {
    pgm.sql(`
      INSERT INTO capabilities (name, display_name, description, category, is_active)
      VALUES ('${name}', '${displayName}', '${description}', '${category}', true)
    `);
  });
};

exports.down = (pgm) => {
  pgm.sql('DELETE FROM capabilities');
};
