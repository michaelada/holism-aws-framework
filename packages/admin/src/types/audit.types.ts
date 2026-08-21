/** Mirrors the server's `AuditEvent`. See docs/AUDIT_TRAIL_AND_SESSIONS.md. */
export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorKeycloakUserId: string | null;
  actorUserType: 'super-admin' | 'org-admin' | 'account-user' | 'system' | 'anonymous';
  actorDisplay: string | null;
  actorEmail: string | null;
  organisationId: string | null;
  organisationName: string | null;
  category: string;
  action: string;
  outcome: 'success' | 'failure' | 'denied';
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  changes: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
}

export interface AuditPage {
  events: AuditEvent[];
  /** Keyset cursor. Null when there is nothing older. */
  nextCursor: string | null;
}

export interface AuditFilterOptions {
  categories: string[];
  actions: string[];
  userTypes: string[];
  actors: Array<{ keycloakUserId: string; display: string | null; email: string | null }>;
  /** The oldest event on record, so "no matches" can be told from "not logged then". */
  earliest: string | null;
}

export interface AuditQueryParams {
  q?: string;
  organisationId?: string;
  actor?: string;
  userType?: string[];
  category?: string[];
  action?: string[];
  outcome?: string[];
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

/** A live Keycloak session, decorated from our own tables. */
export interface LiveSession {
  sessionId: string;
  keycloakUserId: string;
  username: string | null;
  email: string | null;
  application: string;
  ipAddress: string | null;
  startedAt: string | null;
  lastAccessAt: string | null;
  displayName: string | null;
  userType: 'super-admin' | 'org-admin' | 'account-user' | 'unknown';
  organisationId: string | null;
  organisationName: string | null;
}

/** Whether any audit writes have failed since the process started. */
export interface AuditHealth {
  failures: number;
  lastFailureAt: string | null;
  queued: number;
}
