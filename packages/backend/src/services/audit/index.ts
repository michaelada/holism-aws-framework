/**
 * The audit trail. See docs/AUDIT_TRAIL_AND_SESSIONS.md.
 *
 * One entry point, so a caller writes `import { audit } from '…/services/audit'`
 * and gets the recorder, the diff helpers and the vocabulary together.
 */
export { auditService as audit, actorFromRequest, contextFromRequest } from './audit.service';
export * from './audit.types';
export { auditQueryService, type AuditQuery, type AuditPage } from './audit.query';
export { queryFromRequest } from './audit.request';
export { diff, created, deleted, redactObject, redactValue, REDACTED } from './audit.redaction';
