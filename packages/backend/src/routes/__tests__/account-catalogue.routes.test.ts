import express from 'express';
import type { Server } from 'http';
import request from 'supertest';

/**
 * The member-facing catalogue endpoints — shop and calendars — and the guard on
 * the basket.
 *
 * The guard is the part worth pinning down. `cartService.addItem` trusts its
 * caller by design, so until now a POST could add a sold-out size, ten of
 * something limited to two, or a court somebody else had already booked — none
 * of which the screens offer, and all of which the club would have to unpick
 * after the money arrived.
 */

jest.mock('../../config/logger');
/*
 * The routes reach the database directly in one place: the duplicate-booking
 * check, which asks the basket whether this slot is already in it. Defaulted to
 * "no rows" so every other case behaves as it did.
 */
jest.mock('../../database/pool', () => ({
  db: { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
}));

jest.mock('../../services/account-organisation.service', () => ({
  accountOrganisationService: {
    resolveMembership: jest.fn(),
    getOrganisationIdByCode: jest.fn(),
  },
}));

jest.mock('../../services/account-catalogue.service', () => ({
  accountCatalogueService: {
    listMerchandise: jest.fn(),
    assertMerchandiseAvailable: jest.fn(),
    assertActivityAvailable: jest.fn(),
    findActivity: jest.fn(),
    listRegistrationTypes: jest.fn(),
    assertRegistrationTypeAvailable: jest.fn(),
    listCalendars: jest.fn(),
    listCalendarAvailability: jest.fn(),
    assertSlotAvailable: jest.fn(),
  },
}));

jest.mock('../../services/account-activity.service', () => ({
  accountActivityService: {
    listMerchandiseOrders: jest.fn(),
    listRegistrations: jest.fn(),
    listPayments: jest.fn(),
    cancelBooking: jest.fn(),
  },
}));

jest.mock('../../services/cart.service', () => ({
  cartService: { addItem: jest.fn() },
}));

jest.mock('../../services/account-dashboard.service', () => ({
  accountDashboardService: { build: jest.fn() },
}));

jest.mock('../../services/form-submission.service', () => ({
  FormSubmissionService: class {},
  formSubmissionService: { createSubmission: jest.fn() },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-1', email: 'm@example.com', username: 'm', roles: [], groups: [] };
    return next();
  },
}));

import { db } from '../../database/pool';
import { accountOrganisationService } from '../../services/account-organisation.service';
import { accountCatalogueService } from '../../services/account-catalogue.service';
import { accountActivityService } from '../../services/account-activity.service';
import { cartService } from '../../services/cart.service';
import { accountDashboardService } from '../../services/account-dashboard.service';
import { ValidationError, NotFoundError } from '../../middleware/errors';
import accountRoutes from '../account.routes';

const mockedOrg = accountOrganisationService as jest.Mocked<typeof accountOrganisationService>;
const mockedCatalogue = accountCatalogueService as jest.Mocked<typeof accountCatalogueService>;
const mockedActivity = accountActivityService as jest.Mocked<typeof accountActivityService>;
const mockedCart = cartService as jest.Mocked<typeof cartService>;
const mockedDb = db as jest.Mocked<typeof db>;
const mockedDashboard = accountDashboardService as jest.Mocked<typeof accountDashboardService>;

const app = express();
app.use(express.json());
app.use('/api/account', accountRoutes);

const membership = (capabilities: string[]) => ({
  ok: true,
  membership: {
    organisationId: 'org-1',
    organisationUserId: 'ou-1',
    urlCode: 'khpc',
    displayName: 'Kildare Hunt Pony Club',
    currency: 'EUR',
    language: 'en-GB',
    capabilities,
    status: 'active',
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedOrg.resolveMembership.mockResolvedValue(membership(['merchandise']) as any);
  mockedCatalogue.listMerchandise.mockResolvedValue([]);
  mockedActivity.listMerchandiseOrders.mockResolvedValue([]);
  mockedCart.addItem.mockResolvedValue({ id: 'line-1' } as any);
  mockedCatalogue.assertMerchandiseAvailable.mockResolvedValue({ id: 'item-1' } as any);
  mockedActivity.listRegistrations.mockResolvedValue([]);
  mockedActivity.listPayments.mockResolvedValue([]);
  mockedActivity.cancelBooking.mockResolvedValue({ refundExpected: false });
  mockedCatalogue.listRegistrationTypes.mockResolvedValue([]);
  mockedCatalogue.assertRegistrationTypeAvailable.mockResolvedValue({ id: 'rt-1' } as any);
  mockedCatalogue.listCalendars.mockResolvedValue([]);
  mockedCatalogue.listCalendarAvailability.mockResolvedValue({ calendar: {}, slots: [] } as any);
  mockedCatalogue.assertSlotAvailable.mockResolvedValue({} as any);
  mockedDashboard.build.mockResolvedValue({ whatsOn: [] } as any);
});


/*
 * One listener for the whole file.
 *
 * `request(app)` starts a server on a fresh ephemeral port for every call. Over
 * a run that makes thousands of them, ports get reused while the previous
 * connection's packets are still in flight, and the client reads bytes that are
 * not a response at all — "Parse Error: Expected HTTP/", a hang-up, or somebody
 * else's reply. One listener per file removes that churn.
 */
let server: Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

describe('GET /api/account/:orgCode/catalogue/merchandise', () => {

  it('serves the catalogue for a club with the capability', async () => {
    const response = await request(server).get('/api/account/khpc/catalogue/merchandise');

    expect(response.status).toBe(200);
    expect(mockedCatalogue.listMerchandise).toHaveBeenCalledWith('org-1');
  });

  it('is refused for a club without it', async () => {
    mockedOrg.resolveMembership.mockResolvedValue(membership(['memberships']) as any);

    expect((await request(server).get('/api/account/khpc/catalogue/merchandise')).status).toBe(403);
  });
});

describe('GET /api/account/:orgCode/orders', () => {
  it('asks for this member’s orders, from the session rather than the request', async () => {
    const response = await request(server).get('/api/account/khpc/orders');

    expect(response.status).toBe(200);
    expect(mockedActivity.listMerchandiseOrders).toHaveBeenCalledWith('org-1', 'ou-1');
  });

  it('is refused for a club without merchandise', async () => {
    mockedOrg.resolveMembership.mockResolvedValue(membership([]) as any);

    expect((await request(server).get('/api/account/khpc/orders')).status).toBe(403);
  });
});

describe('POST /api/account/:orgCode/cart/items', () => {
  const merchandiseLine = {
    itemType: 'merchandise',
    contextRef: { merchandiseTypeId: 'item-1', selectedOptions: { 'opt-size': 'val-l' } },
    quantity: 2,
    description: 'Club polo — Large',
    unitFee: 2750,
    supportedPaymentMethodIds: ['pm-card'],
  };

  it('checks the item, options and quantity before adding', async () => {
    const response = await request(server)
      .post('/api/account/khpc/cart/items')
      .send(merchandiseLine);

    expect(response.status).toBe(201);
    expect(mockedCatalogue.assertMerchandiseAvailable).toHaveBeenCalledWith(
      'org-1',
      'item-1',
      ['val-l'],
      2
    );
  });

  it('refuses the line, with the reason, when the catalogue says no', async () => {
    mockedCatalogue.assertMerchandiseAvailable.mockRejectedValue(
      new ValidationError('Only 1 left of Large')
    );

    const response = await request(server)
      .post('/api/account/khpc/cart/items')
      .send(merchandiseLine);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Only 1 left of Large');
    expect(mockedCart.addItem).not.toHaveBeenCalled();
  });

  /** The guard that existed but was never wired. */
  it('checks an event entry against the catalogue too', async () => {
    mockedCatalogue.findActivity.mockResolvedValue({
      event: { entriesLimit: null },
      activity: { available: false, entriesLimit: null },
    } as any);

    const response = await request(server)
      .post('/api/account/khpc/cart/items')
      .send({ itemType: 'event-entry', contextRef: { activityId: 'act-1' }, unitFee: 2500 });

    expect(response.status).toBe(400);
    expect(mockedCart.addItem).not.toHaveBeenCalled();
  });

  it('adds an entry the catalogue still offers', async () => {
    mockedCatalogue.findActivity.mockResolvedValue({
      event: { entriesLimit: null },
      activity: { available: true, entriesLimit: null },
    } as any);

    const response = await request(server)
      .post('/api/account/khpc/cart/items')
      .send({ itemType: 'event-entry', contextRef: { activityId: 'act-1' }, unitFee: 2500 });

    expect(response.status).toBe(201);
    expect(mockedCart.addItem).toHaveBeenCalled();
  });

  /**
   * An uncapped entry is not contended, so it takes no hold. Giving it one
   * would drop the line out of the basket total two minutes later for nothing.
   */
  it('holds nothing for an entry with no limit anywhere', async () => {
    mockedCatalogue.findActivity.mockResolvedValue({
      event: { entriesLimit: null },
      activity: { available: true, entriesLimit: null },
    } as any);

    await request(server)
      .post('/api/account/khpc/cart/items')
      .send({ itemType: 'event-entry', contextRef: { activityId: 'act-1' }, unitFee: 2500 });

    expect(mockedCart.addItem).toHaveBeenCalledWith(
      'org-1',
      'ou-1',
      'EUR',
      expect.objectContaining({ expiresAt: null })
    );
  });

  it('holds a capped entry, so two members cannot take the last place', async () => {
    mockedCatalogue.findActivity.mockResolvedValue({
      event: { entriesLimit: null },
      activity: { available: true, entriesLimit: 20 },
    } as any);

    await request(server)
      .post('/api/account/khpc/cart/items')
      .send({ itemType: 'event-entry', contextRef: { activityId: 'act-1' }, unitFee: 2500 });

    expect(mockedCart.addItem).toHaveBeenCalledWith(
      'org-1',
      'ou-1',
      'EUR',
      expect.objectContaining({ expiresAt: expect.any(Date) })
    );
  });

  it("holds an entry capped only at the event's level", async () => {
    // The cap can live at either level; an activity with no limit of its own is
    // still constrained by an event limited to 60 entries.
    mockedCatalogue.findActivity.mockResolvedValue({
      event: { entriesLimit: 60 },
      activity: { available: true, entriesLimit: null },
    } as any);

    await request(server)
      .post('/api/account/khpc/cart/items')
      .send({ itemType: 'event-entry', contextRef: { activityId: 'act-1' }, unitFee: 2500 });

    expect(mockedCart.addItem).toHaveBeenCalledWith(
      'org-1',
      'ou-1',
      'EUR',
      expect.objectContaining({ expiresAt: expect.any(Date) })
    );
  });

  /**
   * Every type the basket allows now has a check, so this is about one it does
   * not recognise: it passes rather than being refused, because inventing a
   * rule here would be worse than enforcing none.
   */
  it('lets an unrecognised item type through unchecked', async () => {
    const response = await request(server)
      .post('/api/account/khpc/cart/items')
      .send({ itemType: 'something-else', contextRef: {}, unitFee: 1000 });

    expect(response.status).toBe(201);
    expect(mockedCatalogue.assertMerchandiseAvailable).not.toHaveBeenCalled();
    expect(mockedCatalogue.findActivity).not.toHaveBeenCalled();
    expect(mockedCatalogue.assertSlotAvailable).not.toHaveBeenCalled();
  });

  /**
   * Members-only entries — the check that actually protects the club.
   *
   * The listing hides the button and the entry form refuses to render, but
   * neither has stopped anyone who can type a URL, and this decides who gets
   * into a club's event. The candidates come from `eligibleMembers`, which the
   * catalogue builds from *this* login's own active memberships — so a member
   * id belonging to somebody else is simply not in the list.
   *
   * See docs/MEMBERS_ONLY_ENTRIES.md.
   */
  describe('members-only activities', () => {
    const membersOnlyActivity = (members: any[], over: Record<string, any> = {}) => ({
      event: { entriesLimit: null },
      activity: {
        available: true,
        entriesLimit: null,
        membersOnly: true,
        entryEligibility: 'members',
        eligibleMembers: members,
        ...over,
      },
    });

    const saoirse = {
      id: 'mem-1',
      name: 'Saoirse Byrne',
      membershipTypeName: 'Junior Member',
      membershipNumber: 'KHP-0241',
      alreadyEntered: false,
    };

    const entry = (contextRef: Record<string, unknown>) => ({
      itemType: 'event-entry',
      contextRef: { activityId: 'act-1', ...contextRef },
      unitFee: 2000,
    });

    it('refuses an entry that names no member', async () => {
      mockedCatalogue.findActivity.mockResolvedValue(membersOnlyActivity([saoirse]) as any);

      const response = await request(server)
        .post('/api/account/khpc/cart/items')
        .send(entry({}));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Choose which member/);
      expect(mockedCart.addItem).not.toHaveBeenCalled();
    });

    it('refuses a membership the caller does not hold', async () => {
      /*
       * The one that matters. Supplying somebody else's member id must not
       * enter their child in a class — and cannot, because the candidate list
       * was built from the caller's own memberships.
       */
      mockedCatalogue.findActivity.mockResolvedValue(membersOnlyActivity([saoirse]) as any);

      const response = await request(server)
        .post('/api/account/khpc/cart/items')
        .send(entry({ memberId: 'somebody-elses-child' }));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/not one you hold/);
      expect(mockedCart.addItem).not.toHaveBeenCalled();
    });

    it('refuses a member already entered', async () => {
      mockedCatalogue.findActivity.mockResolvedValue(
        membersOnlyActivity([{ ...saoirse, alreadyEntered: true }]) as any
      );

      const response = await request(server)
        .post('/api/account/khpc/cart/items')
        .send(entry({ memberId: 'mem-1' }));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Saoirse Byrne is already entered/);
    });

    it('refuses the same member twice in one basket', async () => {
      /*
       * `alreadyEntered` reads `event_entries`, which nothing has written yet —
       * both lines are still in the basket. Without this the parent pays twice
       * for one child, and the club has one entry and one refund to make.
       */
      mockedCatalogue.findActivity.mockResolvedValue(membersOnlyActivity([saoirse]) as any);
      mockedDb.query.mockResolvedValueOnce({ rows: [{ exists: 1 }], rowCount: 1 } as any);

      const response = await request(server)
        .post('/api/account/khpc/cart/items')
        .send(entry({ memberId: 'mem-1' }));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/already in your basket/);
      expect(mockedCart.addItem).not.toHaveBeenCalled();
    });

    it('adds an entry for a member the caller does hold', async () => {
      mockedCatalogue.findActivity.mockResolvedValue(membersOnlyActivity([saoirse]) as any);

      const response = await request(server)
        .post('/api/account/khpc/cart/items')
        .send(entry({ memberId: 'mem-1' }));

      expect(response.status).toBe(201);
      // The choice rides to fulfilment on the line itself.
      expect(mockedCart.addItem).toHaveBeenCalledWith(
        'org-1',
        'ou-1',
        'EUR',
        expect.objectContaining({
          contextRef: expect.objectContaining({ memberId: 'mem-1' }),
        })
      );
    });

    it('asks nothing of an open activity', async () => {
      // No member, no question. The rule applies only where entry is restricted.
      mockedCatalogue.findActivity.mockResolvedValue({
        event: { entriesLimit: null },
        activity: { available: true, entriesLimit: null, membersOnly: false, eligibleMembers: [] },
      } as any);

      const response = await request(server)
        .post('/api/account/khpc/cart/items')
        .send(entry({}));

      expect(response.status).toBe(201);
    });

    it('applies the same member check across the organisation type', async () => {
      /*
       * The third option changes *which* memberships qualify, not whether the
       * check runs. A member id from outside the caller's own set is still
       * refused — the catalogue built that set, scoped to the federation.
       */
      mockedCatalogue.findActivity.mockResolvedValue(
        membersOnlyActivity([{ ...saoirse, organisationName: 'Ward Union Pony Club' }], {
          entryEligibility: 'org-type-members',
        }) as any
      );

      const refused = await request(server)
        .post('/api/account/khpc/cart/items')
        .send(entry({ memberId: 'another-branchs-member' }));
      expect(refused.status).toBe(400);

      const accepted = await request(server)
        .post('/api/account/khpc/cart/items')
        .send(entry({ memberId: 'mem-1' }));
      expect(accepted.status).toBe(201);
    });
  });
});
/**
 * Availability is per calendar and per range, and the work is proportional to
 * the range — every slot on every configuration for every day. So the range is
 * checked before any of it is done.
 */
describe('GET /api/account/:orgCode/catalogue/calendars/:id/availability', () => {
  beforeEach(() => {
    mockedOrg.resolveMembership.mockResolvedValue(membership(['calendar-bookings']) as any);
  });

  it('serves a week', async () => {
    const response = await request(server).get(
      '/api/account/khpc/catalogue/calendars/cal-1/availability?from=2026-08-08&to=2026-08-14'
    );

    expect(response.status).toBe(200);
    expect(mockedCatalogue.listCalendarAvailability).toHaveBeenCalledWith(
      'org-1',
      'cal-1',
      '2026-08-08',
      '2026-08-14',
      expect.any(Date),
      // The viewer, so their own holds read as theirs rather than a stranger's.
      'ou-1'
    );
  });

  it.each([
    ['no range', ''],
    ['a malformed date', '?from=8th-August&to=2026-08-14'],
    ['a date that does not exist', '?from=2026-13-45&to=2026-13-46'],
    ['a range that runs backwards', '?from=2026-08-14&to=2026-08-08'],
    ['a range longer than two months', '?from=2026-01-01&to=2026-12-31'],
  ])('refuses %s', async (_label, query) => {
    const response = await request(server).get(
      `/api/account/khpc/catalogue/calendars/cal-1/availability${query}`
    );

    expect(response.status).toBe(400);
    expect(mockedCatalogue.listCalendarAvailability).not.toHaveBeenCalled();
  });

  it('reports a calendar from another club as not found', async () => {
    mockedCatalogue.listCalendarAvailability.mockRejectedValue(
      new NotFoundError('Calendar not found')
    );

    const response = await request(server).get(
      '/api/account/khpc/catalogue/calendars/cal-1/availability?from=2026-08-08&to=2026-08-14'
    );

    expect(response.status).toBe(404);
  });

  it('is refused for a club without the capability', async () => {
    mockedOrg.resolveMembership.mockResolvedValue(membership(['merchandise']) as any);

    expect(
      (
        await request(server).get(
          '/api/account/khpc/catalogue/calendars/cal-1/availability?from=2026-08-08&to=2026-08-14'
        )
      ).status
    ).toBe(403);
  });
});

describe('POST /api/account/:orgCode/cart/items — a booking', () => {
  const bookingLine = {
    itemType: 'booking',
    contextRef: {
      calendarId: 'cal-1',
      date: '2026-08-08',
      startTime: '09:00',
      duration: 60,
      places: 1,
    },
    unitFee: 1200,
    supportedPaymentMethodIds: ['pm-card'],
  };

  it('re-checks the slot before adding it', async () => {
    const response = await request(server).post('/api/account/khpc/cart/items').send(bookingLine);

    expect(response.status).toBe(201);
    expect(mockedCatalogue.assertSlotAvailable).toHaveBeenCalledWith(
      'org-1',
      'cal-1',
      '2026-08-08',
      '09:00',
      60,
      1,
      expect.any(Date),
      // The member asking, so a second attempt at the same slot is refused as
      // already-in-your-basket rather than silently added twice.
      'ou-1'
    );
  });

  /**
   * A slot is exclusive by its nature, so every booking takes a hold — the
   * server decides the window rather than trusting one from the request.
   */
  it('refuses the same slot twice, even after its hold has lapsed', async () => {
    /*
     * `assertSlotAvailable` catches a duplicate only while the hold is live: an
     * expired hold is invisible to the availability query, so the slot reads as
     * free and a second identical line goes in. The basket then holds one
     * exclusive slot twice and checkout prices both — which is how a member
     * ended up looking at a pending payment listing the same booking twice.
     */
    mockedDb.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 } as any);

    const response = await request(server).post('/api/account/khpc/cart/items').send(bookingLine);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/already in your basket/i);
    expect(mockedCart.addItem).not.toHaveBeenCalled();
    // Refused before availability is even consulted.
    expect(mockedCatalogue.assertSlotAvailable).not.toHaveBeenCalled();
  });

  it('holds the slot it just added', async () => {
    await request(server).post('/api/account/khpc/cart/items').send(bookingLine);

    expect(mockedCart.addItem).toHaveBeenCalledWith(
      'org-1',
      'ou-1',
      'EUR',
      expect.objectContaining({ expiresAt: expect.any(Date) })
    );
  });

  it('ignores an expiry the client asked for', async () => {
    // Otherwise a crafted request could hold a contended court for an hour.
    const far = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await request(server)
      .post('/api/account/khpc/cart/items')
      .send({ ...bookingLine, expiresAt: far });

    const passed = mockedCart.addItem.mock.calls.at(-1)?.[3] as { expiresAt: Date };
    expect(passed.expiresAt.getTime()).toBeLessThan(Date.parse(far));
  });

  it('refuses a slot somebody else has taken, with the reason', async () => {
    mockedCatalogue.assertSlotAvailable.mockRejectedValue(
      new ValidationError('That slot is fully booked')
    );

    const response = await request(server).post('/api/account/khpc/cart/items').send(bookingLine);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('That slot is fully booked');
    expect(mockedCart.addItem).not.toHaveBeenCalled();
  });
});
describe('registrations', () => {
  beforeEach(() => {
    mockedOrg.resolveMembership.mockResolvedValue(membership(['registrations']) as any);
  });

  it('serves what a member can register', async () => {
    const response = await request(server).get('/api/account/khpc/catalogue/registration-types');

    expect(response.status).toBe(200);
    expect(mockedCatalogue.listRegistrationTypes).toHaveBeenCalledWith('org-1');
  });

  it('serves this member’s own registrations', async () => {
    const response = await request(server).get('/api/account/khpc/registrations');

    expect(response.status).toBe(200);
    expect(mockedActivity.listRegistrations).toHaveBeenCalledWith('org-1', 'ou-1');
  });

  it.each([
    ['/api/account/khpc/catalogue/registration-types'],
    ['/api/account/khpc/registrations'],
  ])('refuses %s for a club without the capability', async (path) => {
    mockedOrg.resolveMembership.mockResolvedValue(membership(['merchandise']) as any);

    expect((await request(server).get(path)).status).toBe(403);
  });

  it('checks the scheme and the name before adding to the basket', async () => {
    const response = await request(server)
      .post('/api/account/khpc/cart/items')
      .send({
        itemType: 'registration',
        contextRef: { registrationTypeId: 'rt-1', entityName: 'Rocket' },
        unitFee: 4500,
        supportedPaymentMethodIds: ['pm-card'],
      });

    expect(response.status).toBe(201);
    expect(mockedCatalogue.assertRegistrationTypeAvailable).toHaveBeenCalledWith(
      'org-1',
      'rt-1',
      'Rocket'
    );
  });

  it('refuses a registration with nothing named on it', async () => {
    mockedCatalogue.assertRegistrationTypeAvailable.mockRejectedValue(
      new ValidationError('Give the name of the horse')
    );

    const response = await request(server)
      .post('/api/account/khpc/cart/items')
      .send({
        itemType: 'registration',
        contextRef: { registrationTypeId: 'rt-1' },
        unitFee: 4500,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Give the name of the horse');
    expect(mockedCart.addItem).not.toHaveBeenCalled();
  });
});
/**
 * Receipts are deliberately **not** capability-gated: a payment can cover items
 * from any area, and a member has a right to their own receipts whatever the
 * club has since switched off.
 */
describe('GET /api/account/:orgCode/payments', () => {
  it('serves this member’s payments', async () => {
    const response = await request(server).get('/api/account/khpc/payments');

    expect(response.status).toBe(200);
    expect(mockedActivity.listPayments).toHaveBeenCalledWith('org-1', 'ou-1');
  });

  it('serves them to a club with no capabilities left enabled', async () => {
    mockedOrg.resolveMembership.mockResolvedValue(membership([]) as any);

    expect((await request(server).get('/api/account/khpc/payments')).status).toBe(200);
  });
});
describe('POST /api/account/:orgCode/bookings/:bookingId/cancel', () => {
  beforeEach(() => {
    mockedOrg.resolveMembership.mockResolvedValue(membership(['calendar-bookings']) as any);
  });

  it('cancels, from the session rather than the request', async () => {
    const response = await request(server).post('/api/account/khpc/bookings/booking-1/cancel');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ refundExpected: false });
    expect(mockedActivity.cancelBooking).toHaveBeenCalledWith('org-1', 'ou-1', 'booking-1');
  });

  it('passes the club’s refusal through with its reason', async () => {
    mockedActivity.cancelBooking.mockRejectedValue(
      new ValidationError('Cancellations need at least 2 days’ notice')
    );

    const response = await request(server).post('/api/account/khpc/bookings/booking-1/cancel');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/2 days/);
  });

  it('reports somebody else’s booking as not found', async () => {
    mockedActivity.cancelBooking.mockRejectedValue(new NotFoundError('Booking not found'));

    expect((await request(server).post('/api/account/khpc/bookings/booking-1/cancel')).status).toBe(
      404
    );
  });

  it('is refused for a club without calendar bookings', async () => {
    mockedOrg.resolveMembership.mockResolvedValue(membership(['merchandise']) as any);

    expect((await request(server).post('/api/account/khpc/bookings/booking-1/cancel')).status).toBe(
      403
    );
  });
});
/**
 * B3 — one request for the whole home screen, and the capabilities passed
 * through so the service can leave out what the club has not enabled.
 */
describe('GET /api/account/:orgCode/dashboard', () => {
  it('builds it from the session', async () => {
    mockedOrg.resolveMembership.mockResolvedValue(membership(['memberships']) as any);

    const response = await request(server).get('/api/account/khpc/dashboard');

    expect(response.status).toBe(200);
    expect(mockedDashboard.build).toHaveBeenCalledWith('org-1', 'ou-1', ['memberships'], 'EUR');
  });

  /** Not gated: a club may have any mix of areas, or none. */
  it('serves a club with nothing enabled', async () => {
    mockedOrg.resolveMembership.mockResolvedValue(membership([]) as any);

    expect((await request(server).get('/api/account/khpc/dashboard')).status).toBe(200);
  });
});
