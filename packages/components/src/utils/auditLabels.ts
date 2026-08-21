/**
 * Turning an audit record's internal names into something a person reads.
 *
 * The trail stores stable identifiers — `event.updated`, `openDateEntries` —
 * because they have to survive renames, be filtered on, and mean the same thing
 * in six languages. That is right for storage and wrong for a screen: a club
 * secretary reading their own audit log should see "Event updated", not a
 * dotted identifier from our schema.
 *
 * ## Why the English lives here
 *
 * There are two viewers. The org-admin is translated into six locales; Platform
 * Admin is English only. Keeping two label lists would guarantee they drift, so
 * this is the single English source: Platform Admin uses it directly, and the
 * org-admin passes each string as `defaultValue` to `t()`, so a locale that has
 * not translated an action yet shows readable English rather than a key.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §3.
 */

/**
 * Every action in the registry, in the words a reader would use.
 *
 * Written out rather than composed from the entity and the verb. Composition
 * would be shorter and would produce "Membership type deleted" correctly and
 * "Auth login-failed" absurdly — and it does not survive translation, where
 * word order is not ours to choose.
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Security
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.login-failed': 'Failed sign-in',
  'auth.password-changed': 'Password changed',
  'auth.password-reset-requested': 'Password reset requested',
  'auth.email-change-requested': 'Email change requested',
  'auth.email-changed': 'Email changed',
  'auth.session-revoked': 'Session ended by an administrator',
  'auth.sessions-revoked-all': 'Signed out of all sessions',
  'access.denied': 'Access refused',

  // Roles and users
  'role.created': 'Role created',
  'role.updated': 'Role updated',
  'role.deleted': 'Role deleted',
  'role.assigned': 'Role given to a user',
  'role.removed': 'Role taken from a user',
  'user.org-admin-created': 'Administrator created',
  'user.org-admin-updated': 'Administrator updated',
  'user.org-admin-deleted': 'Administrator deleted',
  'user.account-created': 'Account user created',
  'user.account-updated': 'Account user updated',
  'user.account-deleted': 'Account user deleted',
  'user.invited': 'Invitation sent',
  'user.registered': 'User registered',
  'user.registration-approved': 'Registration approved',
  'user.registration-rejected': 'Registration rejected',
  'account_user.registered': 'Account created',

  // Platform
  'organisation.created': 'Organisation created',
  'organisation.updated': 'Organisation updated',
  'organisation.deleted': 'Organisation deleted',
  'organisation-type.created': 'Organisation type created',
  'organisation-type.updated': 'Organisation type updated',
  'organisation-type.deleted': 'Organisation type deleted',
  'organisation-type.logo-changed': 'Organisation type logo changed',
  'capability.granted': 'Capability granted',
  'capability.revoked': 'Capability withdrawn',
  'post.created': 'Announcement created',
  'post.updated': 'Announcement updated',
  'post.deleted': 'Announcement deleted',
  'post.reordered': 'Announcements reordered',

  // Settings
  'settings.organisation-updated': 'Organisation details changed',
  'settings.branding-updated': 'Branding changed',
  'settings.payment-updated': 'Payment settings changed',
  'settings.email-template-updated': 'Email template changed',
  'settings.registration-updated': 'Registration settings changed',

  // Events
  'event.created': 'Event created',
  'event.updated': 'Event updated',
  'event.deleted': 'Event deleted',
  'activity.created': 'Activity created',
  'activity.updated': 'Activity updated',
  'activity.deleted': 'Activity deleted',
  'venue.created': 'Venue created',
  'venue.updated': 'Venue updated',
  'venue.deleted': 'Venue deleted',
  'event-type.created': 'Event type created',
  'event-type.updated': 'Event type updated',
  'event-type.deleted': 'Event type deleted',
  'entry.form-opened': 'Entry form opened',
  'entry.form-submitted': 'Entry form submitted',
  'entry.added-to-basket': 'Entry added to basket',
  'entry.removed-from-basket': 'Entry removed from basket',
  'entry.created': 'Entry created',
  'entry.cancelled': 'Entry cancelled',

  // Memberships
  'membership-type.created': 'Membership type created',
  'membership-type.updated': 'Membership type updated',
  'membership-type.deleted': 'Membership type deleted',
  'membership.applied': 'Membership applied for',
  'membership.added-to-basket': 'Membership added to basket',
  'membership.created': 'Member added',
  'membership.approved': 'Membership approved',
  'membership.rejected': 'Membership rejected',
  'membership.renewed': 'Membership renewed',
  'membership.updated': 'Member updated',
  'membership.deleted': 'Member removed',

  // Registrations
  'registration-type.created': 'Registration type created',
  'registration-type.updated': 'Registration type updated',
  'registration-type.deleted': 'Registration type deleted',
  'registration.submitted': 'Registration submitted',
  'registration.added-to-basket': 'Registration added to basket',
  'registration.approved': 'Registration approved',
  'registration.rejected': 'Registration rejected',

  // Bookings
  'calendar.created': 'Calendar created',
  'calendar.updated': 'Calendar updated',
  'calendar.deleted': 'Calendar deleted',
  'booking.added-to-basket': 'Booking added to basket',
  'booking.created': 'Booking made',
  'booking.cancelled': 'Booking cancelled',

  // Merchandise
  'merchandise.created': 'Merchandise created',
  'merchandise.updated': 'Merchandise updated',
  'merchandise.deleted': 'Merchandise deleted',
  'merchandise.added-to-basket': 'Merchandise added to basket',
  'order.placed': 'Order placed',
  'order.status-changed': 'Order status changed',

  // Forms
  'form.created': 'Form created',
  'form.updated': 'Form updated',
  'form.deleted': 'Form deleted',
  'field.created': 'Form field created',
  'field.updated': 'Form field updated',
  'field.deleted': 'Form field deleted',

  // Payments
  'checkout.started': 'Checkout started',
  'payment.method-selected': 'Payment method chosen',
  'payment.method-changed': 'Payment method changed',
  'payment.succeeded': 'Payment succeeded',
  'payment.failed': 'Payment failed',
  'refund.issued': 'Refund issued',
  'offline-payment.recorded': 'Offline payment recorded',
  'lodgement.viewed': 'Lodgements viewed',
  'lodgement.detail-viewed': 'Lodgement opened',

  // Data
  'report.viewed': 'Report viewed',
  'export.downloaded': 'Export downloaded',
};

/**
 * Field names the generic humaniser gets wrong or leaves unhelpfully terse.
 *
 * Only the ones worth overriding: `entryFee` humanises to "Entry fee" on its
 * own and needs nothing here.
 */
export const AUDIT_FIELD_LABELS: Record<string, string> = {
  openDateEntries: 'Entries open',
  entriesClosingDate: 'Entries close',
  limitEntries: 'Limit number of entries',
  entriesLimit: 'Maximum entries',
  addConfirmationMessage: 'Add message to confirmation email',
  confirmationMessage: 'Confirmation email message',
  emailNotifications: 'Notification email addresses',
  eventOwner: 'Event owner',
  eventTypeId: 'Event type',
  venueId: 'Venue',
  organisationId: 'Organisation',
  organizationId: 'Organisation',
  applicationFormId: 'Application form',
  discountIds: 'Discounts',
  supportedPaymentMethods: 'Payment methods accepted',
  showOnOrganisationPage: 'Show on the club page',
  showOnPlatformPage: 'Show on the platform page',
  showPublicly: 'Show publicly',
  isSensitive: 'Sensitive answer',
  useTermsAndConditions: 'Use terms and conditions',
  termsAndConditions: 'Terms and conditions',
  handlingFeeIncluded: 'Handling fee included',
  allowSpecifyQuantity: 'Allow a quantity to be chosen',
  limitApplicants: 'Limit applicants',
  applicantsLimit: 'Maximum applicants',
  entryEligibility: 'Who may enter',
  chequePaymentInstructions: 'Cheque payment instructions',
  primaryColor: 'Primary colour',
  secondaryColor: 'Secondary colour',
  logoS3Key: 'Logo',
  logoUrl: 'Logo address',
  keycloakUserId: 'Sign-in account',
  datatype: 'Field type',
};

/**
 * `openDateEntries` → `Open date entries`.
 *
 * The fallback for everything not named above, and for fields on entities
 * nobody has curated yet. Splits camelCase and snake_case, trims the `Id`
 * suffix that means nothing to a reader, and capitalises the first word only —
 * title case on a whole sentence reads like a headline.
 */
export function humaniseFieldName(field: string): string {
  const words = field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 1 && /^ids?$/i.test(words[words.length - 1])) words.pop();
  if (!words.length) return field;

  const sentence = words.join(' ').toLowerCase();
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** The label for an action, or a readable fallback if it is not in the registry. */
export function auditActionLabel(action: string): string {
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];

  // An unregistered action is a bug elsewhere, not a reason to show nothing.
  const [entity, verb] = action.split('.');
  return verb ? `${humaniseFieldName(entity)}: ${humaniseFieldName(verb)}` : humaniseFieldName(action);
}

/** The label for a field, or a readable fallback. */
export function auditFieldLabel(field: string): string {
  return AUDIT_FIELD_LABELS[field] ?? humaniseFieldName(field);
}
