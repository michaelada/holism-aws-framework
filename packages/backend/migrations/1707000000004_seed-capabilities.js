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
    ['discounts', 'Discounts', 'Create discount codes and promotional offers', 'additional-feature'],
    ['document-uploads', 'Document Uploads', 'Allow file uploads and document management', 'additional-feature'],
    ['event-ticketing', 'Event Ticketing', 'Generate and manage event tickets', 'additional-feature'],
    ['payment-processing', 'Payment Processing', 'Accept online payments and manage transactions', 'additional-feature'],
    ['email-notifications', 'Email Notifications', 'Send automated email notifications to users', 'additional-feature'],
    ['sms-notifications', 'SMS Notifications', 'Send SMS notifications to users', 'additional-feature'],
    ['reporting', 'Reporting & Analytics', 'Generate reports and view analytics', 'additional-feature'],
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
