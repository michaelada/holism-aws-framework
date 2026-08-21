import express from 'express';
import type { Server } from 'http';
import request from 'supertest';

/**
 * The anonymous event endpoints, and the crawler-facing files.
 *
 * These are the only routes in the product with no authentication at all, so
 * the assertions are mostly about what they refuse to do: cache safely, refuse
 * a sort they were not taught, and tell a crawler the difference between an
 * event that never existed and one a club has withdrawn.
 *
 * See docs/PUBLIC_EVENTS.md, docs/PUBLIC_EVENTS_SEO.md.
 */

jest.mock('../../config/logger');

jest.mock('../../services/public-event.service', () => ({
  publicEventService: {
    listForOrganisation: jest.fn(),
    search: jest.fn(),
    findBySlug: jest.fn(),
    wasPublic: jest.fn(),
    filterOptions: jest.fn(),
    listUrls: jest.fn(),
  },
}));

jest.mock('../../services/account-organisation.service', () => ({
  accountOrganisationService: {
    listPublicOrganisations: jest.fn(),
    getPublicOrganisationByCode: jest.fn(),
  },
}));
jest.mock('../../services/account-credentials.service', () => ({
  accountCredentialsService: { confirmEmailChange: jest.fn() },
}));

import { publicEventService } from '../../services/public-event.service';
import publicRoutes from '../public.routes';
import seoRoutes from '../seo.routes';

const mocked = publicEventService as jest.Mocked<typeof publicEventService>;

const app = express();
app.use(express.json());
app.use('/api/public', publicRoutes);
app.use('/', seoRoutes);

let server: Server;
beforeAll((done) => {
  server = app.listen(0, done);
});
afterAll((done) => {
  server.close(done);
});

const event = {
  id: 'ev-1',
  slug: 'spring-show-a1b2c3d4',
  name: 'Spring Show',
  organisation: { code: 'khpc', name: 'Kildare Hunt Pony Club', currency: 'EUR' },
  activities: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mocked.listForOrganisation.mockResolvedValue([event] as any);
  mocked.search.mockResolvedValue({ events: [event], total: 1 } as any);
  mocked.filterOptions.mockResolvedValue({
    eventTypes: [],
    regions: [],
    organisations: [],
  } as any);
  mocked.listUrls.mockResolvedValue([
    {
      orgCode: 'khpc',
      slug: 'spring-show-a1b2c3d4',
      updatedAt: new Date('2026-08-14'),
      startDate: new Date('2026-09-09'),
    },
  ] as any);
});

describe('a club’s public events', () => {
  it('serves them to a caller with no session', async () => {
    const response = await request(server).get('/api/public/organisations/khpc/events');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('lets a shared cache hold them briefly', async () => {
    /*
     * A link going round a WhatsApp group would otherwise hit the database once
     * per recipient. A minute of staleness costs a newly published event a
     * minute of delay.
     */
    const response = await request(server).get('/api/public/organisations/khpc/events');

    expect(response.headers['cache-control']).toContain('public');
    expect(response.headers['cache-control']).toContain('max-age=60');
  });
});

describe('the platform search', () => {
  it('passes filters through, taking repeated parameters as a list', async () => {
    await request(server)
      .get('/api/public/events?type=Dressage&type=Camp&region=Co.%20Meath&entriesOpen=true')
      .expect(200);

    expect(mocked.search).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ['Dressage', 'Camp'],
        region: ['Co. Meath'],
        entriesOpen: true,
      })
    );
  });

  it('refuses a sort it was not taught, rather than passing it on', async () => {
    /*
     * The value arrives from a query string and reaches an ORDER BY lookup.
     * Anything unrecognised falls back to the default rather than being
     * forwarded.
     */
    await request(server).get('/api/public/events?sort=; DROP TABLE events').expect(200);

    expect(mocked.search).toHaveBeenCalledWith(expect.objectContaining({ sort: 'soonest' }));
  });

  it('reports the total beside the page', async () => {
    const response = await request(server).get('/api/public/events').expect(200);
    expect(response.body.total).toBe(1);
  });
});

describe('one event', () => {
  it('serves it when it is public', async () => {
    mocked.findBySlug.mockResolvedValue({ event, canonicalSlug: event.slug } as any);

    const response = await request(server)
      .get('/api/public/organisations/khpc/events/spring-show-a1b2c3d4')
      .expect(200);

    expect(response.body.canonicalSlug).toBe('spring-show-a1b2c3d4');
  });

  it('answers 410 for an event a club has withdrawn', async () => {
    /*
     * Not 404. A crawler retries a 404 for weeks and drops a 410 promptly, so
     * a club that stops advertising an event stops appearing in results rather
     * than leaving a dead link behind it.
     */
    mocked.findBySlug.mockResolvedValue(null);
    mocked.wasPublic.mockResolvedValue(true);

    const response = await request(server).get(
      '/api/public/organisations/khpc/events/spring-show-a1b2c3d4'
    );

    expect(response.status).toBe(410);
    expect(response.body.error).toMatch(/no longer published/);
  });

  it('answers 404 for one that never existed', async () => {
    mocked.findBySlug.mockResolvedValue(null);
    mocked.wasPublic.mockResolvedValue(false);

    await request(server).get('/api/public/organisations/khpc/events/nothing-deadbeef').expect(404);
  });
});

describe('the page a crawler actually requests', () => {
  /*
   * The status on `/api/public/...` is invisible to anything that fetches the
   * *page* rather than the data — which is every crawler. A withdrawn event
   * returning 200 with a generic shell would sit in the index indefinitely.
   *
   * These only apply once `ACCOUNT_SHELL_HTML` is configured; without it the
   * route hands off to nginx, which is the documented degradation.
   */
  it('leaves the status to nginx when no shell is configured', async () => {
    // `ACCOUNT_SHELL_HTML` is unset under test, so the route declines and
    // Express falls through — which is the safe default this relies on.
    mocked.findBySlug.mockResolvedValue(null);
    mocked.wasPublic.mockResolvedValue(true);

    const response = await request(server).get('/account/khpc/whats-on/anything-a1b2c3d4');

    expect(response.status).toBe(404);
    // Not the JSON refusal — nothing was served by this route at all.
    expect(response.body.error).toBeUndefined();
  });
});

describe('what crawlers are given', () => {
  it('keeps the member application out of the index', async () => {
    /*
     * The disallows matter as much as the allows: those pages are behind a
     * sign-in, so crawling them spends budget to put sign-in walls in results
     * where events belong.
     */
    const response = await request(server).get('/robots.txt').expect(200);

    expect(response.text).toContain('Allow: /events');
    expect(response.text).toContain('Disallow: /api/');
    expect(response.text).toContain('Disallow: /account/*/browse');
    expect(response.text).toContain('Sitemap:');
  });

  it('lists every public event in the sitemap, with a date', async () => {
    const response = await request(server).get('/sitemap.xml').expect(200);

    expect(response.headers['content-type']).toContain('xml');
    expect(response.text).toContain('/account/khpc/whats-on/spring-show-a1b2c3d4');
    expect(response.text).toContain('<lastmod>2026-08-14</lastmod>');
  });

  it('returns a valid empty sitemap rather than an error', async () => {
    /*
     * A crawler receiving a 500 backs off and may not return for days. An empty
     * document is read, found to say nothing new, and re-read on schedule.
     */
    mocked.listUrls.mockRejectedValue(new Error('database is down'));

    const response = await request(server).get('/sitemap.xml');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<urlset');
  });
});
