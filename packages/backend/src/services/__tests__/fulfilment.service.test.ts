import { FulfilmentService } from '../fulfilment.service';
import { db } from '../../database/pool';
import { membershipService } from '../membership.service';
import { ticketingService } from '../ticketing.service';
import { merchandiseService } from '../merchandise.service';
import { calendarService } from '../calendar.service';
import { registrationService } from '../registration.service';
import { accountCatalogueService } from '../account-catalogue.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../membership.service', () => ({
  membershipService: { createMember: jest.fn() },
}));
jest.mock('../ticketing.service', () => ({
  ticketingService: { issueTicketForEntry: jest.fn() },
}));
jest.mock('../merchandise.service', () => ({
  merchandiseService: { createOrder: jest.fn() },
}));
jest.mock('../calendar.service', () => ({
  calendarService: { createBooking: jest.fn() },
}));
jest.mock('../registration.service', () => ({
  registrationService: { createRegistration: jest.fn(), getRegistrationTypeById: jest.fn() },
}));
jest.mock('../account-catalogue.service', () => ({
  accountCatalogueService: { assertSlotAvailable: jest.fn() },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockMembership = membershipService as jest.Mocked<typeof membershipService>;
const mockTicketing = ticketingService as jest.Mocked<typeof ticketingService>;
const mockMerchandise = merchandiseService as jest.Mocked<typeof merchandiseService>;
const mockCalendar = calendarService as jest.Mocked<typeof calendarService>;
const mockRegistration = registrationService as jest.Mocked<typeof registrationService>;
const mockCatalogue = accountCatalogueService as jest.Mocked<typeof accountCatalogueService>;

const ORG = 'org-1';
const MEMBER = 'ou-1';
const ACTIVITY = '11111111-1111-4111-8111-111111111111';

const line = (over: Record<string, any> = {}) => ({
  id: 'line-1',
  item_type: 'event-entry',
  context_id: ACTIVITY,
  form_submission_id: null,
  description: 'Summer Regatta — Junior Sculls',
  organisation_id: ORG,
  user_id: MEMBER,
  payment_status: 'paid',
  ...over,
});

/**
 * Answers the query sequence: the outstanding lines, then whatever each line's
 * fulfilment looks up.
 */
const respond = (lines: any[], overrides: Record<string, any> = {}) => {
  mockDb.query.mockImplementation((sql: string) => {
    const text = String(sql);
    if (text.includes('FROM payment_transactions pt')) {
      return Promise.resolve({ rows: lines, rowCount: lines.length } as any);
    }
    if (text.includes('FROM event_activities')) {
      return Promise.resolve(
        overrides.activity ?? ({ rows: [{ id: ACTIVITY, event_id: 'event-1' }], rowCount: 1 } as any)
      );
    }
    if (text.includes('FROM organization_users')) {
      return Promise.resolve(
        overrides.member ??
          ({
            rows: [{ first_name: 'Sam', last_name: 'Rivers', email: 'sam@example.com' }],
            rowCount: 1,
          } as any)
      );
    }
    if (text.includes('FROM members WHERE id')) {
      return Promise.resolve(
        overrides.memberRecord ??
          ({ rows: [{ first_name: 'Saoirse', last_name: 'Byrne' }], rowCount: 1 } as any)
      );
    }
    if (text.includes('INSERT INTO event_entries')) {
      return Promise.resolve({ rows: [{ id: 'entry-1' }], rowCount: 1 } as any);
    }
    return Promise.resolve({ rows: [], rowCount: 0 } as any);
  });
};

describe('FulfilmentService', () => {
  let service: FulfilmentService;

  beforeEach(() => {
    mockDb.query.mockReset();
    mockMembership.createMember.mockReset();
    mockMerchandise.createOrder.mockReset();
    mockCalendar.createBooking.mockReset();
    mockRegistration.createRegistration.mockReset();
    mockRegistration.getRegistrationTypeById.mockReset();
    mockCatalogue.assertSlotAvailable.mockReset();
    service = new FulfilmentService();
  });

  it('creates the entry a paid line bought', async () => {
    respond([line()]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toEqual({ fulfilled: 1, failed: 0, complete: true });
    const statements = mockDb.query.mock.calls.map((call) => String(call[0]));
    expect(statements.some((sql) => sql.includes('INSERT INTO event_entries'))).toBe(true);
  });

  it('derives the event from the activity rather than storing it twice', async () => {
    respond([line()]);
    await service.fulfilPayment('pay-1');

    const insert = mockDb.query.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO event_entries')
    );
    expect(insert?.[1]).toContain('event-1');
  });

  /**
   * The idempotency guard. A webhook redelivery must not issue a second entry
   * for the same payment.
   */
  it('only looks at lines that are not already fulfilled', async () => {
    respond([line()]);
    await service.fulfilPayment('pay-1');

    const select = mockDb.query.mock.calls[0];
    expect(String(select[0])).toContain('fulfilled_at IS NULL');
  });

  it('does nothing when everything is already fulfilled', async () => {
    respond([]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toEqual({ fulfilled: 0, failed: 0, complete: true });
    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });

  it('marks a fulfilled line with what it produced', async () => {
    respond([line()]);
    await service.fulfilPayment('pay-1');

    const update = mockDb.query.mock.calls.find((call) =>
      String(call[0]).includes('fulfilled_at = NOW()')
    );
    // The reference is what lets a refund later find the row to undo.
    expect(update?.[1]).toEqual(['line-1', 'entry-1']);
  });

  /** Creating entries for an unpaid payment would give places away free. */
  it('refuses to fulfil a payment that is not paid', async () => {
    respond([line({ payment_status: 'pending' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome.fulfilled).toBe(0);
    expect(outcome.complete).toBe(false);
    const statements = mockDb.query.mock.calls.map((call) => String(call[0]));
    expect(statements.some((sql) => sql.includes('INSERT INTO event_entries'))).toBe(false);
  });

  /**
   * One bad line must not block the rest of the order — a membership with no
   * application form cannot be created, but the entry beside it can.
   */
  it('fulfils what it can and records why the rest failed', async () => {
    respond([line(), line({ id: 'line-2', item_type: 'membership', context_id: 'mt-1' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toEqual({ fulfilled: 1, failed: 1, complete: false });
    const failure = mockDb.query.mock.calls.find((call) =>
      String(call[0]).includes('fulfilment_error = $2')
    );
    expect(String(failure?.[1]?.[1])).toMatch(/application form/i);
  });

  /**
   * Left outstanding on purpose: a later retry, or an administrator re-running
   * once the cause is fixed, picks it up again.
   */
  it('leaves a failed line unfulfilled so it can be retried', async () => {
    respond([line({ item_type: 'membership', context_id: 'mt-1' })]);
    await service.fulfilPayment('pay-1');

    const failure = mockDb.query.mock.calls.find((call) =>
      String(call[0]).includes('fulfilment_error')
    );
    expect(String(failure?.[0])).not.toContain('fulfilled_at = NOW()');
  });

  /**
   * Every item type the basket allows is now fulfillable, so this is about a
   * line whose type is not one of them — a corrupted row, or one written by a
   * future version. Failing loudly is the point: the line stays visible with a
   * reason rather than appearing fulfilled, so a paid order that produced
   * nothing is discoverable.
   */
  it('records a readable reason for an item type it cannot fulfil', async () => {
    respond([line({ item_type: 'something-else' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome.failed).toBe(1);
    const failure = mockDb.query.mock.calls.find((call) =>
      String(call[0]).includes('fulfilment_error = $2')
    );
    expect(String(failure?.[1]?.[1])).toMatch(/not implemented for "something-else"/);
  });

  it('fails a line whose activity has been deleted', async () => {
    respond([line()], { activity: { rows: [], rowCount: 0 } });

    const outcome = await service.fulfilPayment('pay-1');
    expect(outcome.failed).toBe(1);
  });

  it('scopes the activity lookup to the organisation that was paid', async () => {
    respond([line()]);
    await service.fulfilPayment('pay-1');

    const lookup = mockDb.query.mock.calls.find((call) =>
      String(call[0]).includes('FROM event_activities')
    );
    expect(String(lookup?.[0])).toContain('e.organisation_id = $2');
  });

  /**
   * An offline order is fulfilled when it is placed, not when the cheque
   * arrives. A card order is confirmed seconds later so it can wait for the
   * webhook; an offline one may wait weeks, and the member should not be
   * without their entry or their ticket for that whole time.
   */
  describe('orders placed offline', () => {
    const offline = (over: Record<string, any> = {}) =>
      line({ payment_status: 'awaiting_offline', ...over });

    it('creates the entry for an offline order that has not been paid yet', async () => {
      respond([offline()]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome.fulfilled).toBe(1);
      const insert = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO event_entries')
      );
      expect(insert).toBeDefined();
    });

    /**
     * The ticket's state is derived from this column, so marking it `paid`
     * would make the ticket read "valid" at a gate for an entry nobody has
     * paid for.
     */
    it('records the entry as pending and offline, not paid', async () => {
      respond([offline()]);

      await service.fulfilPayment('pay-1');

      const insert = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO event_entries')
      );
      expect(insert?.[1]).toEqual(expect.arrayContaining(['pending', 'offline']));
    });

    it('still records a card order as paid', async () => {
      respond([line()]);

      await service.fulfilPayment('pay-1');

      const insert = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO event_entries')
      );
      expect(insert?.[1]).toEqual(expect.arrayContaining(['paid', 'card']));
    });

    it('issues the ticket for an offline order at checkout time', async () => {
      mockTicketing.issueTicketForEntry.mockReset();
      respond([offline()]);

      await service.fulfilPayment('pay-1');

      expect(mockTicketing.issueTicketForEntry).toHaveBeenCalledWith('entry-1');
    });

    /**
     * A membership runs for a year and has no gate to check on the day, so
     * granting one before payment gives it away. Deferred, not failed — the
     * line is picked up when the club records the money.
     */
    it('defers a membership until the money arrives, without failing it', async () => {
      respond([offline({ item_type: 'membership', context_id: 'mt-1', form_submission_id: 'fs-1' })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 0, failed: 0, complete: false });
      expect(mockMembership.createMember).not.toHaveBeenCalled();
      const failure = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('fulfilment_error')
      );
      expect(failure).toBeUndefined();
    });

    it('fulfils the entry and defers the membership on a mixed offline order', async () => {
      respond([
        offline(),
        offline({ id: 'line-2', item_type: 'membership', context_id: 'mt-1' }),
      ]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 1, failed: 0, complete: false });
    });

    /** Pending card, failed and refunded payments are still refused. */
    it('refuses a payment that is neither paid nor placed offline', async () => {
      respond([line({ payment_status: 'failed' })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome.fulfilled).toBe(0);
      const statements = mockDb.query.mock.calls.map((call) => String(call[0]));
      expect(statements.some((sql) => sql.includes('INSERT INTO event_entries'))).toBe(false);
    });
  });

  describe('ticket issuance', () => {
    // The suite does not reset mocks between tests, and these assertions are
    // about call counts rather than about the database.
    beforeEach(() => {
      mockTicketing.issueTicketForEntry.mockReset();
    });

    it('issues the ticket for the entry it just created', async () => {
      respond([line()]);

      await service.fulfilPayment('pay-1');

      expect(mockTicketing.issueTicketForEntry).toHaveBeenCalledWith('entry-1');
    });

    /**
     * The member has paid and the entry exists — both already committed.
     * Letting a ticketing problem throw would mark the line failed and leave
     * them looking at a failed order for a payment that went through, which is
     * far worse than an entry whose ticket has to be issued by hand.
     */
    it('still fulfils the line when the ticket cannot be issued', async () => {
      mockTicketing.issueTicketForEntry.mockRejectedValueOnce(new Error('ticketing is down'));
      respond([line()]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 1, failed: 0, complete: true });
      const update = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('fulfilled_at = NOW()')
      );
      expect(update?.[1]).toEqual(['line-1', 'entry-1']);
    });

    it('does not try to issue a ticket for a membership', async () => {
      mockMembership.createMember.mockResolvedValue({ id: 'member-1' } as any);
      respond([
        line({ item_type: 'membership', context_id: 'mt-1', form_submission_id: 'fs-1' }),
      ]);

      await service.fulfilPayment('pay-1');

      expect(mockTicketing.issueTicketForEntry).not.toHaveBeenCalled();
    });
  });

  describe('memberships', () => {
    it('delegates to the membership service, which owns numbering and expiry', async () => {
      mockMembership.createMember.mockResolvedValue({ id: 'member-1' } as any);
      respond([
        line({ item_type: 'membership', context_id: 'mt-1', form_submission_id: 'fs-1' }),
      ]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome.fulfilled).toBe(1);
      // Reimplementing number generation here would draw from a second
      // sequence and quietly break uniqueness.
      expect(mockMembership.createMember).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: ORG,
          membershipTypeId: 'mt-1',
          formSubmissionId: 'fs-1',
        })
      );
    });

    /**
     * Whose membership it is.
     *
     * The application asks — "Who is this membership for?" — and the answer
     * travels on the basket line. Without it every membership took the
     * **account holder's** name, so a parent joining three children produced
     * three records all reading "Sam Rivers" and the club could not tell which
     * card belonged to whom.
     */
    it('creates it in the name the application gave', async () => {
      mockMembership.createMember.mockResolvedValue({ id: 'member-1' } as any);
      respond([
        line({
          item_type: 'membership',
          context_id: 'mt-1',
          form_submission_id: 'fs-1',
          context_ref: { membershipTypeId: 'mt-1', memberName: 'Rónán McGrath' },
        }),
      ]);

      await service.fulfilPayment('pay-1');

      expect(mockMembership.createMember).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Rónán', lastName: 'McGrath' })
      );
    });

    it('reads the name through a context recorded as a string', async () => {
      // `context_ref` comes back as a string under some drivers and an object
      // under others; `?.memberName` on a string is silently undefined.
      mockMembership.createMember.mockResolvedValue({ id: 'member-1' } as any);
      respond([
        line({
          item_type: 'membership',
          context_id: 'mt-1',
          form_submission_id: 'fs-1',
          context_ref: JSON.stringify({ memberName: 'Éabha McGrath' }),
        }),
      ]);

      await service.fulfilPayment('pay-1');

      expect(mockMembership.createMember).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Éabha', lastName: 'McGrath' })
      );
    });

    it('falls back to the account holder where the application named nobody', async () => {
      // An older basket line, from before the application asked.
      mockMembership.createMember.mockResolvedValue({ id: 'member-1' } as any);
      respond([
        line({ item_type: 'membership', context_id: 'mt-1', form_submission_id: 'fs-1' }),
      ]);

      await service.fulfilPayment('pay-1');

      expect(mockMembership.createMember).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Sam', lastName: 'Rivers' })
      );
    });

    it('records a membership-service failure against the line', async () => {
      mockMembership.createMember.mockRejectedValue(new Error('Membership type not found'));
      respond([
        line({ item_type: 'membership', context_id: 'mt-1', form_submission_id: 'fs-1' }),
      ]);

      const outcome = await service.fulfilPayment('pay-1');
      expect(outcome.failed).toBe(1);
    });
  });
  /**
   * Merchandise is the first line type that is more than an id: a size, a
   * colour and a count. All three ride on the payment line's `context_ref`,
   * because the basket row is gone by the time a webhook is redelivered.
   */
  describe('merchandise', () => {
    const merchandiseLine = (over: Record<string, any> = {}) =>
      line({
        item_type: 'merchandise',
        context_id: 'item-1',
        context_ref: { merchandiseTypeId: 'item-1', selectedOptions: { 'opt-size': 'val-l' } },
        quantity: 3,
        description: 'Club polo — Large',
        ...over,
      });

    it('creates the order through the merchandise service, not by inserting here', async () => {
      mockMerchandise.createOrder.mockResolvedValue({ id: 'order-1' } as any);
      respond([merchandiseLine()]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 1, failed: 0, complete: true });
      // That service owns the quantity rules, the pricing and the stock
      // decrement; a second implementation would be a second answer.
      expect(mockMerchandise.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: ORG,
          merchandiseTypeId: 'item-1',
          userId: MEMBER,
          selectedOptions: { 'opt-size': 'val-l' },
          quantity: 3,
        })
      );
    });

    it('passes the answers through when the item had a form', async () => {
      mockMerchandise.createOrder.mockResolvedValue({ id: 'order-1' } as any);
      respond([merchandiseLine({ form_submission_id: 'fs-9' })]);

      await service.fulfilPayment('pay-1');

      expect(mockMerchandise.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ formSubmissionId: 'fs-9' })
      );
    });

    /** Lines written before `quantity` existed mean one. */
    it('treats a missing quantity as one', async () => {
      mockMerchandise.createOrder.mockResolvedValue({ id: 'order-1' } as any);
      respond([merchandiseLine({ quantity: null })]);

      await service.fulfilPayment('pay-1');

      expect(mockMerchandise.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 1 })
      );
    });

    it('reads a context_ref that arrived as a string', async () => {
      mockMerchandise.createOrder.mockResolvedValue({ id: 'order-1' } as any);
      respond([
        merchandiseLine({
          context_ref: JSON.stringify({ selectedOptions: { 'opt-size': 'val-s' } }),
        }),
      ]);

      await service.fulfilPayment('pay-1');

      expect(mockMerchandise.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ selectedOptions: { 'opt-size': 'val-s' } })
      );
    });

    it('fails the line, with a reason, when the options were never recorded', async () => {
      respond([merchandiseLine({ context_ref: null })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome.failed).toBe(1);
      expect(mockMerchandise.createOrder).not.toHaveBeenCalled();
      const failure = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('fulfilment_error')
      );
      expect(String(failure?.[1]?.[1])).toMatch(/no options recorded/i);
    });

    /** Stock going in the meantime is a real outcome, not a crash. */
    it('records an out-of-stock refusal against the line', async () => {
      mockMerchandise.createOrder.mockRejectedValue(
        new Error('Insufficient stock for selected options')
      );
      respond([merchandiseLine()]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 0, failed: 1, complete: false });
    });

    /**
     * This case used to assert the opposite, and the reasoning behind it was
     * confused: "an offline order is not goods-in-hand" is about *dispatching*,
     * not about whether the order exists.
     *
     * `merchandise_orders` defaults both `order_status` and `payment_status` to
     * `pending`, so the order can be recorded while nothing is sent. Deferring
     * it left the member with nothing under "My shop orders" and the club with
     * no record that money was owed.
     */
    it('records the order on an offline purchase, unpaid and undispatched', async () => {
      mockMerchandise.createOrder.mockResolvedValue({ id: 'order-1' } as any);
      respond([merchandiseLine({ payment_status: 'awaiting_offline' })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 1, failed: 0, complete: true });
      expect(mockMerchandise.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: 'offline' })
      );
    });
  });
  /**
   * A slot is the one thing two members reliably want at once, so the check
   * runs again here — after the money, before the booking. Losing the race
   * leaves a member to refund; not checking leaves the club with two bookings
   * on one court.
   */
  describe('bookings', () => {
    const bookingLine = (over: Record<string, any> = {}) =>
      line({
        item_type: 'booking',
        context_id: null,
        context_ref: {
          calendarId: 'cal-1',
          date: '2026-08-08',
          startTime: '09:00',
          duration: 60,
          places: 1,
        },
        fee: 1200,
        description: 'Tennis court 1 — 8 August 09:00',
        ...over,
      });

    beforeEach(() => {
      mockCatalogue.assertSlotAvailable.mockResolvedValue({} as any);
      mockCalendar.createBooking.mockResolvedValue({ id: 'booking-1' } as any);
    });

    it('books the slot the line paid for', async () => {
      respond([bookingLine()]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 1, failed: 0, complete: true });
      expect(mockCalendar.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'cal-1',
          userId: MEMBER,
          startTime: '09:00',
          duration: 60,
          placesBooked: 1,
        })
      );
    });

    /** `new Date('2026-08-08')` is UTC; west of Greenwich that is the 7th. */
    it('books the date the member chose, not the day before it', async () => {
      respond([bookingLine()]);
      await service.fulfilPayment('pay-1');

      const { bookingDate } = mockCalendar.createBooking.mock.calls[0][0];
      expect(bookingDate.getFullYear()).toBe(2026);
      expect(bookingDate.getMonth()).toBe(7);
      expect(bookingDate.getDate()).toBe(8);
    });

    it('checks the slot is still free before booking it', async () => {
      respond([bookingLine()]);
      await service.fulfilPayment('pay-1');

      expect(mockCatalogue.assertSlotAvailable).toHaveBeenCalledWith(
        ORG,
        'cal-1',
        '2026-08-08',
        '09:00',
        60,
        1,
        expect.any(Date),
        // The buyer, and their own hold left out of the sum: this line *is*
        // that hold being redeemed, so counting it would have the member's own
        // reservation block the booking it exists to guarantee.
        'ou-1',
        true
      );
    });

    it('fails the line, with the reason, when the slot has gone', async () => {
      mockCatalogue.assertSlotAvailable.mockRejectedValue(new Error('That slot is fully booked'));
      respond([bookingLine()]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 0, failed: 1, complete: false });
      expect(mockCalendar.createBooking).not.toHaveBeenCalled();
      const failure = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('fulfilment_error')
      );
      expect(String(failure?.[1]?.[1])).toMatch(/fully booked/i);
    });

    /** The member agreed to a figure at checkout; the calendar may have moved. */
    it('prices the booking from the line, not from the calendar', async () => {
      respond([bookingLine({ fee: 2400, context_ref: {
        calendarId: 'cal-1', date: '2026-08-08', startTime: '09:00', duration: 60, places: 2,
      } })]);

      await service.fulfilPayment('pay-1');

      expect(mockCalendar.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({ placesBooked: 2, pricePerPlace: 12 })
      );
    });

    it('fails a line with no slot recorded against it', async () => {
      respond([bookingLine({ context_ref: null })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome.failed).toBe(1);
      expect(mockCatalogue.assertSlotAvailable).not.toHaveBeenCalled();
    });

    /**
     * This case used to assert the opposite, and the assertion was wrong.
     *
     * Waiting for the money on a booking leaves the slot on sale: the basket
     * hold lapses two minutes after checkout, so the member who has committed
     * to pay for it watches it go to somebody else — and sees nothing under
     * "My entries & bookings" in the meantime. The booking is made now, and
     * records that it is not yet paid for.
     */
    it('books the slot on an offline order rather than waiting for the money', async () => {
      respond([bookingLine({ payment_status: 'awaiting_offline' })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 1, failed: 0, complete: true });
      expect(mockCalendar.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: 'offline' })
      );
    });
  });
  /**
   * A registration is *of a thing* — a horse, a boat — and the club may want to
   * look at it before it counts. Both of those live here.
   */
  describe('registrations', () => {
    const registrationLine = (over: Record<string, any> = {}) =>
      line({
        item_type: 'registration',
        context_id: 'rt-1',
        context_ref: { registrationTypeId: 'rt-1', entityName: 'Rocket' },
        form_submission_id: 'fs-1',
        description: 'Horse registration 2026 — Rocket',
        ...over,
      });

    beforeEach(() => {
      mockRegistration.getRegistrationTypeById.mockResolvedValue({
        id: 'rt-1',
        automaticallyApprove: true,
      } as any);
      mockRegistration.createRegistration.mockResolvedValue({ id: 'reg-1' } as any);
    });

    it('registers the thing the line named', async () => {
      respond([registrationLine()]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 1, failed: 0, complete: true });
      expect(mockRegistration.createRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: ORG,
          registrationTypeId: 'rt-1',
          userId: MEMBER,
          entityName: 'Rocket',
          formSubmissionId: 'fs-1',
        })
      );
    });

    it('records the member as the owner, as a snapshot', async () => {
      respond([registrationLine()]);
      await service.fulfilPayment('pay-1');

      expect(mockRegistration.createRegistration).toHaveBeenCalledWith(
        expect.objectContaining({ ownerName: 'Sam Rivers' })
      );
    });

    /**
     * The club asked to see these before they count. Creating one active would
     * hand out a registration it meant to review, and nothing downstream would
     * catch it.
     */
    it('leaves it pending when the club reviews registrations', async () => {
      mockRegistration.getRegistrationTypeById.mockResolvedValue({
        id: 'rt-1',
        automaticallyApprove: false,
      } as any);
      respond([registrationLine()]);

      await service.fulfilPayment('pay-1');

      expect(mockRegistration.createRegistration).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      );
    });

    it('makes it active when the club approves automatically', async () => {
      respond([registrationLine()]);
      await service.fulfilPayment('pay-1');

      expect(mockRegistration.createRegistration).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
    });

    it('trims the name it was given', async () => {
      respond([
        registrationLine({ context_ref: { registrationTypeId: 'rt-1', entityName: '  Rocket  ' } }),
      ]);
      await service.fulfilPayment('pay-1');

      expect(mockRegistration.createRegistration).toHaveBeenCalledWith(
        expect.objectContaining({ entityName: 'Rocket' })
      );
    });

    it('fails a line with nothing named on it', async () => {
      respond([registrationLine({ context_ref: { registrationTypeId: 'rt-1', entityName: '   ' } })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome.failed).toBe(1);
      expect(mockRegistration.createRegistration).not.toHaveBeenCalled();
      const failure = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('fulfilment_error')
      );
      expect(String(failure?.[1]?.[1])).toMatch(/no name recorded/i);
    });

    it('fails a line whose form was never completed', async () => {
      respond([registrationLine({ form_submission_id: null })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome.failed).toBe(1);
      expect(mockRegistration.createRegistration).not.toHaveBeenCalled();
    });

    it('fails a line whose type has since been removed', async () => {
      mockRegistration.getRegistrationTypeById.mockResolvedValue(null as any);
      respond([registrationLine()]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome.failed).toBe(1);
    });

    it('waits for the money on an offline registration', async () => {
      respond([registrationLine({ payment_status: 'awaiting_offline' })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 0, failed: 0, complete: false });
      expect(mockRegistration.createRegistration).not.toHaveBeenCalled();
    });
  });

  /**
   * Whose entry it is, when a login holds several memberships.
   *
   * A parent entering two children would otherwise produce two rows both
   * reading "Aoife Byrne", and the club could not tell which child is in which
   * class — which would make the whole member selector pointless.
   *
   * See docs/MEMBERS_ONLY_ENTRIES.md.
   */
  describe('entries made for a member', () => {
    const memberLine = (memberId: string | null) =>
      line({ context_ref: memberId ? { activityId: ACTIVITY, memberId } : { activityId: ACTIVITY } });

    const insertArgs = () =>
      mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO event_entries')
      )?.[1] as any[];

    it("puts the member's name on the entry, not the account holder's", async () => {
      respond([memberLine('mem-1')]);

      await service.fulfilPayment('pay-1');

      expect(insertArgs()).toContain('Saoirse');
      expect(insertArgs()).toContain('Byrne');
      expect(insertArgs()).not.toContain('Sam');
    });

    it('records which membership it was made against', async () => {
      // What lets the org admin's entry list show a membership number.
      respond([memberLine('mem-1')]);

      await service.fulfilPayment('pay-1');

      expect(insertArgs()).toContain('mem-1');
    });

    it("keeps the account holder's email, which is where the club writes", async () => {
      // A child's membership record may carry no address at all.
      respond([memberLine('mem-1')]);

      await service.fulfilPayment('pay-1');

      expect(insertArgs()).toContain('sam@example.com');
    });

    it('leaves an open entry exactly as it was', async () => {
      respond([memberLine(null)]);

      await service.fulfilPayment('pay-1');

      expect(insertArgs()).toContain('Sam');
      expect(insertArgs()).toContain(null);
    });

    it('falls back to the account holder if the membership has since gone', async () => {
      /*
       * Not a failure. The money is taken and the entry must exist; a member
       * record deleted between checkout and fulfilment is a reason to name the
       * payer, not to fail a paid line.
       */
      respond([memberLine('mem-1')], { memberRecord: { rows: [], rowCount: 0 } });

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome.fulfilled).toBe(1);
      expect(insertArgs()).toContain('Sam');
    });
  });

});

/**
 * The spelling of an item type.
 *
 * `cart_items.item_type` is `event_entry`, and `payment_transactions` copies it
 * verbatim — but this service switched on `event-entry` and was never updated
 * when the basket moved to the underscore to satisfy its check constraint. Every
 * paid entry therefore failed with "fulfilment is not implemented for
 * event_entry".
 *
 * It survived because these tests used the hyphen too, and because no payment
 * had ever reached fulfilment at all: confirming one rolled back on a separate
 * constraint fault. Two dormant bugs hid each other, and the fixture agreed
 * with the code rather than with the database.
 *
 * So these cases assert the spelling **production actually writes**.
 */
describe('FulfilmentService — item type spelling', () => {
  let service: FulfilmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FulfilmentService();
  });

  it('fulfils an entry stored the way the basket writes it', async () => {
    respond([line({ item_type: 'event_entry' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 1, failed: 0 });
  });

  it('still fulfils one stored the old way', async () => {
    // Rows written under the previous convention must not start failing.
    respond([line({ item_type: 'event-entry' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 1, failed: 0 });
  });

  it('creates an unpaid offline entry under the underscore spelling too', async () => {
    /*
     * Entries are the one type created before the money arrives. The deferral
     * test also compared against the hyphen, so an offline entry was being
     * deferred for ever instead of created.
     */
    respond([line({ item_type: 'event_entry', payment_status: 'awaiting_offline' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 1, failed: 0 });
  });

  it('still refuses a type it has no idea how to fulfil', async () => {
    respond([line({ item_type: 'sponsorship' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 0, failed: 1 });
  });
});


/**
 * An order paid directly to the club.
 *
 * Reported as: two slots booked with Pay Offline, checkout accepted, and then
 * nothing under "My entries & bookings" — the bookings were never created. They
 * were being deferred with memberships and merchandise until the money arrived.
 *
 * That grouping is wrong for a slot specifically. A booking that does not exist
 * is a slot **still on sale**: the basket hold lapses two minutes after
 * checkout, and the member who has just committed to pay watches it go to
 * somebody else.
 */
describe('FulfilmentService — an order placed offline', () => {
  let service: FulfilmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalogue.assertSlotAvailable.mockResolvedValue({} as any);
    mockCalendar.createBooking.mockResolvedValue({ id: 'booking-1' } as any);
    mockMerchandise.createOrder.mockResolvedValue({ id: 'order-1' } as any);
    service = new FulfilmentService();
  });

  /** The options a shop line carries; without them the order cannot be made. */
  const merchandiseContext = () => ({
    merchandiseTypeId: 'merch-1',
    selectedOptions: { 'opt-size': 'val-l' },
  });

  /** The slot a booking line carries; `bookingLine` above is scoped elsewhere. */
  const bookingContext = () => ({
    calendarId: 'cal-1',
    date: '2026-08-08',
    startTime: '09:00',
    duration: 60,
    places: 1,
  });

  const offline = (over: Record<string, any> = {}) =>
    line({ payment_status: 'awaiting_offline', ...over });

  it('creates a booking rather than waiting for the money', async () => {
    respond([offline({ item_type: 'booking', context_ref: bookingContext() })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 1, failed: 0 });
  });

  it('records the booking as not yet paid for', async () => {
    /*
     * `calendar.service` reads a payment method as "not paid yet". Without one
     * the booking would claim to have been paid for, which is the opposite of
     * what an offline order means.
     */
    respond([offline({ item_type: 'booking', context_ref: bookingContext() })]);

    await service.fulfilPayment('pay-1');

    expect(mockCalendar.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: 'offline' })
    );
  });

  it('leaves a paid booking claiming nothing about a payment method', async () => {
    respond([line({ item_type: 'booking', context_ref: bookingContext() })]);

    await service.fulfilPayment('pay-1');

    expect(mockCalendar.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: undefined })
    );
  });

  it('still creates an entry ahead of the money', async () => {
    respond([offline({ item_type: 'event_entry' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 1, failed: 0 });
  });

  it('still holds a membership back until it is paid for', async () => {
    // An entitlement that runs for a year; granting it before payment gives it
    // away, and there is no gate to check on the day.
    respond([offline({ item_type: 'membership' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 0, failed: 0, complete: false });
  });

  /**
   * An order record is not the goods.
   *
   * Reported as: a shop item bought with Pay Offline, and nothing under "My
   * shop orders". The line was deferred with memberships, on the reasoning that
   * goods should not be posted unpaid — which confuses *creating the order*
   * with *dispatching it*. `merchandise_orders` defaults **both**
   * `order_status` and `payment_status` to `pending`, so the order can exist
   * while nothing is sent; and without it the club had no record that money was
   * owed or what to set aside.
   */
  it('creates the shop order rather than waiting for the money', async () => {
    respond([offline({ item_type: 'merchandise', context_id: 'merch-1', context_ref: merchandiseContext() })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 1, failed: 0 });
  });

  it('records how the shop order will be paid, without claiming it is settled', async () => {
    respond([offline({ item_type: 'merchandise', context_id: 'merch-1', context_ref: merchandiseContext() })]);

    await service.fulfilPayment('pay-1');

    expect(mockMerchandise.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: 'offline' })
    );
  });

  it('leaves a paid shop order claiming nothing about a payment method', async () => {
    respond([line({ item_type: 'merchandise', context_id: 'merch-1', context_ref: merchandiseContext() })]);

    await service.fulfilPayment('pay-1');

    expect(mockMerchandise.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: undefined })
    );
  });

  it('still holds a registration back until it is paid for', async () => {
    /*
     * The reason that genuinely applies to this type: `createRegistration` sets
     * `active` when the type auto-approves, so creating one before payment
     * hands over the registration itself rather than a record of an intention.
     */
    respond([offline({ item_type: 'registration' })]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 0, failed: 0, complete: false });
  });

  it('reports the order as unfinished while anything is deferred', async () => {
    // `complete: false` is what tells a later run to come back for them.
    respond([
      offline({ id: 'line-1', item_type: 'booking', context_ref: bookingContext() }),
      offline({ id: 'line-2', item_type: 'membership' }),
    ]);

    const outcome = await service.fulfilPayment('pay-1');

    expect(outcome).toMatchObject({ fulfilled: 1, complete: false });
  });
});
