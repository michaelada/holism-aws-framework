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
     * An offline order is not goods-in-hand. Only entries are created ahead of
     * the money, so this waits for the club to record the payment.
     */
    it('waits for the money on an offline order', async () => {
      respond([merchandiseLine({ payment_status: 'awaiting_offline' })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 0, failed: 0, complete: false });
      expect(mockMerchandise.createOrder).not.toHaveBeenCalled();
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
        1
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

    it('waits for the money on an offline booking', async () => {
      respond([bookingLine({ payment_status: 'awaiting_offline' })]);

      const outcome = await service.fulfilPayment('pay-1');

      expect(outcome).toEqual({ fulfilled: 0, failed: 0, complete: false });
      expect(mockCalendar.createBooking).not.toHaveBeenCalled();
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
});
