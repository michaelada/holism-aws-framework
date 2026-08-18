import { Router, Request, Response } from 'express';
import { accountOrganisationService } from '../services/account-organisation.service';
import { accountCredentialsService } from '../services/account-credentials.service';
import { ValidationError } from '../middleware/errors';
import { logger } from '../config/logger';

/**
 * Unauthenticated endpoints for the account-user application.
 *
 * Everything here is reachable with no session, because it backs the screens a
 * member sees *before* signing in — the organisation directory (A1) and an
 * organisation's gateway (A2). Keep the exposed fields minimal: contact
 * details, settings and internal ids must not leak out of the directory.
 *
 * The email-change confirmation is the exception to "before signing in": it is
 * opened from a mail client that may carry no session, often in a different
 * browser from the one that asked for the change. The token in the link is the
 * authority, which is safe because getting one needed the member's current
 * password *and* control of the address it was sent to.
 */

const router = Router();

/**
 * @swagger
 * /api/public/organisations:
 *   get:
 *     summary: Searchable directory of organisations
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Matches display name or URL code
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 24, maximum: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Matching organisations and the total available
 */
router.get('/organisations', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = await accountOrganisationService.listPublicOrganisations({
      query: req.query.q ? String(req.query.q) : undefined,
      // Bad numbers become undefined so the service applies its defaults,
      // rather than NaN reaching the query.
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });

    return res.json(result);
  } catch (error) {
    logger.error('Error in GET /public/organisations:', error);
    return res.status(500).json({ error: 'Failed to load organisations' });
  }
});

/**
 * @swagger
 * /api/public/organisations/{code}:
 *   get:
 *     summary: One organisation by its URL code, for the sign-in gateway
 *     description: >
 *       Works whether or not the organisation is listed in the directory —
 *       being unlisted affects discoverability, not access.
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organisation branding, capabilities and locale
 *       404:
 *         description: Unknown or inactive organisation
 */
router.get('/organisations/:code', async (req: Request, res: Response) => {
  try {
    const organisation = await accountOrganisationService.getPublicOrganisationByCode(
      req.params.code
    );

    if (!organisation) {
      return res.status(404).json({
        error: { code: 'ORGANISATION_UNAVAILABLE', message: 'Organisation not found' },
      });
    }

    return res.json(organisation);
  } catch (error) {
    logger.error('Error in GET /public/organisations/:code:', error);
    return res.status(500).json({ error: 'Failed to load organisation' });
  }
});

/**
 * @swagger
 * /api/public/email-change/confirm:
 *   post:
 *     summary: Finish an email change begun in the account app
 *     description: >
 *       Applies a pending change to Keycloak — email **and** username, which are
 *       the same thing for an account user — and to every `organization_users`
 *       row for that identity. The token is single-use and lasts an hour.
 *       Expired, already used and never valid all answer the same way: telling
 *       them apart would say which tokens exist to somebody guessing at them.
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: The address was changed; the new one is returned
 *       400:
 *         description: The link was not valid
 */
router.post('/email-change/confirm', async (req: Request, res: Response) => {
  try {
    const { token } = req.body ?? {};
    return res.json(await accountCredentialsService.confirmEmailChange(token));
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Error in POST /public/email-change/confirm:', error);
    return res.status(500).json({ error: 'Failed to confirm the email change' });
  }
});

export default router;
