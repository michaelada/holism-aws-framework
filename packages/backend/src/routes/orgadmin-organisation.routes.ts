import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errors';
import { organizationPaymentSettingsService } from '../services/organization-payment-settings.service';
import { paymentService } from '../services/payment.service';
import { stripeConnectService } from '../services/stripe-connect.service';
import { isAllowedRedirectUrl } from '../utils/allowed-origins';
import { organizationBrandingService } from '../services/organization-branding.service';
import { organizationEmailTemplatesService } from '../services/organization-email-templates.service';
import { accountRegistrationService } from '../services/account-registration.service';

const router = Router();

/**
 * Resolve the organisation that the authenticated org-admin belongs to.
 * Returns null if the user is not an active org-admin of any organisation.
 */
async function resolveOrganisationId(keycloakUserId: string): Promise<string | null> {
  const result = await db.query(
    `SELECT organization_id FROM organization_users
     WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
     LIMIT 1`,
    [keycloakUserId]
  );
  return result.rows.length > 0 ? result.rows[0].organization_id : null;
}

/**
 * Wrap a handler so it receives the caller's organisation id, with the
 * authentication and org-admin checks applied consistently. Errors carrying a
 * status code (validation failures) are surfaced as-is; anything else becomes a
 * 500 with the supplied message so internals are not leaked to the client.
 */
function withOrganisation(
  failureMessage: string,
  handler: (organisationId: string, req: AuthenticatedRequest, res: Response) => Promise<void>
) {
  return async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const keycloakUserId = req.user?.userId;
      if (!keycloakUserId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const organisationId = await resolveOrganisationId(keycloakUserId);
      if (!organisationId) {
        res.status(403).json({ error: 'User is not an organization administrator' });
        return;
      }

      await handler(organisationId, req, res);
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn(`${failureMessage}: ${error.message}`);
        res.status(error.statusCode).json({ error: error.message, details: error.details });
        return;
      }
      logger.error(`${failureMessage}:`, error);
      res.status(500).json({ error: failureMessage });
    }
  };
}

/**
 * @openapi
 * /api/orgadmin/organisation/payments/offline:
 *   get:
 *     summary: Payments awaiting an offline settlement (I1)
 *     description: >
 *       Cheques and transfers a member has committed to but the club has not yet
 *       recorded as arrived. Until one is recorded, fulfilment holds everything
 *       it bought — a membership is an entitlement that runs for a year, and
 *       granting one before the money arrives gives it away — so this list is
 *       what stands between a member and the thing they paid for.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The outstanding payments, oldest first
 */
router.get(
  '/payments/offline',
  authenticateToken(),
  withOrganisation('Failed to load offline payments', async (organisationId, req, res) => {
    // Settled ones are shown too, so an administrator can find what they just
    // recorded — and undo it.
    const settled = String((req.query as any).settled ?? 'false') === 'true';

    const result = await db.query(
      `SELECT p.id, p.currency, p.payment_status, p.created_at, p.payment_date,
              p.offline_amount, p.card_amount, p.handling_fee,
              p.offline_received_at,
              ou.first_name, ou.last_name, ou.email,
              COALESCE(
                json_agg(
                  json_build_object('description', pt.description, 'fee', pt.fee)
                  ORDER BY pt.created_at
                ) FILTER (WHERE pt.id IS NOT NULL),
                '[]'
              ) AS lines
       FROM payments p
       LEFT JOIN organization_users ou ON ou.id = p.user_id
       LEFT JOIN payment_transactions pt ON pt.payment_id = p.id
       WHERE p.organisation_id = $1
         AND ($2::boolean = TRUE OR p.payment_status = 'awaiting_offline')
         AND ($2::boolean = FALSE OR p.offline_received_at IS NOT NULL)
       GROUP BY p.id, ou.first_name, ou.last_name, ou.email
       ORDER BY p.created_at ASC`,
      [organisationId, settled]
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        memberName: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email,
        memberEmail: row.email,
        currency: row.currency,
        status: row.payment_status,
        placedAt: row.created_at,
        receivedAt: row.offline_received_at ?? null,
        /*
         * The figure to look for on the statement is what the member owes
         * offline, not the order total — a mixed order's card half has already
         * been taken.
         */
        offlineAmount: row.offline_amount ?? 0,
        cardAmount: row.card_amount ?? 0,
        handlingFee: row.handling_fee ?? 0,
        lines: (row.lines ?? []).map((line: any) => ({
          description: line.description ?? '',
          fee: line.fee ?? 0,
        })),
      }))
    );
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/payments/{id}/received:
 *   post:
 *     summary: Record that an offline payment has arrived (I2)
 *     description: >
 *       The step that finishes an offline order. Fulfilment runs immediately
 *       afterwards and its outcome is returned, so the screen can say what the
 *       money actually produced. Idempotent — marking twice creates nothing
 *       twice.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: Recorded, with what fulfilment produced
 *       400:
 *         description: That payment is not awaiting an offline settlement
 *       404:
 *         description: No such payment in this organisation
 */
router.post(
  '/payments/:id/received',
  authenticateToken(),
  withOrganisation('Failed to record the payment', async (organisationId, req, res) => {
    const result = await paymentService.markOfflinePaymentReceived(
      organisationId,
      req.params.id,
      (req as AuthenticatedRequest).user!.userId
    );
    res.json(result);
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/payments/{id}/received:
 *   delete:
 *     summary: Undo a mistaken receipt (I2)
 *     description: >
 *       Available only while the receipt produced nothing. Marking a payment
 *       received creates memberships, orders, bookings and registrations, and
 *       flipping the status back would leave them granted against money the club
 *       never had.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: Back to awaiting settlement
 *       400:
 *         description: Not received, or it has already produced records
 */
router.delete(
  '/payments/:id/received',
  authenticateToken(),
  withOrganisation('Failed to undo the receipt', async (organisationId, req, res) => {
    res.json(await paymentService.undoOfflinePaymentReceived(organisationId, req.params.id));
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/payment-settings:
 *   get:
 *     summary: Get the current organisation's payment settings
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The organisation's payment settings
 */

router.get(
  '/payment-settings',
  authenticateToken(),
  withOrganisation('Failed to load payment settings', async (organisationId, _req, res) => {
    const settings = await organizationPaymentSettingsService.getPaymentSettings(organisationId);
    res.json(settings);
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/payment-settings:
 *   put:
 *     summary: Update the current organisation's payment settings
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The updated payment settings
 */
router.put(
  '/payment-settings',
  authenticateToken(),
  withOrganisation('Failed to update payment settings', async (organisationId, req, res) => {
    const updated = await organizationPaymentSettingsService.updatePaymentSettings(
      organisationId,
      req.body
    );
    res.json(updated);
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/branding-settings:
 *   get:
 *     summary: Get the current organisation's branding settings
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The organisation's logo and colour scheme
 */
router.get(
  '/branding-settings',
  authenticateToken(),
  withOrganisation('Failed to load branding settings', async (organisationId, _req, res) => {
    const settings = await organizationBrandingService.getBrandingSettings(organisationId);
    res.json(settings);
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/branding-settings:
 *   put:
 *     summary: Update the current organisation's branding settings
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The updated branding settings
 *       400:
 *         description: A colour was not a valid hex value
 */
router.put(
  '/branding-settings',
  authenticateToken(),
  withOrganisation('Failed to update branding settings', async (organisationId, req, res) => {
    const updated = await organizationBrandingService.updateBrandingSettings(
      organisationId,
      req.body
    );
    res.json(updated);
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/email-templates:
 *   get:
 *     summary: List the current organisation's email templates
 *     description: >
 *       Returns every template type, using the organisation's override where one
 *       exists and the platform default otherwise.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The organisation's email templates
 */
router.get(
  '/email-templates',
  authenticateToken(),
  withOrganisation('Failed to load email templates', async (organisationId, _req, res) => {
    const templates = await organizationEmailTemplatesService.getEmailTemplates(organisationId);
    res.json(templates);
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/email-templates:
 *   put:
 *     summary: Create or replace one of the current organisation's email templates
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The updated template
 *       400:
 *         description: Unknown template name, or a missing subject or body
 */
router.put(
  '/email-templates',
  authenticateToken(),
  withOrganisation('Failed to update email template', async (organisationId, req, res) => {
    const updated = await organizationEmailTemplatesService.updateEmailTemplate(
      organisationId,
      req.body
    );
    res.json(updated);
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/email-templates/{name}:
 *   delete:
 *     summary: Reset one email template back to the platform default
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The template, restored to its default content
 *       400:
 *         description: Unknown template name
 */
router.delete(
  '/email-templates/:name',
  authenticateToken(),
  withOrganisation('Failed to reset email template', async (organisationId, req, res) => {
    const reset = await organizationEmailTemplatesService.resetEmailTemplate(
      organisationId,
      req.params.name
    );
    res.json(reset);
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/registration-settings:
 *   get:
 *     summary: Whether members may register themselves without approval
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: Registration settings, plus how many people are waiting
 */
router.get(
  '/registration-settings',
  authenticateToken(),
  withOrganisation('Failed to load registration settings', async (organisationId, _req, res) => {
    const [settings, pendingCount] = await Promise.all([
      accountRegistrationService.getSettings(organisationId),
      accountRegistrationService.countPending(organisationId),
    ]);
    res.json({ ...settings, pendingCount });
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/registration-settings:
 *   put:
 *     summary: Turn auto-registration on or off
 *     description: >
 *       Turning it on does not approve anyone already waiting — pass
 *       approvePending to do that as a deliberate, separate act.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The updated settings
 */
router.put(
  '/registration-settings',
  authenticateToken(),
  withOrganisation('Failed to update registration settings', async (organisationId, req, res) => {
    const { approvePending, ...settings } = req.body ?? {};
    const updated = await accountRegistrationService.updateSettings(organisationId, settings);

    let approved = 0;
    if (approvePending) {
      approved = await accountRegistrationService.approveAllPending(
        organisationId,
        req.user?.userId
      );
    }

    res.json({ ...updated, approved });
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/registrations:
 *   get:
 *     summary: Account-user registrations by status
 *     tags: [OrgAdmin]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, rejected, active], default: pending }
 *     responses:
 *       200:
 *         description: Registrations in that state
 */
router.get(
  '/registrations',
  authenticateToken(),
  withOrganisation('Failed to load registrations', async (organisationId, req, res) => {
    const requested = String(req.query.status ?? 'pending');
    const status = ['pending', 'rejected', 'active'].includes(requested)
      ? (requested as 'pending' | 'rejected' | 'active')
      : 'pending';

    const registrations = await accountRegistrationService.listByStatus(
      organisationId,
      status
    );
    res.json({ status, registrations });
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/registrations/{id}/decision:
 *   post:
 *     summary: Approve or reject a registration
 *     description: >
 *       Scoped to the caller's own organisation, so a valid id from elsewhere
 *       cannot be acted on. Any note is recorded in the audit log and is never
 *       shown to the applicant.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The resulting status
 *       400:
 *         description: decision must be approve or reject
 *       404:
 *         description: No such registration in this organisation
 */
router.post(
  '/registrations/:id/decision',
  authenticateToken(),
  withOrganisation('Failed to record the decision', async (organisationId, req, res) => {
    const { decision, note } = req.body ?? {};

    if (decision !== 'approve' && decision !== 'reject') {
      res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
      return;
    }

    const result = await accountRegistrationService.decide(
      organisationId,
      req.params.id,
      decision,
      req.user?.userId,
      note
    );
    res.json(result);
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/stripe-connect:
 *   get:
 *     summary: The organisation's Stripe Connect status
 *     description: >
 *       Whether this club can take card payments yet, and what Stripe is still
 *       waiting for. Refreshed from Stripe on request rather than on every read,
 *       so the settings screen shows current information without putting a
 *       network call in the path of every page load.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The Connect state
 */
router.get(
  '/stripe-connect',
  authenticateToken(),
  withOrganisation('Failed to load the Stripe connection', async (organisationId, _req, res) => {
    const state = await stripeConnectService.refreshState(organisationId);
    res.json({ ...state, platformConfigured: stripeConnectService.isConfigured() });
  })
);

/**
 * @openapi
 * /api/orgadmin/organisation/stripe-connect/onboarding-link:
 *   post:
 *     summary: Start or resume Stripe onboarding
 *     description: >
 *       Creates the connected account on first use and returns a single-use
 *       Stripe onboarding link. The link is minted per request and never
 *       stored — Stripe's account links expire quickly, so a cached one is an
 *       expired one by the time anybody clicks it.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The onboarding URL to redirect the administrator to
 *       400:
 *         description: Stripe is not configured for this platform
 */
router.post(
  '/stripe-connect/onboarding-link',
  authenticateToken(),
  withOrganisation('Failed to start Stripe onboarding', async (organisationId, req, res) => {
    const { returnUrl, refreshUrl } = req.body ?? {};

    if (typeof returnUrl !== 'string' || typeof refreshUrl !== 'string') {
      res.status(400).json({ error: 'returnUrl and refreshUrl are required' });
      return;
    }

    /*
     * Both URLs come from the client, and Stripe will redirect a browser to
     * them — so they are restricted to this deployment's own origin. Without
     * that check this endpoint is an open redirect that an administrator would
     * be walked through by Stripe itself.
     */
    if (!isAllowedRedirectUrl(returnUrl) || !isAllowedRedirectUrl(refreshUrl)) {
      res.status(400).json({
        error:
          'Return URLs must be on an allowed origin. Check ALLOWED_ORIGINS includes the ' +
          'address the admin app is served from.',
      });
      return;
    }

    const link = await stripeConnectService.createOnboardingLink(
      organisationId,
      returnUrl,
      refreshUrl
    );
    res.json(link);
  })
);

export default router;
