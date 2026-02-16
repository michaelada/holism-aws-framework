/**
 * Migration: Cleanup Organization Capabilities
 * 
 * This migration removes references to deleted capabilities from existing organizations.
 * It removes: discounts, document-uploads, email-notifications, sms-notifications
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Remove deleted capability references from organizations.enabled_capabilities
  pgm.sql(`
    UPDATE organizations
    SET enabled_capabilities = (
      SELECT COALESCE(json_agg(capability), '[]'::json)
      FROM json_array_elements_text(enabled_capabilities::json) AS capability
      WHERE capability NOT IN ('discounts', 'document-uploads', 'email-notifications', 'sms-notifications')
    )
    WHERE enabled_capabilities::jsonb ?| ARRAY['discounts', 'document-uploads', 'email-notifications', 'sms-notifications']
  `);
};

exports.down = (pgm) => {
  // No rollback - we cannot restore the old capability references
  // as they were removed from the capabilities table
  pgm.sql('SELECT 1');
};
