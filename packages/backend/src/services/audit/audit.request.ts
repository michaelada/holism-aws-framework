import type { Request } from 'express';
import type { AuditQuery } from './audit.query';

/**
 * The audit filters, read off a query string.
 *
 * Lives with the query layer rather than in the router, because both mount
 * points need it — the platform one and the organisation-scoped one — and
 * importing a *router* to reuse a helper executes that router's route
 * definitions in every consumer. That is not hypothetical: it pulled
 * `requireRole` into a suite that mocks the auth middleware with only the
 * function it uses, and took the whole suite down with
 * "requireRole is not a function".
 */
/** Repeated query parameters arrive as a string or an array; normalise both. */
const list = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined;
  const values = Array.isArray(value) ? value : [value];
  const cleaned = values.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return cleaned.length ? cleaned : undefined;
};

const date = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/** The filters, read from the query string. Shared by both mount points. */
export function queryFromRequest(req: Request, organisationId: string | 'all'): AuditQuery {
  return {
    organisationId,
    actorKeycloakUserId:
      typeof req.query.actor === 'string' ? req.query.actor : undefined,
    actorUserType: list(req.query.userType) as any,
    category: list(req.query.category) as any,
    action: list(req.query.action),
    outcome: list(req.query.outcome) as any,
    entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
    entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
    from: date(req.query.from),
    to: date(req.query.to),
    search: typeof req.query.q === 'string' ? req.query.q : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
  };
}

