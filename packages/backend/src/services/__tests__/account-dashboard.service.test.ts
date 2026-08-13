import { AccountDashboardService } from '../account-dashboard.service';
import { accountActivityService } from '../account-activity.service';
import { accountCatalogueService } from '../account-catalogue.service';
import { cartService } from '../cart.service';

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

const activity = accountActivityService as jest.Mocked<typeof accountActivityService>;
const catalogue = accountCatalogueService as jest.Mocked<typeof accountCatalogueService>;
const cart = cartService as jest.Mocked<typeof cartService>;

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

      expect(dashboard.membership).toBeNull();
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

  describe('the membership card', () => {
    it('picks the one expiring soonest, since that is the one with something to do', async () => {
      activity.listMemberships.mockResolvedValue([
        membership({ id: 'later', validUntil: '2028-01-01' }),
        membership({ id: 'sooner', validUntil: '2026-09-01' }),
      ] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).membership?.id).toBe('sooner');
    });

    it('ignores memberships that are not active', async () => {
      activity.listMemberships.mockResolvedValue([membership({ status: 'elapsed' })] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).membership).toBeNull();
    });

    /** The renewal rule is C4's, read here rather than recomputed. */
    it('carries the renewal flags through untouched', async () => {
      activity.listMemberships.mockResolvedValue([
        membership({ canRenew: true, renewalNotOpen: false, daysRemaining: 12 }),
      ] as any);

      expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).membership).toMatchObject({
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
      expect(dashboard.membership).toBeDefined();
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

  it('shows the three most recent payments', async () => {
    activity.listPayments.mockResolvedValue([
      { id: 'p1', total: 100, status: 'paid', currency: 'EUR', paidOn: '2026-08-01', createdAt: '' },
      { id: 'p2', total: 200, status: 'paid', currency: 'EUR', paidOn: '2026-07-01', createdAt: '' },
      { id: 'p3', total: 300, status: 'paid', currency: 'EUR', paidOn: '2026-06-01', createdAt: '' },
      { id: 'p4', total: 400, status: 'paid', currency: 'EUR', paidOn: '2026-05-01', createdAt: '' },
    ] as any);

    const payments = (await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).recentPayments;

    expect(payments).toHaveLength(3);
    expect(payments?.[0].id).toBe('p1');
  });

  /** An unpaid offline order has no payment date yet, but is still a payment. */
  it('falls back to when a payment was created if it has no paid date', async () => {
    activity.listPayments.mockResolvedValue([
      {
        id: 'p1',
        total: 100,
        status: 'awaiting_offline',
        currency: 'EUR',
        paidOn: null,
        createdAt: '2026-08-02',
      },
    ] as any);

    expect((await service.build(ORG, MEMBER, ALL, 'EUR', TODAY)).recentPayments?.[0].on).toBe(
      '2026-08-02'
    );
  });
});
