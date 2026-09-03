/**
 * The vocabulary of the audit trail.
 *
 * Kept in one file so that "what can be logged" is a list somebody can read,
 * rather than a set of string literals scattered across sixty services. The
 * registry at the bottom is what makes coverage *measurable*: a test asserts
 * every action a service emits is declared here, so a typo becomes a failure
 * rather than an event nobody can filter for.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md.
 */

/** Who acted. Stored rather than derived, so filtering is one indexed column. */
export type ActorUserType =
  | 'super-admin'
  | 'org-admin'
  | 'account-user'
  /** The platform acting on its own behalf — schedulers, webhooks, migrations. */
  | 'system'
  /** Nobody signed in: a failed sign-in, a public page. */
  | 'anonymous';

/** The coarse filter on the screen. `action` is the precise thing. */
export type AuditCategory =
  | 'security'
  | 'events'
  | 'memberships'
  | 'registrations'
  | 'bookings'
  | 'merchandise'
  | 'forms'
  | 'payments'
  | 'settings'
  | 'data'
  | 'platform';

export type AuditOutcome = 'success' | 'failure' | 'denied';

/**
 * A field-level diff, or a whole row for a create or a delete.
 *
 * Field-level for updates because the screen's job is to show *what changed*,
 * and a reader handed two thirty-field objects has to diff them by eye.
 */
export interface AuditChanges {
  [field: string]: { from: unknown; to: unknown } | unknown;
}

export interface AuditContext {
  ip?: string;
  userAgent?: string;
  /** Keycloak session id, so an event can be tied to a row on the Sessions screen. */
  sessionId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface AuditEventInput {
  /**
   * Optional because the registry already knows: an unset category is derived
   * from the action, which keeps the two from ever disagreeing.
   */
  category?: AuditCategory;
  action: string;
  outcome?: AuditOutcome;
  organisationId?: string | null;
  /*
   * `null` as well as absent throughout, because callers compose these from
   * `x ?? null` expressions and the service normalises either to a NULL column.
   */
  entityType?: string | null;
  entityId?: string | null;
  /** The human name of the thing, so a reader never has to resolve an id. */
  entityLabel?: string | null;
  changes?: AuditChanges | null;
  context?: AuditContext;
  /** Overrides the actor taken from the request. Used by system actions. */
  actor?: AuditActor;
}

export interface AuditActor {
  keycloakUserId?: string | null;
  userType: ActorUserType;
  display?: string | null;
  email?: string | null;
}

export interface AuditEvent {
  id: string;
  occurredAt: Date;
  actorKeycloakUserId: string | null;
  actorUserType: ActorUserType;
  actorDisplay: string | null;
  actorEmail: string | null;
  organisationId: string | null;
  category: AuditCategory;
  action: string;
  outcome: AuditOutcome;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  changes: AuditChanges | null;
  context: AuditContext | null;
}

/**
 * Every action the platform may record.
 *
 * Grouped by category, and deliberately explicit: a reader filtering the log
 * picks from this list, so an action that is not here cannot be found on
 * purpose — only stumbled over.
 */
export const AUDIT_ACTIONS = {
  security: [
    'auth.login',
    'auth.logout',
    'auth.login-failed',
    'auth.password-changed',
    'auth.password-reset-requested',
    'auth.email-change-requested',
    'auth.email-changed',
    'auth.session-revoked',
    'auth.sessions-revoked-all',
    'access.denied',
    'role.created',
    'role.updated',
    'role.deleted',
    'role.assigned',
    'role.removed',
    'user.org-admin-created',
    'user.org-admin-updated',
    'user.org-admin-deleted',
    'user.account-created',
    'user.account-updated',
    'user.account-deleted',
    'user.invited',
    'user.registered',
    'user.registration-approved',
    'user.registration-rejected',
    'account_user.registered',
  ],
  platform: [
    'organisation.created',
    'organisation.updated',
    'organisation.deleted',
    'organisation-type.created',
    'organisation-type.updated',
    'organisation-type.deleted',
    'organisation-type.logo-changed',
    'capability.granted',
    'capability.revoked',
    'post.created',
    'post.updated',
    'post.deleted',
    'post.reordered',
  ],
  settings: [
    /*
     * A club's own notices to its members. Filed under settings rather than
     * platform: `post.*` is the super admin writing to everybody signing in to
     * the product, and these are one club writing to its own members — a very
     * different power, and one an organisation's audit log should show.
     */
    'announcement.created',
    'announcement.updated',
    'announcement.deleted',
    'settings.organisation-updated',
    'settings.branding-updated',
    'settings.payment-updated',
    'settings.email-template-updated',
    'settings.registration-updated',
  ],
  events: [
    'event.created',
    'event.updated',
    'event.deleted',
    'activity.created',
    'activity.updated',
    'activity.deleted',
    'venue.created',
    'venue.updated',
    'venue.deleted',
    'event-type.created',
    'event-type.updated',
    'event-type.deleted',
    'entry.form-opened',
    'entry.form-submitted',
    'entry.added-to-basket',
    'entry.removed-from-basket',
    'entry.created',
    'entry.cancelled',
    /*
     * Handing somebody the right to admit people at a gate, and taking it back.
     * A short-lived credential nobody has to remember to revoke still has to be
     * a thing the club can see it created.
     */
    'ticket-scanning.session-created',
    'ticket-scanning.session-revoked',
  ],
  memberships: [
    'membership-type.created',
    'membership-type.updated',
    'membership-type.deleted',
    'membership.applied',
    'membership.added-to-basket',
    'membership.created',
    'membership.approved',
    'membership.rejected',
    'membership.renewed',
    'membership.updated',
    'membership.deleted',
  ],
  registrations: [
    'registration-type.created',
    'registration-type.updated',
    'registration-type.deleted',
    'registration.submitted',
    'registration.added-to-basket',
    'registration.approved',
    'registration.rejected',
  ],
  bookings: [
    'calendar.created',
    'calendar.updated',
    'calendar.deleted',
    'booking.added-to-basket',
    'booking.created',
    'booking.cancelled',
  ],
  merchandise: [
    'merchandise.created',
    'merchandise.updated',
    'merchandise.deleted',
    'merchandise.added-to-basket',
    'order.placed',
    'order.status-changed',
  ],
  forms: [
    'form.created',
    'form.updated',
    'form.deleted',
    /*
     * A club correcting what a member wrote — a pony's name spelled wrong, a
     * date a year out. Filed under forms rather than events because what
     * changed is the submission; the entry itself is untouched.
     */
    'entry.answers-corrected',
    'field.created',
    'field.updated',
    'field.deleted',
  ],
  payments: [
    'checkout.started',
    'payment.method-selected',
    'payment.method-changed',
    'payment.succeeded',
    'payment.failed',
    'refund.issued',
    'offline-payment.recorded',
    'offline-payment.receipt-undone',
    'lodgement.viewed',
    'lodgement.detail-viewed',
  ],
  data: ['report.viewed', 'export.downloaded'],
} as const satisfies Record<AuditCategory, readonly string[]>;

/** Flat set, for the coverage test and for validating an action on write. */
export const ALL_AUDIT_ACTIONS: ReadonlySet<string> = new Set(
  Object.values(AUDIT_ACTIONS).flat() as string[]
);

/** The category an action belongs to, derived from the registry above. */
export const CATEGORY_FOR_ACTION: ReadonlyMap<string, AuditCategory> = new Map(
  Object.entries(AUDIT_ACTIONS).flatMap(([category, actions]) =>
    (actions as readonly string[]).map((action) => [action, category as AuditCategory])
  )
);
