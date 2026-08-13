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
    mockedCatalogue.assertActivityAvailable.mockResolvedValue({ available: false } as any);

    const response = await request(server)
      .post('/api/account/khpc/cart/items')
      .send({ itemType: 'event-entry', contextRef: { activityId: 'act-1' }, unitFee: 2500 });

    expect(response.status).toBe(400);
    expect(mockedCart.addItem).not.toHaveBeenCalled();
  });

  it('adds an entry the catalogue still offers', async () => {
    mockedCatalogue.assertActivityAvailable.mockResolvedValue({ available: true } as any);

    const response = await request(server)
      .post('/api/account/khpc/cart/items')
      .send({ itemType: 'event-entry', contextRef: { activityId: 'act-1' }, unitFee: 2500 });

    expect(response.status).toBe(201);
    expect(mockedCart.addItem).toHaveBeenCalled();
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
    expect(mockedCatalogue.assertActivityAvailable).not.toHaveBeenCalled();
    expect(mockedCatalogue.assertSlotAvailable).not.toHaveBeenCalled();
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
      '2026-08-14'
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
      1
    );
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
