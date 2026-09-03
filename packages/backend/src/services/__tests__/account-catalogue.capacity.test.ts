import { AccountCatalogueService } from '../account-catalogue.service';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * Event-level capacity in the member-facing catalogue.
 *
 * The service already decided *whether* an event was full — `event-full` — but
 * never said how full. "12 of 50 places left" and "12 places left" are
 * different messages to somebody deciding whether to enter now, and the bare
 * remainder cannot convey how tight it is, so both numbers are exposed.
 *
 * Activity-level capacity was already returned; these tests pin the event level
 * beside it, including the case where the two disagree.
 */
describe('AccountCatalogueService — event capacity', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG = 'org-1';
  const USER = 'ou-1';
  const TODAY = new Date('2026-08-12T00:00:00Z');

  const eventRow = (over: Record<string, unknown> = {}) => ({
    id: 'event-1',
    name: 'Summer Regatta',
    description: null,
    start_date: '2026-09-01',
    end_date: '2026-09-01',
    open_date_entries: null,
    entries_closing_date: null,
    limit_entries: false,
    entries_limit: null,
    entry_count: 0,
    ...over,
  });

  /**
   * Events, then their activities, then the live basket holds against them.
   *
   * Three queries, in that order. The third defaults to none held, which is the
   * state every case here was written under.
   */
  const respond = (events: any[], activities: any[] = [], holds: any[] = []) => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: events, rowCount: events.length })
      .mockResolvedValueOnce({ rows: activities, rowCount: activities.length })
      .mockResolvedValueOnce({ rows: holds, rowCount: holds.length });
  };

  let service: AccountCatalogueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountCatalogueService();
  });

  it('reports null for an uncapped event', async () => {
    respond([eventRow()]);

    const [event] = await service.listEvents(ORG, USER, TODAY);

    expect(event.entriesLimit).toBeNull();
    expect(event.placesRemaining).toBeNull();
  });

  it('reports the limit and what is left of it', async () => {
    respond([eventRow({ limit_entries: true, entries_limit: 50, entry_count: 38 })]);

    const [event] = await service.listEvents(ORG, USER, TODAY);

    expect(event.entriesLimit).toBe(50);
    expect(event.placesRemaining).toBe(12);
  });

  it('reports zero rather than a negative when the cap is exceeded', async () => {
    // Over-subscription is possible through admin entry; a negative remainder
    // would render as "-3 places left".
    respond([eventRow({ limit_entries: true, entries_limit: 50, entry_count: 53 })]);

    const [event] = await service.listEvents(ORG, USER, TODAY);

    expect(event.placesRemaining).toBe(0);
    expect(event.unavailableReason).toBe('event-full');
  });

  /** A limit that is switched off is not a limit, whatever number is stored. */
  it('ignores a stored limit when the cap is disabled', async () => {
    respond([eventRow({ limit_entries: false, entries_limit: 50, entry_count: 60 })]);

    const [event] = await service.listEvents(ORG, USER, TODAY);

    expect(event.entriesLimit).toBeNull();
    expect(event.placesRemaining).toBeNull();
    expect(event.available).toBe(true);
  });

  it('carries the entry window dates through for the client to phrase', async () => {
    respond([
      eventRow({ open_date_entries: '2026-08-20', entries_closing_date: '2026-08-30' }),
    ]);

    const [event] = await service.listEvents(ORG, USER, TODAY);

    expect(event.entriesOpenDate).toBe('2026-08-20');
    expect(event.entriesClosingDate).toBe('2026-08-30');
    // Not open yet, and the server says so — the client only phrases it.
    expect(event.unavailableReason).toBe('entries-not-open');
  });
});

/**
 * Terms travel with the catalogue.
 *
 * The entry page has to show them before a member ticks a box saying they have
 * read them, and fetching them per item would put a second round trip in front
 * of a page the member is already waiting on.
 */
describe('AccountCatalogueService — terms and conditions', () => {
  const mockDb = db as jest.Mocked<typeof db>;

  const activityRow = (over: Record<string, unknown> = {}) => ({
    id: 'act-1',
    event_id: 'event-1',
    name: 'Junior Single Sculls',
    description: null,
    fee: '25.00',
    handling_fee_included: true,
    application_form_id: null,
    allow_specify_quantity: false,
    allowed_payment_method: [],
    limit_applicants: false,
    applicants_limit: null,
    entry_count: 0,
    mine: 0,
    use_terms_and_conditions: false,
    terms_and_conditions: null,
    ...over,
  });

  const eventRow = {
    id: 'event-1',
    name: 'Summer Regatta',
    description: null,
    start_date: '2026-09-01',
    end_date: '2026-09-01',
    open_date_entries: null,
    entries_closing_date: null,
    limit_entries: false,
    entries_limit: null,
    entry_count: 0,
  };

  const listWith = (activity: Record<string, unknown>) => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [eventRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [activity], rowCount: 1 })
      // No basket holds: terms are not what this suite is about.
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    return new AccountCatalogueService().listEvents('org-1', 'ou-1', new Date('2026-08-12'));
  };

  it('returns the terms when the club has switched them on', async () => {
    const [event] = await listWith(
      activityRow({ use_terms_and_conditions: true, terms_and_conditions: 'No refunds.' })
    );

    expect(event.activities[0].termsAndConditions).toBe('No refunds.');
  });

  /**
   * Text left in the column from a previous configuration is not a set of terms
   * anyone decided to present — and presenting it would ask a member to agree
   * to something the club has turned off.
   */
  it('ignores stored text when terms are switched off', async () => {
    const [event] = await listWith(
      activityRow({ use_terms_and_conditions: false, terms_and_conditions: 'Old wording.' })
    );

    expect(event.activities[0].termsAndConditions).toBeNull();
  });

  it('returns null when there are no terms at all', async () => {
    const [event] = await listWith(activityRow());

    expect(event.activities[0].termsAndConditions).toBeNull();
  });
});

/**
 * Soft holds on capped entries.
 *
 * The same rule as a court, for the same reason: while an entry sits in
 * somebody's basket it is a place nobody else can have. The distinctions that
 * matter are held-versus-full — a hold lapses, so the member should look again
 * rather than give up — and mine-versus-theirs.
 */
describe('AccountCatalogueService — entry holds', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG = 'org-1';
  const USER = 'ou-1';
  const TODAY = new Date('2026-08-12T00:00:00Z');

  const eventRow = (over: Record<string, unknown> = {}) => ({
    id: 'event-1',
    name: 'Summer Regatta',
    description: null,
    start_date: '2026-09-01',
    end_date: '2026-09-02',
    open_date_entries: null,
    entries_closing_date: null,
    limit_entries: false,
    entries_limit: null,
    entry_count: 0,
    ...over,
  });

  const activityRow = (over: Record<string, unknown> = {}) => ({
    id: 'act-1',
    event_id: 'event-1',
    name: 'Junior Single Sculls',
    description: null,
    fee: '25.00',
    handling_fee_included: true,
    application_form_id: null,
    allow_specify_quantity: false,
    supported_payment_methods: [],
    limit_applicants: true,
    applicants_limit: 2,
    entry_count: 0,
    mine: 0,
    use_terms_and_conditions: false,
    terms_and_conditions: null,
    ...over,
  });

  /** A row as the holds query returns it: one per activity per member. */
  const holdRow = (over: Record<string, unknown> = {}) => ({
    activity_id: 'act-1',
    user_id: 'someone-else',
    places: 1,
    ...over,
  });

  const list = (events: any[], activities: any[], holds: any[] = []) => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: events, rowCount: events.length })
      .mockResolvedValueOnce({ rows: activities, rowCount: activities.length })
      .mockResolvedValueOnce({ rows: holds, rowCount: holds.length });
    return new AccountCatalogueService().listEvents(ORG, USER, TODAY);
  };

  beforeEach(() => jest.clearAllMocks());

  it('takes places for entries sitting in other baskets', async () => {
    const [event] = await list([eventRow()], [activityRow()], [holdRow()]);

    expect(event.activities[0].placesRemaining).toBe(1);
    expect(event.activities[0].available).toBe(true);
  });

  it('closes the activity when holds account for the last place', async () => {
    const [event] = await list(
      [eventRow()],
      [activityRow()],
      [holdRow({ places: 2 })]
    );

    // Held, not full: these places come back if the baskets are abandoned, and
    // "full" would send the member away for good.
    expect(event.activities[0]).toMatchObject({
      available: false,
      unavailableReason: 'held-by-others',
      placesRemaining: 0,
    });
  });

  it('still says full when the entries themselves used the places up', async () => {
    const [event] = await list(
      [eventRow()],
      [activityRow({ entry_count: 2 })]
    );

    expect(event.activities[0].unavailableReason).toBe('activity-full');
  });

  /**
   * A line in the basket no longer closes the activity.
   *
   * It used to say "in your basket", which was accurate and was still a
   * refusal: an activity may be entered more than once, so the member with one
   * line in the basket is exactly the one adding the second horse. The hold
   * still takes its place against the cap — that part is capacity, not a rule
   * about who may enter.
   */
  it('leaves the activity open to a member who already holds a place in it', async () => {
    const [event] = await list([eventRow()], [activityRow()], [holdRow({ user_id: USER })]);

    expect(event.activities[0].available).toBe(true);
    expect(event.activities[0].unavailableReason).toBeNull();
  });

  it('still counts that hold against the cap', async () => {
    // Uncapped above; capped here, so the place it takes is visible.
    const [event] = await list(
      [eventRow()],
      [activityRow({ limit_applicants: true, applicants_limit: 1 })],
      [holdRow({ user_id: USER })]
    );

    expect(event.activities[0].placesRemaining).toBe(0);
  });

  it('counts a quantity of several as several places', async () => {
    // One line, three entries: an activity that lets a member enter siblings at
    // once takes three places with a single basket row.
    const [event] = await list(
      [eventRow()],
      [activityRow({ applicants_limit: 5 })],
      [holdRow({ places: 3 })]
    );

    expect(event.activities[0].placesRemaining).toBe(2);
  });

  it("spends an event's own cap on holds against any of its activities", async () => {
    const [event] = await list(
      [eventRow({ limit_entries: true, entries_limit: 3, entry_count: 1 })],
      [activityRow({ id: 'act-1' }), activityRow({ id: 'act-2' })],
      [holdRow({ activity_id: 'act-1' }), holdRow({ activity_id: 'act-2' })]
    );

    expect(event.placesRemaining).toBe(0);
    expect(event.unavailableReason).toBe('held-by-others');
  });

  it('leaves uncapped activities entirely alone', async () => {
    // Nothing to contend over, so nothing is held and nothing is counted.
    const [event] = await list(
      [eventRow()],
      [activityRow({ limit_applicants: false, applicants_limit: null })],
      [holdRow({ places: 99 })]
    );

    expect(event.activities[0]).toMatchObject({
      available: true,
      placesRemaining: null,
    });
  });

  it('does not ask about holds when the club has no activities', async () => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(
      new AccountCatalogueService().listEvents(ORG, USER, TODAY)
    ).resolves.toEqual([]);
  });
});
