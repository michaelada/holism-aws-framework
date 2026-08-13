import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { logger } from '../config/logger';
import {
  accountOrganisationService,
  AccountMembership,
  MembershipDenial,
} from '../services/account-organisation.service';

/**
 * Authorisation for the account-user application.
 *
 * The org-admin equivalent, `loadOrganisationCapabilities`, resolves a single
 * organisation from the token and requires `user_type = 'org-admin'`. An
 * account user fails that lookup by design, and may belong to several
 * organisations at once — so the organisation comes from the URL and is checked
 * against their membership of *that* organisation specifically.
 *
 * Never trust an organisation id from the client: the code in the path is
 * resolved to an id here, and route handlers use `req.account.organisationId`
 * rather than anything the caller supplied.
 */

export interface AccountRequest extends AuthenticatedRequest {
  account?: AccountMembership;
}

/** HTTP status for each refusal, so the client can tell them apart. */
const DENIAL_STATUS: Record<MembershipDenial, number> = {
  ORGANISATION_UNAVAILABLE: 404,
  NOT_CONNECTED: 403,
  PENDING_APPROVAL: 403,
  REGISTRATION_REJECTED: 403,
  ACCOUNT_INACTIVE: 403,
};

const DENIAL_MESSAGE: Record<MembershipDenial, string> = {
  ORGANISATION_UNAVAILABLE: 'That organisation could not be found',
  NOT_CONNECTED: 'You are not registered with this organisation',
  PENDING_APPROVAL: 'Your registration is waiting for approval',
  REGISTRATION_REJECTED: 'Your registration was not approved',
  ACCOUNT_INACTIVE: 'Your account with this organisation is not active',
};

/**
 * Resolve the organisation in the path and confirm the caller belongs to it.
 *
 * Must run after `authenticateToken()`. On success attaches `req.account`.
 *
 * The refusal carries a machine-readable `code` because the account
 * application shows a different screen for each: "not connected" offers
 * registration (A6), "pending approval" shows the waiting screen (A8). A bare
 * 403 would collapse them into one dead end.
 */
export function resolveAccountOrganisation(paramName = 'orgCode') {
  return async (
    req: AccountRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const urlCode = req.params[paramName];
      if (!urlCode) {
        res.status(400).json({
          error: {
            code: 'ORGANISATION_REQUIRED',
            message: 'No organisation was specified',
          },
        });
        return;
      }

      const result = await accountOrganisationService.resolveMembership(
        req.user.userId,
        urlCode
      );

      if (!result.ok) {
        res.status(DENIAL_STATUS[result.reason]).json({
          error: {
            code: result.reason,
            message: DENIAL_MESSAGE[result.reason],
            urlCode,
          },
        });
        return;
      }

      req.account = result.membership;
      next();
    } catch (error) {
      logger.error('Error resolving account organisation:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to resolve organisation',
        },
      });
    }
  };
}

/**
 * Gate a route on the organisation having a capability enabled.
 *
 * Mirrors `requireCapability` for org admins, but reads the capabilities
 * resolved onto `req.account` rather than doing its own lookup. Must run after
 * `resolveAccountOrganisation()`.
 *
 * Passing several capabilities means *any* of them is enough — an area such as
 * "My Entries & Bookings" is reachable with either events or calendar bookings.
 */
export function requireAccountCapability(capabilities: string | string[]) {
  const required = Array.isArray(capabilities) ? capabilities : [capabilities];

  return (req: AccountRequest, res: Response, next: NextFunction): void => {
    if (!req.account) {
      // A programming error rather than a client one: the route is misordered.
      logger.error('requireAccountCapability used before resolveAccountOrganisation');
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Organisation not resolved' },
      });
      return;
    }

    const enabled = req.account.capabilities;
    if (!required.some((capability) => enabled.includes(capability))) {
      res.status(403).json({
        error: {
          code: 'CAPABILITY_NOT_ENABLED',
          message: 'This area is not available for this organisation',
          required,
        },
      });
      return;
    }

    next();
  };
}
