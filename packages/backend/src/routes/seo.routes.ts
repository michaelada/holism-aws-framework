import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import { publicEventService } from '../services/public-event.service';

/**
 * `robots.txt` and `sitemap.xml`, at the site root.
 *
 * Mounted outside `/api` because that is where crawlers look and there is no
 * negotiating with them about it.
 *
 * The sitemap is generated rather than written, because the content changes
 * whenever a club publishes an event — a file checked into the repository would
 * be wrong within a day and nobody would notice for months.
 *
 * See docs/PUBLIC_EVENTS_SEO.md §3.
 */

const router = Router();

/**
 * The public origin, for absolute URLs.
 *
 * A sitemap must carry absolute URLs, and it is read by something that has no
 * idea what host it asked. `PUBLIC_URL` is already set for the same reason CORS
 * needs it; the header fallback keeps development working without configuration.
 */
const originFor = (req: Request): string => {
  const configured = process.env.PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  return `${proto}://${req.get('host')}`;
};

/** XML text nodes: five characters, and forgetting one breaks the document. */
const xml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * What a crawler may and may not have.
 *
 * The `Disallow` lines carry as much weight as the `Allow` ones. Everything
 * under a club's code except `/whats-on` is behind authentication, so a crawler
 * reaching it finds a sign-in wall: indexing those spends crawl budget to put
 * sign-in pages in results where events belong.
 *
 * `/api/` is disallowed for the same reason and one more — it is JSON, and a
 * JSON endpoint in a search result helps nobody.
 */
router.get('/robots.txt', (req: Request, res: Response) => {
  const origin = originFor(req);

  res.type('text/plain').send(
    [
      'User-agent: *',
      '',
      '# Public surfaces',
      'Allow: /events',
      'Allow: /account/$',
      'Allow: /account/*/whats-on',
      '',
      '# Applications, all behind a sign-in',
      'Disallow: /api/',
      'Disallow: /auth/',
      'Disallow: /orgadmin/',
      'Disallow: /admin/',
      'Disallow: /metadata/',
      '',
      '# The member application',
      'Disallow: /account/*/browse',
      'Disallow: /account/*/cart',
      'Disallow: /account/*/checkout',
      'Disallow: /account/*/profile',
      'Disallow: /account/*/entries',
      'Disallow: /account/*/memberships',
      'Disallow: /account/*/payments',
      'Disallow: /account/*/orders',
      'Disallow: /account/*/tickets',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n')
  );
});

/**
 * Every public event, plus the listings.
 *
 * `lastmod` comes from the event row, so a crawler that has seen a URL before
 * knows whether to look again. `changefreq` reflects how close the event is:
 * something happening next week is worth re-reading, something in nine months
 * is not.
 *
 * Cached for an hour at the edge. A club publishing an event should not wait a
 * day to be listed, and a crawler should not be able to make this query in a
 * loop.
 */
router.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const origin = originFor(req);
    const urls = await publicEventService.listUrls();
    const now = new Date();

    const entry = (
      loc: string,
      lastmod: Date | null,
      changefreq: string,
      priority: string
    ): string =>
      [
        '  <url>',
        `    <loc>${xml(loc)}</loc>`,
        lastmod ? `    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : '',
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');

    const clubs = [...new Set(urls.map((url) => url.orgCode))];

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      // The platform listing is the entry point and changes as clubs publish.
      entry(`${origin}/events`, now, 'daily', '1.0'),
      ...clubs.map((code) =>
        entry(`${origin}/account/${code}/whats-on`, now, 'weekly', '0.8')
      ),
      ...urls.map((url) => {
        const days = Math.ceil((url.startDate.getTime() - now.getTime()) / 86_400_000);
        const changefreq = days < 0 ? 'yearly' : days < 14 ? 'daily' : days < 60 ? 'weekly' : 'monthly';
        // A finished event keeps its page but stops competing for attention.
        const priority = days < 0 ? '0.3' : '0.7';
        return entry(
          `${origin}/account/${url.orgCode}/whats-on/${url.slug}`,
          url.updatedAt,
          changefreq,
          priority
        );
      }),
      '</urlset>',
      '',
    ].join('\n');

    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(body);
  } catch (error) {
    logger.error('Error generating sitemap.xml:', error);
    /*
     * An empty but valid sitemap, not a 500. A crawler receiving a server error
     * backs off and may not return for days; an empty document is read, found
     * to say nothing new, and re-read on schedule.
     */
    res
      .type('application/xml')
      .send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n');
  }
});

/*
 * ── Server-rendered <head> for the public pages ────────────────────────────
 *
 * The account application is a client-rendered SPA: its `index.html` carries
 * one title ("ItsPlainSailing"), one generic description and an empty `#root`.
 * Google runs JavaScript and eventually sees the real page; **Bing is
 * inconsistent and social scrapers run none at all**, which is why pasting an
 * event link into Facebook or WhatsApp produces a grey box with no title,
 * image or description.
 *
 * So the shell is served from here for public routes with its head filled in,
 * and a `<noscript>` block carrying the same facts the rendered page shows. It
 * is the *same page for every visitor* — not a different document served to
 * crawlers, which is the cloaking this deliberately avoids.
 *
 * ## Deployment
 *
 * This needs the built `account-shell/index.html`, which lives in the nginx
 * image rather than this one. `ACCOUNT_SHELL_HTML` points at it. **Without it
 * these routes do nothing** and nginx serves the static shell exactly as it
 * does today — the feature degrades to the current behaviour rather than
 * breaking, which is the right failure for something that only crawlers and
 * link previews can see.
 *
 * See docs/PUBLIC_EVENTS_SEO.md §3 layer 2.
 */

const SHELL_PATH = process.env.ACCOUNT_SHELL_HTML || '';

/** Read once. The shell only changes when a new image is deployed. */
let shellCache: string | null | undefined;

const readShell = (): string | null => {
  if (shellCache !== undefined) return shellCache;
  if (!SHELL_PATH) {
    shellCache = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    shellCache = require('fs').readFileSync(SHELL_PATH, 'utf8') as string;
  } catch (error) {
    logger.warn('Public pages will be served without server-rendered metadata', {
      path: SHELL_PATH,
      error: (error as Error).message,
    });
    shellCache = null;
  }
  return shellCache;
};

/** HTML text nodes. Everything injected below passes through here. */
const escape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Build the head and the no-script body for one event.
 *
 * The `<noscript>` content is not a courtesy to old browsers — it is what a
 * scraper that does not execute JavaScript actually reads. It carries the same
 * facts as the rendered page: name, club, date, venue, and every activity with
 * its price.
 */
const eventDocument = (
  shell: string,
  event: Awaited<ReturnType<typeof publicEventService.findBySlug>>,
  origin: string
): string => {
  if (!event) return shell;
  const { event: e } = event;

  const url = `${origin}/account/${e.organisation.code}/whats-on/${e.slug}`;
  const title = `${e.name} · ${e.organisation.name}`;
  const description = (e.description || '').slice(0, 155);
  const money = (minor: number) => (minor / 100).toFixed(2);

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.name,
    description: e.description,
    startDate: e.startDate,
    endDate: e.endDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    url,
    ...(e.venue
      ? {
          location: {
            '@type': 'Place',
            name: e.venue.name,
            ...(e.venue.address
              ? {
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: e.venue.address,
                    ...(e.venue.region ? { addressRegion: e.venue.region } : {}),
                  },
                }
              : {}),
            ...(e.location
              ? {
                  geo: {
                    '@type': 'GeoCoordinates',
                    latitude: e.location.latitude,
                    longitude: e.location.longitude,
                  },
                }
              : {}),
          },
        }
      : {}),
    organizer: {
      '@type': 'Organization',
      name: e.organisation.name,
      url: `${origin}/account/${e.organisation.code}/whats-on`,
    },
    // Members-only activities are not offers — a reader cannot buy them, and a
    // price in a search result they cannot pay is a false promise.
    offers: e.activities
      .filter((activity) => !activity.membersOnly)
      .map((activity) => ({
        '@type': 'Offer',
        name: activity.name,
        price: money(activity.fee),
        priceCurrency: e.organisation.currency,
        url: `${origin}/account/${e.organisation.code}/browse/events?event=${e.id}`,
        availability:
          activity.placesRemaining === 0
            ? 'https://schema.org/SoldOut'
            : 'https://schema.org/InStock',
        ...(e.entriesOpenDate ? { validFrom: e.entriesOpenDate } : {}),
      })),
  };

  const head = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}">`,
    `<link rel="canonical" href="${escape(url)}">`,
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(description)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:url" content="${escape(url)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escape(title)}">`,
    `<meta name="twitter:description" content="${escape(description)}">`,
    `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');

  const activities = e.activities
    .map(
      (activity) =>
        `<li>${escape(activity.name)} — ${escape(e.organisation.currency)} ${money(activity.fee)}` +
        `${activity.membersOnly ? ' (members only)' : ''}</li>`
    )
    .join('');

  const noscript = [
    '<noscript>',
    `<h1>${escape(e.name)}</h1>`,
    `<p>${escape(e.organisation.name)}</p>`,
    `<p>${escape(new Date(e.startDate).toDateString())}</p>`,
    e.venue ? `<p>${escape([e.venue.name, e.venue.address].filter(Boolean).join(', '))}</p>` : '',
    `<p>${escape(e.description || '')}</p>`,
    activities ? `<ul>${activities}</ul>` : '',
    `<p><a href="${escape(url)}">${escape(e.name)}</a></p>`,
    '</noscript>',
  ]
    .filter(Boolean)
    .join('');

  return shell
    // The shell's own title and description are replaced, not appended to:
    // two titles is worse than a generic one.
    .replace(/<title>.*?<\/title>/s, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"></div>${noscript}`);
};

/**
 * The public event page, with a real head.
 *
 * Mounted at the account application's own path so the URL a visitor shares and
 * the URL a crawler indexes are the same one.
 */
router.get('/account/:orgCode/whats-on/:slug', async (req: Request, res: Response, next) => {
  const shell = readShell();
  // Not configured: nginx serves the static shell, exactly as before.
  if (!shell) return next();

  try {
    const found = await publicEventService.findBySlug(req.params.orgCode, req.params.slug);
    if (!found) {
      /*
       * The status matters here in a way it does not on the JSON API, because
       * **this is the URL a crawler actually requests**. Returning 200 with a
       * generic shell would leave a withdrawn event in the index indefinitely —
       * the 410 on `/api/public/...` is invisible to anything that fetches the
       * page rather than the data.
       *
       * The shell is still served with it. A status code does not stop the
       * application booting, so a person following an old link gets the app's
       * own "we could not find that event" while a crawler gets the signal to
       * drop the URL.
       */
      const withdrawn = await publicEventService.wasPublic(req.params.orgCode, req.params.slug);
      return res.status(withdrawn ? 410 : 404).type('html').send(shell);
    }
    /*
     * `301`, not a rewrite of the page. One event must not be reachable — and
     * indexable — at two addresses, and a redirect is the only signal a crawler
     * acts on.
     */
    if (found.canonicalSlug !== req.params.slug) {
      return res.redirect(301, `/account/${req.params.orgCode}/whats-on/${found.canonicalSlug}`);
    }
    const origin = originFor(req);
    return res.type('html').send(eventDocument(shell, found, origin));
  } catch (error) {
    logger.error('Failed to render the public event shell:', error);
    return res.type('html').send(shell);
  }
});

export default router;
