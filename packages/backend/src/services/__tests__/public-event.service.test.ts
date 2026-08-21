/**
 * Events published to the public.
 *
 * Two properties matter more than any field mapping, and both are about what
 * an **anonymous** caller can reach:
 *
 *  - a draft cannot become public by ticking a second box
 *  - nothing here names a person
 *
 * The rest is about URLs surviving contact with reality: an event renamed after
 * a club posted the link to Facebook must still answer on the old address.
 *
 * See docs/PUBLIC_EVENTS.md, docs/PUBLIC_EVENTS_SEO.md.
 */

jest.mock('../../config/logger');
jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));

import { db } from '../../database/pool';
import { publicEventService, slugFor, idPrefixFromSlug } from '../public-event.service';

const mockDb = db as jest.Mocked<typeof db>;

const EVENT_ID = 'a1b2c3d4-1111-4111-8111-111111111111';

const eventRow = (over: Record<string, any> = {}) => ({
  id: EVENT_ID,
  name: 'Spring Show Jumping League',
  description: 'Four rounds over the spring.',
  start_date: new Date('2026-09-09'),
  end_date: new Date('2026-09-09'),
  open_date_entries: new Date('2026-08-01'),
  entries_closing_date: new Date('2026-09-02'),
  limit_entries: true,
  entries_limit: 120,
  updated_at: new Date('2026-08-14'),
  event_type: 'Show Jumping',
  venue_name: 'Craddockstown Equestrian',
  venue_address: 'Craddockstown, Naas, Co. Kildare',
  venue_region: 'Co. Kildare',
  latitude: null,
  longitude: null,
  url_code: 'khpc',
  organisation_name: 'Kildare Hunt Pony Club',
  currency: 'EUR',
  entry_count: '8',
  ...over,
});

const activityRow = (over: Record<string, any> = {}) => ({
  id: 'act-1',
  event_id: EVENT_ID,
  name: 'Grade 1 — 80cm',
  description: 'Introductory round.',
  fee: '25.00',
  limit_applicants: true,
  applicants_limit: 40,
  entry_eligibility: 'all',
  entry_count: '3',
  ...over,
});

/** Dispatches on the SQL, so an added query does not shuffle every expectation. */
const stub = (options: { events?: any[]; activities?: any[]; total?: number } = {}) => {
  mockDb.query = jest.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('FROM event_activities a')) {
      return { rows: options.activities ?? [] };
    }
    if (sql.includes('COUNT(*) AS total')) {
      return { rows: [{ total: options.total ?? (options.events ?? []).length }] };
    }
    return { rows: options.events ?? [] };
  });
};

const sqlFor = (needle: string): string =>
  (mockDb.query as jest.Mock).mock.calls
    .map(([sql]) => String(sql))
    .find((sql) => sql.includes(needle)) ?? '';

beforeEach(() => jest.clearAllMocks());

describe('what reaches the public at all', () => {
  it('requires the club to have published the event as well as listed it', async () => {
    /*
     * The rule that keeps a draft from leaking. Two switches, both of which the
     * club sets deliberately: `status = 'published'` is the club telling its own
     * members, the flag is the club telling the world.
     */
    stub({ events: [eventRow()] });

    await publicEventService.listForOrganisation('khpc');

    const sql = sqlFor('show_on_organisation_page');
    expect(sql).toContain("e.status = 'published'");
    expect(sql).toContain('e.deleted = FALSE');
    expect(sql).toContain('e.show_on_organisation_page');
  });

  it('drops an event whose club is no longer active', async () => {
    // A club that has been deactivated should not keep advertising.
    stub({ events: [] });

    await publicEventService.listForOrganisation('khpc');

    expect(sqlFor('show_on_organisation_page')).toContain("o.status = 'active'");
  });

  it('keeps a finished event rather than filtering it out', async () => {
    /*
     * Deliberate. A past event holds whatever ranking it earned, repeat events
     * benefit from a URL with history, and a club's past programme is evidence
     * it is worth joining. The listings order it away; they do not delete it.
     */
    stub({ events: [] });

    await publicEventService.listForOrganisation('khpc');

    expect(sqlFor('show_on_organisation_page')).not.toContain('end_date >=');
  });

  it('names nobody', async () => {
    /*
     * The privacy rule, asserted against the query rather than the output — an
     * output test only proves the fixture had no names in it.
     */
    stub({ events: [eventRow()], activities: [activityRow()] });

    await publicEventService.listForOrganisation('khpc');

    for (const [sql] of (mockDb.query as jest.Mock).mock.calls) {
      const text = String(sql);
      expect(text).not.toMatch(/organization_users/);
      expect(text).not.toMatch(/\bmembers\b/);
      expect(text).not.toMatch(/first_name|last_name|\bemail\b/);
    }
  });

  it('hides an activity the club has hidden from its own members', async () => {
    stub({ events: [eventRow()] });

    await publicEventService.listForOrganisation('khpc');

    expect(sqlFor('FROM event_activities a')).toContain('a.show_publicly = TRUE');
  });
});

describe('the shape of an event', () => {
  it('reports places left, at both levels', async () => {
    stub({ events: [eventRow()], activities: [activityRow()] });

    const [event] = await publicEventService.listForOrganisation('khpc');

    expect(event.placesRemaining).toBe(112); // 120 − 8
    expect(event.activities[0].placesRemaining).toBe(37); // 40 − 3
  });

  it('leaves an uncapped event with no false ceiling', async () => {
    // Null, not zero, not the entry count: an uncapped event has no limit to
    // report and inventing one would read as "full".
    stub({
      events: [eventRow({ limit_entries: false, entries_limit: null })],
      activities: [activityRow({ limit_applicants: false, applicants_limit: null })],
    });

    const [event] = await publicEventService.listForOrganisation('khpc');

    expect(event.entriesLimit).toBeNull();
    expect(event.placesRemaining).toBeNull();
    expect(event.activities[0].placesRemaining).toBeNull();
  });

  it('converts the fee to minor units, as every other price in the system', async () => {
    stub({ events: [eventRow()], activities: [activityRow({ fee: '25.00' })] });

    const [event] = await publicEventService.listForOrganisation('khpc');

    expect(event.activities[0].fee).toBe(2500);
  });

  it('marks a members-only activity and says which kind', async () => {
    /*
     * Listed, not hidden: a show with eight classes would look like it had
     * three. The scope is carried because the two mean different things to a
     * reader — one club's members, or any branch's.
     */
    stub({
      events: [eventRow()],
      activities: [
        activityRow(),
        activityRow({ id: 'act-2', entry_eligibility: 'members' }),
        activityRow({ id: 'act-3', entry_eligibility: 'org-type-members' }),
      ],
    });

    const [event] = await publicEventService.listForOrganisation('khpc');

    expect(event.activities.map((a) => a.membersOnlyScope)).toEqual([
      null,
      'club',
      'organisation-type',
    ]);
  });

  it('offers coordinates only when the venue has them', async () => {
    // They drive `schema.org` `geo`, and a null island is worse than no geo.
    stub({ events: [eventRow()] });
    expect((await publicEventService.listForOrganisation('khpc'))[0].location).toBeNull();

    stub({ events: [eventRow({ latitude: '53.2', longitude: '-6.6' })] });
    expect((await publicEventService.listForOrganisation('khpc'))[0].location).toEqual({
      latitude: 53.2,
      longitude: -6.6,
    });
  });
});

describe('URLs', () => {
  it('builds a slug a person can read, ending in the id that resolves it', () => {
    expect(slugFor(EVENT_ID, 'Spring Show Jumping League')).toBe(
      'spring-show-jumping-league-a1b2c3d4'
    );
  });

  it('survives a name with nothing sluggable in it', () => {
    // The id alone is still a working URL.
    expect(slugFor(EVENT_ID, '!!!')).toBe('a1b2c3d4');
  });

  it('reads the id back out of a slug', () => {
    expect(idPrefixFromSlug('spring-show-jumping-league-a1b2c3d4')).toBe('a1b2c3d4');
    expect(idPrefixFromSlug('no-id-here')).toBeNull();
  });

  it('resolves a renamed event on its old address, and names the new one', async () => {
    /*
     * The case this is all for: a club posts a link to Facebook in March and
     * renames the event in May. The old link must not break, and the two must
     * not both be indexed — hence a canonical to redirect to.
     */
    stub({ events: [eventRow()], activities: [] });

    const found = await publicEventService.findBySlug('khpc', 'whatever-it-used-to-be-a1b2c3d4');

    expect(found?.event.name).toBe('Spring Show Jumping League');
    expect(found?.canonicalSlug).toBe('spring-show-jumping-league-a1b2c3d4');
  });

  it('refuses a slug carrying no id at all, without asking the database', async () => {
    stub({ events: [] });

    expect(await publicEventService.findBySlug('khpc', 'not-an-event')).toBeNull();
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('will not serve one club’s event under another club’s code', async () => {
    // The organisation is part of the lookup, not decoration in the path.
    stub({ events: [] });

    await publicEventService.findBySlug('lhpc', 'spring-show-a1b2c3d4');

    expect(sqlFor('e.id::text LIKE')).toContain('lower(o.url_code) = lower($1)');
  });
});

describe('the platform listing', () => {
  it('searches the venue address as well as its name', async () => {
    /*
     * What keeps an unfilled `region` from making an event invisible: someone
     * typing "Kildare" finds it through the address either way.
     */
    stub({ events: [] });

    await publicEventService.search({ q: 'Kildare' });

    expect(sqlFor('ILIKE')).toContain('v.address ILIKE');
  });

  it('takes only the sorts it knows', async () => {
    // The value arrives from a query string and is never interpolated.
    stub({ events: [] });

    await publicEventService.search({ sort: 'closing' });

    expect(sqlFor('ORDER BY')).toContain('e.entries_closing_date ASC');
  });

  it('caps the page size however large a caller asks for', async () => {
    stub({ events: [] });

    await publicEventService.search({ limit: 5000 });

    expect(sqlFor('LIMIT')).toContain('LIMIT 100');
  });

  it('reports the total separately from the page', async () => {
    // A pager needs to know there are 47 while holding 20.
    stub({ events: [eventRow()], activities: [], total: 47 });

    const result = await publicEventService.search({});

    expect(result.total).toBe(47);
    expect(result.events).toHaveLength(1);
  });

  it('offers filters only for what is actually listed', async () => {
    /*
     * Taken from the public results rather than the full tables. A filter that
     * returns nothing is worse than one fewer filter.
     */
    mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

    await publicEventService.filterOptions();

    for (const [sql] of (mockDb.query as jest.Mock).mock.calls) {
      expect(String(sql)).toContain('e.show_on_platform_page');
    }
  });
});
