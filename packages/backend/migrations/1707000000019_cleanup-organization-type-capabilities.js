/**
 * Migration: Cleanup Organization Type Capabilities
 * 
 * This migration removes references to deleted capabilities from existing organization types.
 * It removes: discounts, document-uploads, email-notifications, sms-notifications
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Remove deleted capability references from organization_types.default_capabilities
  pgm.sql(`
    UPDATE organization_types
    SET default_capabilities = (
      SELECT json_agg(capability)
      FROM json_array_elements_text(default_capabilities::json) AS capability
      WHERE capability NOT IN ('discounts', 'document-uploads', 'email-notifications', 'sms-notifications')
    )
    WHERE default_capabilities::jsonb ?| ARRAY['discounts', 'document-uploads', 'email-notifications', 'sms-notifications']
  `);
};

exports.down = (pgm) => {
  // No rollback - we cannot restore the old capability references
  // as they were removed from the capabilities table
  pgm.sql('SELECT 1');
};
