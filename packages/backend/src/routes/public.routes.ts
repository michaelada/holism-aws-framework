import { Router, Request, Response } from 'express';
import { accountOrganisationService } from '../services/account-organisation.service';
import { accountCredentialsService } from '../services/account-credentials.service';
import { publicEventService } from '../services/public-event.service';
import { platformPostService, PostSurface } from '../services/platform-post.service';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME } from '../config/aws.config';
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
 * /api/public/posts:
 *   get:
 *     summary: The platform's announcements for one login page
 *     description: >
 *       Active posts flagged for the named surface, in the arranged order, with
 *       their bodies already sanitised. Anonymous by nature — these are read by
 *       people who have not signed in, and by the Keycloak login theme, which
 *       has no token and no sanitiser of its own.
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: surface
 *         required: true
 *         schema: { type: string, enum: [account, orgadmin] }
 *     responses:
 *       200:
 *         description: The posts to show
 */
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const surface = req.query.surface;
    if (surface !== 'account' && surface !== 'orgadmin') {
      return res.status(400).json({ error: 'surface must be account or orgadmin' });
    }

    const posts = await platformPostService.listForSurface(surface as PostSurface);

    /*
     * Readable from anywhere. The Keycloak login pages are the reason for the
     * explicit header: they are same-origin with the API in a deployed
     * environment but not necessarily in every setup, and a login page that
     * silently shows no announcements because of a CORS refusal is a failure
     * nobody would notice. There is nothing here that is not already public.
     */
    res.setHeader('Access-Control-Allow-Origin', '*');

    /*
     * Revalidated every time, rather than held for a minute.
     *
     * `max-age=60` was here to spare the database on the busiest anonymous
     * endpoint in the product, and it cost more than it saved: an operator who
     * removed a post's image saw the old one still on the login page and
     * reasonably concluded the removal had not worked. A minute of "did that
     * save?" is worse than a minute of cache hits is good.
     *
     * `no-cache` means revalidate, not "do not store": Express still answers a
     * conditional request with a 304 when nothing has changed, so the usual
     * case sends headers and no body. The query behind it is a single indexed
     * read against a partial index.
     */
    res.setHeader('Cache-Control', 'no-cache');

    return res.json(posts);
  } catch (error) {
    logger.error('Error in GET /public/posts:', error);
    /*
     * An empty list rather than an error. A login page must render whatever
     * happens here: nobody can sign in to report a broken announcements panel,
     * and a 500 in this call must not be able to take the sign-in form with it.
     */
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json([]);
  }
});

/**
 * @swagger
 * /api/public/posts/{id}/image:
 *   get:
 *     summary: The image shown with a post
 *     tags: [Public]
 */
router.get('/posts/:id/image', async (req: Request, res: Response) => {
  /*
   * Streamed from here rather than from the admin router, even though the
   * upload lives there. This route needs no token, and importing the admin
   * router to reach it pulled `requireRole` into every consumer of this file —
   * which broke suites that mock `auth.middleware` with only the function they
   * use, in files that have nothing to do with posts.
   *
   * A stable path rather than a signed URL: two very different clients read it
   * — React, and a hand-written script in a Keycloak theme — and neither should
   * have to refresh a URL that expires.
   */
  try {
    const location = await platformPostService.imageLocation(req.params.id);
    // An inactive post's image is not served either: taking a post down takes
    // its picture down with it.
    if (!location) return res.status(404).json({ error: 'No image for that post' });

    const object = await s3Client.send(
      new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: location.s3Key })
    );

    res.setHeader('Content-Type', location.mimeType);
    /*
     * Cached hard, which is only safe because the URL carries a `v` token
     * derived from the S3 key: replacing a post's image changes the key, which
     * changes the token, which changes the URL. These bytes therefore never
     * change, and a browser that has them never needs to ask again.
     *
     * This used to be `max-age=300` on an unversioned URL, which is the
     * opposite trade — the same address serving different pictures, so a
     * replaced image took five minutes to appear and a removed one lingered.
     */
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const body = object.Body as any;
    if (typeof body?.pipe === 'function') return body.pipe(res);

    // Not a stream on every SDK target: send it whole.
    const bytes = await body.transformToByteArray();
    return res.end(Buffer.from(bytes));
  } catch (error) {
    logger.error('Error serving a platform post image:', error);
    return res.status(404).json({ error: 'No image for that post' });
  }
});


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

/*
 * ── Public event listings ──────────────────────────────────────────────────
 *
 * Anonymous, cacheable, and carrying nothing about people. Everything below
 * reads through `publicEventService`, which applies "published by the club AND
 * switched on for the public" in one place.
 *
 * See docs/PUBLIC_EVENTS.md.
 */

/**
 * How long a shared cache may hold a public listing.
 *
 * Public event data changes when a club edits an event — rarely — and the cost
 * of a minute of staleness is that a newly published event appears a minute
 * late. The cost of no caching is that a link going round a WhatsApp group hits
 * the database once per recipient.
 */
const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300';

/**
 * @openapi
 * /api/public/organisations/{code}/events:
 *   get:
 *     summary: One club's publicly listed events
 *     tags: [Public]
 *     responses:
 *       200: { description: The club's public events, soonest first }
 */
router.get('/organisations/:code/events', async (req: Request, res: Response) => {
  try {
    const events = await publicEventService.listForOrganisation(req.params.code);
    res.set('Cache-Control', PUBLIC_CACHE);
    return res.json(events);
  } catch (error) {
    logger.error('Error in GET /public/organisations/:code/events:', error);
    return res.status(500).json({ error: 'Failed to load events' });
  }
});

/** Repeated query parameters arrive as an array; a single one does not. */
const asList = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const list = Array.isArray(value) ? value : String(value).split(',');
  const cleaned = list.map((entry) => String(entry).trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
};

const asDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * @openapi
 * /api/public/events:
 *   get:
 *     summary: Events published to the ItsPlainSailing listing, across all clubs
 *     description: >
 *       Search, filter, sort and page. Every parameter is optional; the default
 *       is every public event, soonest first.
 *     tags: [Public]
 *     responses:
 *       200: { description: A page of events and the total matching }
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, unknown>;
    const sort = String(query.sort ?? 'soonest');

    const result = await publicEventService.search({
      q: query.q ? String(query.q) : undefined,
      eventType: asList(query.type),
      region: asList(query.region),
      organisation: asList(query.org),
      from: asDate(query.from),
      to: asDate(query.to),
      entriesOpen: String(query.entriesOpen ?? '') === 'true',
      // Anything unrecognised falls back rather than reaching the ORDER BY map.
      sort: ['soonest', 'closing', 'recent', 'organisation'].includes(sort)
        ? (sort as any)
        : 'soonest',
      limit: Number(query.limit) || undefined,
      offset: Number(query.offset) || undefined,
    });

    res.set('Cache-Control', PUBLIC_CACHE);
    return res.json(result);
  } catch (error) {
    logger.error('Error in GET /public/events:', error);
    return res.status(500).json({ error: 'Failed to search events' });
  }
});

/**
 * @openapi
 * /api/public/events/filters:
 *   get:
 *     summary: The filter vocabularies, with counts
 *     description: >
 *       Taken from what is actually in the public results rather than from the
 *       full tables, so the page never offers a filter that returns nothing.
 *     tags: [Public]
 *     responses:
 *       200: { description: Event types, regions and organisations, each with a count }
 */
router.get('/events/filters', async (_req: Request, res: Response) => {
  try {
    res.set('Cache-Control', PUBLIC_CACHE);
    return res.json(await publicEventService.filterOptions());
  } catch (error) {
    logger.error('Error in GET /public/events/filters:', error);
    return res.status(500).json({ error: 'Failed to load filters' });
  }
});

/**
 * @openapi
 * /api/public/organisations/{code}/events/{slug}:
 *   get:
 *     summary: One public event
 *     description: >
 *       Resolved by the id embedded in the slug, never by the words — an event
 *       renamed after a club shared the link still answers on the old URL. When
 *       the words no longer match, `canonicalSlug` carries the current address
 *       so the caller can redirect rather than serve two URLs for one event.
 *     tags: [Public]
 *     responses:
 *       200: { description: The event }
 *       404: { description: No such public event }
 */
router.get('/organisations/:code/events/:slug', async (req: Request, res: Response) => {
  try {
    const found = await publicEventService.findBySlug(req.params.code, req.params.slug);
    if (!found) {
      /*
       * `410 Gone` for an event that was public and has been withdrawn, `404`
       * for one that never existed. A crawler retries a 404 for weeks and drops
       * a 410 promptly — so a club that stops advertising an event stops
       * appearing in results, rather than leaving a dead link behind it.
       */
      const withdrawn = await publicEventService.wasPublic(req.params.code, req.params.slug);
      return res
        .status(withdrawn ? 410 : 404)
        .json({ error: withdrawn ? 'This event is no longer published' : 'Event not found' });
    }
    res.set('Cache-Control', PUBLIC_CACHE);
    return res.json(found);
  } catch (error) {
    logger.error('Error in GET /public/organisations/:code/events/:slug:', error);
    return res.status(500).json({ error: 'Failed to load the event' });
  }
});

export default router;
