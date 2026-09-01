import { AccountDashboardService } from '../account-dashboard.service';
import { accountActivityService } from '../account-activity.service';
import { accountCatalogueService } from '../account-catalogue.service';
import { cartService } from '../cart.service';
import { db } from '../../database/pool';

jest.mock('../../config/logger');
jest.mock('../account-activity.service', () => ({
  accountActivityService: {
    listEntries: jest.fn(),
    listBookings: jest.fn(),
    listMemberships: jest.fn(),
    listPayments: jest.fn(),
  },
}));
jest.mock('../account-catalogue.service', () => ({
  accountCatalogueService: {
    listEvents: jest.fn(),
    listMerchandise: jest.fn(),
    listCalendars: jest.fn(),
    listRegistrationTypes: jest.fn(),
  },
}));
jest.mock('../cart.service', () => ({ cartService: { getCart: jest.fn() } }));
jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));

const activity = accountActivityService as jest.Mocked<typeof accountActivityService>;
const catalogue = accountCatalogueService as jest.Mocked<typeof accountCatalogueService>;
const cart = cartService as jest.Mocked<typeof cartService>;
const mockDb = db as jest.Mocked<typeof db>;

/**
 * B3, assembled server-side.
 *
 * Two properties matter more than the contents of any card:
 *
 *  - **A section the club has not enabled is `null`, not empty.** The screen
 *    renders nothing for it. An empty card for a feature the club never
 *    switched on reads as a broken page.
 *  - **Nothing here decides anything.** Every figure comes from the service
 *    that owns it; the dashboard reads, sorts and truncates.
 */
describe('AccountDashboardService', () => {
  const ORG = 'org-1';
  const MEMBER = 'ou-1';
  const TODAY = new Date(2026, 7, 12);
  const ALL = [
    'event-management',
    'calendar-bookings',
    'memberships',
    'merchandise',
    'registrations',
  ];

  const service = new AccountDashboardService();

  const entry = (over: Record<string, any> = {}) => ({
    id: 'entry-1',
    eventName: 'Spring Hunter Trials',
    activityName: 'Class 2',
    entrantName: 'Rónán McGrath',
    startDate: '2026-09-14',
    status: 'confirmed',
    ...over,
  });

  const booking = (over: Record<string, any> = {}) => ({
    id: 'booking-1',
    calendarName: 'Court 1',
    bookingDate: '2026-08-20',
    startTime: '10:00',
    endTime: '11:00',
    bookingStatus: 'confirmed',
    status: 'confirmed',
    ...over,
  });

  const membership = (over: Record<string, any> = {}) => ({
    id: 'member-1',
    membershipNumber: 'KHPC-0412',
    membershipTypeName: 'Family Membership 2026',
    memberName: 'Niamh Walsh',
    status: 'active',
    validUntil: '2027-02-25',
    daysRemaining: 200,
    canRenew: false,
    renewalNotOpen: false,
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    activity.listEntries.mockResolvedValue([] as any);
    activity.listBookings.mockResolvedValue([] as any);
    activity.listMemberships.mockResolvedValue([] as any);
    activity.listPayments.mockResolvedValue([] as any);
    cart.getCart.mockResolvedValue({
      currency: 'EUR',
      items: [],
      totals: { orderTotal: 0, handlingFee: { total: 0 } },
    } as any);
    catalogue.listEvents.mockResolvedValue([] as any);
    catalogue.listMerchandise.mockResolvedValue([] as any);
    catalogue.listCalendars.mockResolvedValue([] as any);
    catalogue.listRegistrationTypes.mockResolvedValue([] as any);
  });

  describe('what the club has not enabled', () => {
    it('asks for nothing it cannot show', async () => {
      await service.build(ORG, MEMBER, [], 'EUR', TODAY);

      expect(activity.listEntries).not.toHaveBeenCalled();
      expect(activity.listBookings).not.toHaveBeenCalled();
      expect(activity.listMemberships).not.toHaveBeenCalled();
      expect(catalogue.listMerchandise).not.toHaveBeenCalled();
    });

    it('returns null for those sections rather than an empty list', async () => {
      const dashboard = await service.build(ORG, MEMBER, [], 'EUR', TODAY);

      expect(dashboard.memberships).toBeNull();
      expect(dashboard.comingUp).toBeNull();
      expect(dashboard.whatsOn).toEqual([]);
    });

    /** Enabled but with nothing in it is a different answer from not enabled. */
    it('returns an empty list when the area is enabled and has nothing', async () => {
      const dashboard = await service.build(ORG, MEMBER, ['event-management'], 'EUR', TODAY);

      expect(dashboard.comingUp).toEqual([]);
    });
  });

  describe('coming up', () => {
    it('merges entries and bookings, soonest first', async () => {
      activity.listEntries.mockResolvedValue([entry()] as any);
      activity.listBookings.mockResolvedValue([booking()] as any);

      const dashboard = await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

      expect(dashboard.comingUp?.map((item) => item.title)).toEqual([
        // 20 August before 14 September.
        'Court 1',
        'Spring Hunter Trials',
      ]);
    });

    /*
     * Who each one is for.
     *
     * A parent's four children in the same class produce four rows here that
     * are otherwise identical — same event, same class, same date.
     */
    it('carries the entrant name through to the card', async () => {
      activity.listEntries.mockResolvedValue([entry()] as any);

      const dashboard = await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

      expect(dashboard.comingUp?.[0]).toMatchObject({
        title: 'Spring Hunter Trials',
        detail: 'Class 2',
        entrantName: 'Rónán McGrath',
      });
    });

    /* A booking is the account holder's own; there is nobody else to name. */
    it('leaves a booking without one', async () => {
      activity.listBookings.mockResolvedValue([booking()] as any);

      const dashboard = await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

      expect(dashboard.comingUp?.[0]).toMatchObject({ kind: 'booking', entrantName: null });
    });

    it('reports a nameless entry as having none, rather than as a blank', async () => {
      activity.listEntries.mockResolvedValue([entry({ entrantName: '' })] as any);

      const dashboard = await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

      expect(dashboard.comingUp?.[0].entrantName).toBeNull();
    });

    /** This card is about what to turn up to. */
    it('drops anything already past', async () => {
      activity.listEntries.mockResolvedValue([entry({ startDate: '2026-01-01' })] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).comingUp).toEqual([]);
    });

    it('keeps something happening today', async () => {
      activity.listBookings.mockResolvedValue([booking({ bookingDate: '2026-08-12' })] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).comingUp).toHaveLength(1);
    });

    it('drops a cancelled booking', async () => {
      activity.listBookings.mockResolvedValue([booking({ bookingStatus: 'cancelled' })] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).comingUp).toEqual([]);
    });

    it('shows at most three', async () => {
      activity.listBookings.mockResolvedValue([
        booking({ id: 'b1', bookingDate: '2026-08-13' }),
        booking({ id: 'b2', bookingDate: '2026-08-14' }),
        booking({ id: 'b3', bookingDate: '2026-08-15' }),
        booking({ id: 'b4', bookingDate: '2026-08-16' }),
      ] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).comingUp).toHaveLength(3);
    });
  });

  describe('the memberships section', () => {
    it('returns every active membership, soonest to expire first', async () => {
      // A parent holds their children's; one card about the soonest left the
      // rest invisible until they thought to open C4.
      activity.listMemberships.mockResolvedValue([
        membership({ id: 'later', validUntil: '2028-01-01' }),
        membership({ id: 'sooner', validUntil: '2026-09-01' }),
        membership({ id: 'middle', validUntil: '2027-06-01' }),
      ] as any);

      const dashboard = await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

      expect(dashboard.memberships?.map((m) => m.id)).toEqual(['sooner', 'middle', 'later']);
    });

    it('says whose each membership is', async () => {
      activity.listMemberships.mockResolvedValue([
        membership({ memberName: 'Conor McGrath' }),
      ] as any);

      const dashboard = await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

      expect(dashboard.memberships?.[0]?.memberName).toBe('Conor McGrath');
    });

    it('leaves out anything not currently held', async () => {
      activity.listMemberships.mockResolvedValue([
        membership({ id: 'm1', memberName: 'Conor McGrath' }),
        membership({ id: 'm2', memberName: 'Old One', status: 'elapsed' }),
        membership({ id: 'm3', memberName: 'Not Yet', status: 'pending' }),
      ] as any);

      const dashboard = await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

      expect(dashboard.memberships?.map((m) => m.memberName)).toEqual(['Conor McGrath']);
    });

    it('returns an empty list when the member holds none', async () => {
      // Different from the club having no memberships at all, which is null.
      activity.listMemberships.mockResolvedValue([membership({ status: 'elapsed' })] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).memberships).toEqual([]);
    });

    /** The renewal rule is C4's, read here rather than recomputed. */
    it('carries the renewal flags through untouched', async () => {
      activity.listMemberships.mockResolvedValue([
        membership({ canRenew: true, renewalNotOpen: false, daysRemaining: 12 }),
      ] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).memberships?.[0]).toMatchObject({
        canRenew: true,
        daysRemaining: 12,
      });
    });
  });

  describe('the basket', () => {
    it('reports the count and the total the cart service worked out', async () => {
      cart.getCart.mockResolvedValue({
        currency: 'EUR',
        items: [{ id: 'a' }, { id: 'b' }],
        totals: { orderTotal: 28845, handlingFee: { total: 145 } },
      } as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).cart).toEqual({
        itemCount: 2,
        total: 28845,
        handlingFee: 145,
        currency: 'EUR',
      });
    });

    it('is absent when the basket is empty', async () => {
      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).cart).toBeNull();
    });

    /** A dashboard is not worth failing over a basket. */
    it('drops the card rather than failing the screen when the cart cannot be read', async () => {
      cart.getCart.mockRejectedValue(new Error('cart exploded'));

      const dashboard = await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

      expect(dashboard.cart).toBeNull();
      expect(dashboard.memberships).toBeDefined();
    });
  });

  describe('what’s on', () => {
    const available = (over: Record<string, any> = {}) => ({ available: true, ...over });

    it('offers one of each kind before a second of any', async () => {
      catalogue.listMerchandise.mockResolvedValue([
        available({ id: 'm1', name: 'Polo', description: null, fromPrice: 2500 }),
        available({ id: 'm2', name: 'Cap', description: null, fromPrice: 1000 }),
        available({ id: 'm3', name: 'Scarf', description: null, fromPrice: 900 }),
        available({ id: 'm4', name: 'Mug', description: null, fromPrice: 800 }),
      ] as any);
      catalogue.listEvents.mockResolvedValue([
        available({ id: 'e1', name: 'Summer Camp', startDate: '2026-08-12' }),
      ] as any);

      const kinds = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn.map(
        (item) => item.kind
      );

      // A club with four shirts and one event must not hide the event.
      expect(kinds).toContain('event');
      expect(kinds).toContain('merchandise');
    });

    it('never offers something the member cannot act on', async () => {
      catalogue.listMerchandise.mockResolvedValue([
        available({ id: 'm1', name: 'Polo', description: null, fromPrice: 2500 }),
        { id: 'm2', name: 'Sold out', description: null, fromPrice: 900, available: false },
      ] as any);

      const items = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;

      expect(items.map((item) => item.title)).toEqual(['Polo']);
    });

    /*
     * Events are the exception to the rule above: their unavailability is
     * itself the news, and each card carries a status chip saying which.
     */
    describe('events the member cannot enter', () => {
      const unavailable = (reason: string, over: Record<string, any> = {}) => ({
        available: false,
        unavailableReason: reason,
        ...over,
      });

      it('teases an event whose entries open in the next few days', async () => {
        catalogue.listEvents.mockResolvedValue([
          unavailable('entries-not-open', {
            id: 'e1',
            name: 'Autumn Camp',
            entriesOpenDate: '2026-08-14T09:00:00Z',
          }),
        ] as any);

        const items = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;

        expect(items.map((item) => item.title)).toEqual(['Autumn Camp']);
      });

      it('leaves out an event that opens further off', async () => {
        catalogue.listEvents.mockResolvedValue([
          unavailable('entries-not-open', {
            id: 'e1',
            name: 'Christmas Rally',
            entriesOpenDate: '2026-09-01T09:00:00Z',
          }),
        ] as any);

        const items = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;

        // Not news yet, and it would push out something closing this week.
        expect(items).toEqual([]);
      });

      it('teases an event whose entries have closed', async () => {
        catalogue.listEvents.mockResolvedValue([
          unavailable('entries-closed', {
            id: 'e1',
            name: 'Spring League',
            entriesClosingDate: '2026-08-01T09:00:00Z',
          }),
        ] as any);

        const items = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;

        expect(items.map((item) => item.title)).toEqual(['Spring League']);
      });

      it('teases an event that has filled up', async () => {
        catalogue.listEvents.mockResolvedValue([
          unavailable('event-full', {
            id: 'e1',
            name: 'Summer Camp',
            entriesLimit: 40,
            placesRemaining: 0,
          }),
        ] as any);

        const items = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;

        expect(items.map((item) => item.title)).toEqual(['Summer Camp']);
      });

      it('leaves out an event the member has already entered', async () => {
        catalogue.listEvents.mockResolvedValue([
          unavailable('already-entered', { id: 'e1', name: 'Hunter Trials' }),
        ] as any);

        const items = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;

        // They have no reason to be shown it.
        expect(items).toEqual([]);
      });

      it('carries the window and capacity so the card can say which it is', async () => {
        catalogue.listEvents.mockResolvedValue([
          unavailable('event-full', {
            id: 'e1',
            name: 'Summer Camp',
            startDate: '2026-09-01',
            endDate: '2026-09-03',
            entriesOpenDate: '2026-07-01T09:00:00Z',
            entriesClosingDate: '2026-10-01T09:00:00Z',
            entriesLimit: 40,
            placesRemaining: 0,
          }),
        ] as any);

        const [item] = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;

        expect(item).toMatchObject({
          startDate: '2026-09-01',
          endDate: '2026-09-03',
          entriesOpenDate: '2026-07-01T09:00:00Z',
          entriesClosingDate: '2026-10-01T09:00:00Z',
          entriesLimit: 40,
          placesRemaining: 0,
        });
      });
    });

    it('gives bookings their own allowance rather than sharing the four', async () => {
      // Three calendars alongside a shop and events used to show exactly one
      // calendar, which looked broken beside a bookings page listing three.
      catalogue.listMerchandise.mockResolvedValue([
        available({ id: 'm1', name: 'Polo', description: null, fromPrice: 2500 }),
        available({ id: 'm2', name: 'Cap', description: null, fromPrice: 1000 }),
      ] as any);
      catalogue.listEvents.mockResolvedValue([
        available({ id: 'e1', name: 'Summer Camp', startDate: '2026-08-20' }),
      ] as any);
      catalogue.listCalendars.mockResolvedValue([
        available({ id: 'c1', name: 'Arena', description: null }),
        available({ id: 'c2', name: 'Lessons', description: null }),
        available({ id: 'c3', name: 'Cross-country', description: null }),
      ] as any);

      const items = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;
      const calendars = items.filter((item) => item.kind === 'calendar');

      expect(calendars.map((c) => c.title)).toEqual(['Arena', 'Lessons', 'Cross-country']);
    });

    it('gives the shop its own row too, with a thumbnail', async () => {
      catalogue.listMerchandise.mockResolvedValue([
        available({
          id: 'm1', name: 'Polo', description: null, fromPrice: 2500,
          images: ['data:image/svg+xml;base64,PHN2Zy8+'],
        }),
        available({ id: 'm2', name: 'Cap', description: null, fromPrice: 1000, images: [] }),
      ] as any);

      const items = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;
      const shop = items.filter((item) => item.kind === 'merchandise');

      expect(shop.map((i) => i.title)).toEqual(['Polo', 'Cap']);
      expect(shop[0]!.imageUrl).toMatch(/^data:image/);
      // No image is null rather than undefined, so the card can test for it.
      expect(shop[1]!.imageUrl).toBeNull();
    });

    it('still caps each row', async () => {
      catalogue.listCalendars.mockResolvedValue(
        Array.from({ length: 7 }, (_, index) =>
          available({ id: `c${index}`, name: `Calendar ${index}`, description: null })
        ) as any
      );

      const items = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn;

      expect(items.filter((item) => item.kind === 'calendar')).toHaveLength(4);
    });

    it('shows at most four', async () => {
      catalogue.listMerchandise.mockResolvedValue(
        Array.from({ length: 6 }, (_, index) => ({
          id: `m${index}`,
          name: `Item ${index}`,
          description: null,
          fromPrice: 100,
          available: true,
        })) as any
      );

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn).toHaveLength(4);
    });

    /** An event's price lives on its activities, and they differ. */
    it('leaves an event unpriced rather than inventing a figure', async () => {
      catalogue.listEvents.mockResolvedValue([
        available({ id: 'e1', name: 'Summer Camp', startDate: '2026-08-12' }),
      ] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).whatsOn[0].fee).toBeNull();
    });

    it('drops the row rather than failing the screen when a catalogue throws', async () => {
      catalogue.listMerchandise.mockRejectedValue(new Error('catalogue exploded'));

      const dashboard = await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

      expect(dashboard.whatsOn).toEqual([]);
      expect(dashboard.comingUp).toBeDefined();
    });
  });

  /**
   * The home screen no longer carries a recent-payments card, so the dashboard
   * no longer reads payments. Worth pinning rather than leaving to the type: the
   * list was fetched inside the `Promise.all`, where an unused branch costs
   * every member a query on the first screen they see and nothing fails to say
   * so. Payments have their own page, which is where they are asked for.
   */
  it('does not read payments at all', async () => {
    await service.build(ORG, MEMBER, ALL, 'EUR', TODAY);

    expect(activity.listPayments).not.toHaveBeenCalled();
  });
});


/**
 * Events another branch is running.
 *
 * The federation case: an activity opened across the organisation type has to
 * become visible to the other branches, or nobody it was opened to will ever
 * know it exists.
 *
 * See docs/MEMBERS_ONLY_ENTRIES.md §7.
 */
describe('AccountDashboardService — events at other organisations', () => {
  const ORG = 'org-1';
  const MEMBER = 'ou-1';
  const TODAY = new Date(2026, 7, 12);

  const service = () => new AccountDashboardService();

  const externalRow = (over: Record<string, any> = {}) => ({
    id: 'ev-9',
    name: 'Ward Union Open Show',
    start_date: new Date('2026-09-05'),
    end_date: new Date('2026-09-05'),
    entries_closing_date: new Date('2026-09-01'),
    organisation_name: 'Ward Union Pony Club',
    organisation_type_name: 'Irish Pony Clubs',
    url_code: 'wupc',
    already_joined: false,
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    activity.listEntries.mockResolvedValue([]);
    activity.listBookings.mockResolvedValue([]);
    activity.listMemberships.mockResolvedValue([]);
    catalogue.listEvents.mockResolvedValue([]);
    catalogue.listMerchandise.mockResolvedValue([]);
    catalogue.listCalendars.mockResolvedValue([]);
    catalogue.listRegistrationTypes.mockResolvedValue([]);
    cart.getCart.mockResolvedValue(null as any);
    mockDb.query = jest.fn().mockResolvedValue({ rows: [] });
  });

  const build = () => service().build(ORG, MEMBER, ['event-management'], 'EUR', TODAY);

  it('lists an event another branch has opened across the type', async () => {
    mockDb.query = jest.fn().mockResolvedValue({ rows: [externalRow()] });

    const dashboard = await build();

    expect(dashboard.externalEvents).toHaveLength(1);
    expect(dashboard.externalEvents[0].organisationName).toBe('Ward Union Pony Club');
    expect(dashboard.externalEvents[0].organisationCode).toBe('wupc');
  });

  it('keeps them out of "what\'s on"', async () => {
    /*
     * Nothing here can be entered from this club. Folding them into `whatsOn`
     * would leave every consumer of that list to rediscover the difference, and
     * the first to forget would offer an "Enter" button that leads nowhere.
     */
    mockDb.query = jest.fn().mockResolvedValue({ rows: [externalRow()] });

    const dashboard = await build();

    expect(dashboard.whatsOn).toEqual([]);
  });

  it('names the federation, for the section label', async () => {
    /*
     * The label reads "open to all members of Irish Pony Clubs". "Organisations
     * of the same type" is how the platform thinks about it; the type's own
     * name is the only form of the sentence a member can check against what
     * they know they belong to.
     */
    mockDb.query = jest.fn().mockResolvedValue({ rows: [externalRow()] });

    expect((await build()).organisationTypeName).toBe('Irish Pony Clubs');
  });

  it('leaves the federation unnamed when there is nothing to label', async () => {
    // Null rather than a lookup no dashboard without external events will read.
    expect((await build()).organisationTypeName).toBeNull();
  });

  it('says whether the member already belongs to the organising club', async () => {
    // Being asked to join something you already belong to reads as the software
    // not knowing you.
    mockDb.query = jest.fn().mockResolvedValue({ rows: [externalRow({ already_joined: true })] });

    expect((await build()).externalEvents[0].alreadyJoined).toBe(true);
  });

  it('asks only for other clubs of the same type, with the option actually set', async () => {
    await build();

    const sql = String((mockDb.query as jest.Mock).mock.calls[0][0]);

    expect(sql).toContain('organization_type_id');
    expect(sql).toContain('o.id <> $1');
    expect(sql).toContain("a.entry_eligibility = 'org-type-members'");
    // An activity the organiser has hidden is not other branches' business.
    expect(sql).toContain('a.show_publicly = TRUE');
  });

  it('does not fail the dashboard when the lookup fails', async () => {
    // A cross-club courtesy is not worth failing a member's home page over.
    mockDb.query = jest.fn().mockRejectedValue(new Error('nope'));

    const dashboard = await build();

    expect(dashboard.externalEvents).toEqual([]);
    expect(dashboard.whatsOn).toEqual([]);
  });
});
