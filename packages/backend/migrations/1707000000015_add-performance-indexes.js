/**
 * Migration: Add Performance Indexes
 * 
 * This migration adds database indexes for frequently queried fields
 * to improve API performance across all modules.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Events module indexes
  pgm.createIndex('events', ['organization_id', 'status'], {
    name: 'idx_events_org_status',
  });
  pgm.createIndex('events', ['organization_id', 'start_date'], {
    name: 'idx_events_org_start_date',
  });
  pgm.createIndex('events', 'created_at', {
    name: 'idx_events_created_at',
  });

  pgm.createIndex('event_activities', ['event_id', 'show_publicly'], {
    name: 'idx_event_activities_event_public',
  });

  pgm.createIndex('event_entries', ['event_id', 'payment_status'], {
    name: 'idx_event_entries_event_payment',
  });
  pgm.createIndex('event_entries', ['user_id', 'entry_date'], {
    name: 'idx_event_entries_user_date',
  });
  pgm.createIndex('event_entries', 'created_at', {
    name: 'idx_event_entries_created_at',
  });

  // Membership module indexes
  pgm.createIndex('membership_types', ['organization_id', 'membership_status'], {
    name: 'idx_membership_types_org_status',
  });
  pgm.createIndex('membership_types', 'membership_type_category', {
    name: 'idx_membership_types_category',
  });

  pgm.createIndex('members', ['organization_id', 'status'], {
    name: 'idx_members_org_status',
  });
  pgm.createIndex('members', ['organization_id', 'date_last_renewed'], {
    name: 'idx_members_org_renewed',
  });
  pgm.createIndex('members', ['organization_id', 'valid_until'], {
    name: 'idx_members_org_valid_until',
  });
  pgm.createIndex('members', ['membership_type_id', 'status'], {
    name: 'idx_members_type_status',
  });
  pgm.createIndex('members', 'processed', {
    name: 'idx_members_processed',
  });
  pgm.createIndex('members', 'created_at', {
    name: 'idx_members_created_at',
  });

  // Merchandise module indexes
  pgm.createIndex('merchandise_types', ['organization_id', 'status'], {
    name: 'idx_merchandise_types_org_status',
  });

  pgm.createIndex('merchandise_orders', ['organization_id', 'order_status'], {
    name: 'idx_merchandise_orders_org_status',
  });
  pgm.createIndex('merchandise_orders', ['organization_id', 'payment_status'], {
    name: 'idx_merchandise_orders_org_payment',
  });
  pgm.createIndex('merchandise_orders', ['user_id', 'order_date'], {
    name: 'idx_merchandise_orders_user_date',
  });
  pgm.createIndex('merchandise_orders', 'created_at', {
    name: 'idx_merchandise_orders_created_at',
  });

  // Calendar module indexes
  pgm.createIndex('calendars', ['organization_id', 'status'], {
    name: 'idx_calendars_org_status',
  });

  pgm.createIndex('bookings', ['calendar_id', 'booking_status'], {
    name: 'idx_bookings_calendar_status',
  });
  pgm.createIndex('bookings', ['calendar_id', 'booking_date'], {
    name: 'idx_bookings_calendar_date',
  });
  pgm.createIndex('bookings', ['user_id', 'booking_date'], {
    name: 'idx_bookings_user_date',
  });
  pgm.createIndex('bookings', 'created_at', {
    name: 'idx_bookings_created_at',
  });

  // Registration module indexes
  pgm.createIndex('registration_types', ['organization_id', 'registration_status'], {
    name: 'idx_registration_types_org_status',
  });

  pgm.createIndex('registrations', ['organization_id', 'status'], {
    name: 'idx_registrations_org_status',
  });
  pgm.createIndex('registrations', ['registration_type_id', 'status'], {
    name: 'idx_registrations_type_status',
  });
  pgm.createIndex('registrations', 'processed', {
    name: 'idx_registrations_processed',
  });
  pgm.createIndex('registrations', 'created_at', {
    name: 'idx_registrations_created_at',
  });

  // Ticketing module indexes
  pgm.createIndex('ticketing_events', ['organization_id', 'status'], {
    name: 'idx_ticketing_events_org_status',
  });
  pgm.createIndex('ticketing_events', ['organization_id', 'event_date'], {
    name: 'idx_ticketing_events_org_date',
  });

  pgm.createIndex('tickets', ['ticketing_event_id', 'ticket_status'], {
    name: 'idx_tickets_event_status',
  });
  pgm.createIndex('tickets', ['user_id', 'created_at'], {
    name: 'idx_tickets_user_created',
  });
  pgm.createIndex('tickets', 'qr_code', {
    name: 'idx_tickets_qr_code',
  });

  // Application forms and submissions indexes
  pgm.createIndex('application_forms', ['organization_id', 'status'], {
    name: 'idx_application_forms_org_status',
  });
  pgm.createIndex('application_forms', 'created_at', {
    name: 'idx_application_forms_created_at',
  });

  pgm.createIndex('form_submissions', ['organization_id', 'context_type'], {
    name: 'idx_form_submissions_org_context',
  });
  pgm.createIndex('form_submissions', ['context_type', 'context_id'], {
    name: 'idx_form_submissions_context',
  });
  pgm.createIndex('form_submissions', 'created_at', {
    name: 'idx_form_submissions_created_at',
  });

  // Payment module indexes
  pgm.createIndex('payments', ['organization_id', 'payment_status'], {
    name: 'idx_payments_org_status',
  });
  pgm.createIndex('payments', ['organization_id', 'payment_date'], {
    name: 'idx_payments_org_date',
  });
  pgm.createIndex('payments', ['user_id', 'payment_date'], {
    name: 'idx_payments_user_date',
  });
  pgm.createIndex('payments', 'created_at', {
    name: 'idx_payments_created_at',
  });

  // Reports module indexes
  pgm.createIndex('reports', ['organization_id', 'report_type'], {
    name: 'idx_reports_org_type',
  });
  pgm.createIndex('reports', 'created_at', {
    name: 'idx_reports_created_at',
  });

  // Composite indexes for common query patterns
  pgm.createIndex('organization_users', ['organization_id', 'user_type', 'status'], {
    name: 'idx_org_users_org_type_status',
  });

  // JSONB indexes for enabled_capabilities (GIN index for array containment queries)
  pgm.sql(`
    CREATE INDEX idx_organizations_enabled_capabilities 
    ON organizations USING GIN (enabled_capabilities);
  `);

  // JSONB indexes for capability_permissions
  pgm.sql(`
    CREATE INDEX idx_org_admin_roles_capability_permissions 
    ON organization_admin_roles USING GIN (capability_permissions);
  `);
};

exports.down = (pgm) => {
  // Drop all indexes in reverse order
  pgm.sql('DROP INDEX IF EXISTS idx_org_admin_roles_capability_permissions');
  pgm.sql('DROP INDEX IF EXISTS idx_organizations_enabled_capabilities');
  
  pgm.dropIndex('organization_users', 'idx_org_users_org_type_status');
  
  pgm.dropIndex('reports', 'idx_reports_created_at');
  pgm.dropIndex('reports', 'idx_reports_org_type');
  
  pgm.dropIndex('payments', 'idx_payments_created_at');
  pgm.dropIndex('payments', 'idx_payments_user_date');
  pgm.dropIndex('payments', 'idx_payments_org_date');
  pgm.dropIndex('payments', 'idx_payments_org_status');
  
  pgm.dropIndex('form_submissions', 'idx_form_submissions_created_at');
  pgm.dropIndex('form_submissions', 'idx_form_submissions_context');
  pgm.dropIndex('form_submissions', 'idx_form_submissions_org_context');
  
  pgm.dropIndex('application_forms', 'idx_application_forms_created_at');
  pgm.dropIndex('application_forms', 'idx_application_forms_org_status');
  
  pgm.dropIndex('tickets', 'idx_tickets_qr_code');
  pgm.dropIndex('tickets', 'idx_tickets_user_created');
  pgm.dropIndex('tickets', 'idx_tickets_event_status');
  
  pgm.dropIndex('ticketing_events', 'idx_ticketing_events_org_date');
  pgm.dropIndex('ticketing_events', 'idx_ticketing_events_org_status');
  
  pgm.dropIndex('registrations', 'idx_registrations_created_at');
  pgm.dropIndex('registrations', 'idx_registrations_processed');
  pgm.dropIndex('registrations', 'idx_registrations_type_status');
  pgm.dropIndex('registrations', 'idx_registrations_org_status');
  
  pgm.dropIndex('registration_types', 'idx_registration_types_org_status');
  
  pgm.dropIndex('bookings', 'idx_bookings_created_at');
  pgm.dropIndex('bookings', 'idx_bookings_user_date');
  pgm.dropIndex('bookings', 'idx_bookings_calendar_date');
  pgm.dropIndex('bookings', 'idx_bookings_calendar_status');
  
  pgm.dropIndex('calendars', 'idx_calendars_org_status');
  
  pgm.dropIndex('merchandise_orders', 'idx_merchandise_orders_created_at');
  pgm.dropIndex('merchandise_orders', 'idx_merchandise_orders_user_date');
  pgm.dropIndex('merchandise_orders', 'idx_merchandise_orders_org_payment');
  pgm.dropIndex('merchandise_orders', 'idx_merchandise_orders_org_status');
  
  pgm.dropIndex('merchandise_types', 'idx_merchandise_types_org_status');
  
  pgm.dropIndex('members', 'idx_members_created_at');
  pgm.dropIndex('members', 'idx_members_processed');
  pgm.dropIndex('members', 'idx_members_type_status');
  pgm.dropIndex('members', 'idx_members_org_valid_until');
  pgm.dropIndex('members', 'idx_members_org_renewed');
  pgm.dropIndex('members', 'idx_members_org_status');
  
  pgm.dropIndex('membership_types', 'idx_membership_types_category');
  pgm.dropIndex('membership_types', 'idx_membership_types_org_status');
  
  pgm.dropIndex('event_entries', 'idx_event_entries_created_at');
  pgm.dropIndex('event_entries', 'idx_event_entries_user_date');
  pgm.dropIndex('event_entries', 'idx_event_entries_event_payment');
  
  pgm.dropIndex('event_activities', 'idx_event_activities_event_public');
  
  pgm.dropIndex('events', 'idx_events_created_at');
  pgm.dropIndex('events', 'idx_events_org_start_date');
  pgm.dropIndex('events', 'idx_events_org_status');
};
