import { AccountActivityService } from '../account-activity.service';
import { db } from '../../database/pool';
import { NotFoundError, ValidationError } from '../../middleware/errors';
import { calendarService } from '../calendar.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../calendar.service', () => ({
  calendarService: { cancelBookingWithRefund: jest.fn() },
}));

const mockDb = db as jest.Mocked<typeof db>;

const ORG = 'org-1';
const MEMBER = 'ou-1';
/** Fixed so nothing depends on the day the suite runs. */
const TODAY = new Date('2026-06-15T09:00:00Z');

const entryRow = (over: Record<string, any> = {}) => ({
  id: 'entry-1',
  event_id: 'event-1',
  event_activity_id: 'activity-1',
  quantity: 1,
  payment_status: 'paid',
  payment_method: 'card',
  entry_date: new Date('2026-05-01'),
  event_name: 'Summer Regatta',
  start_date: '2026-07-01',
  end_date: '2026-07-02',
  activity_name: 'Junior Single Sculls',
  first_name: 'Rónán',
  last_name: 'McGrath',
  fee: '25.00',
  ...over,
});

const membershipRow = (over: Record<string, any> = {}) => ({
  id: 'member-1',
  membership_number: 'M-0001',
  membership_type_id: 'mt-1',
  status: 'active',
  valid_until: '2026-12-31',
  date_last_renewed: '2026-01-01',
  payment_status: 'paid',
  membership_type_name: 'Full Member',
  first_name: 'Niamh',
  last_name: 'Walsh',
  ...over,
});

describe('AccountActivityService', () => {
  let service: AccountActivityService;

  beforeEach(() => {
    mockDb.query.mockReset();
    service = new AccountActivityService();
  });

  describe('listEntries', () => {
    it('returns the member\'s entries with the event and activity named', async () => {
      mockDb.query.mockResolvedValue({ rows: [entryRow()] } as any);

      const entries = await service.listEntries(ORG, MEMBER, TODAY);

      expect(entries[0]).toMatchObject({
        id: 'entry-1',
        eventName: 'Summer Regatta',
        activityName: 'Junior Single Sculls',
        fee: 25,
      });
    });

    /*
     * Who the entry is for, which is not always whose account it is under.
     *
     * A parent holds the household's entries on one login, so a list headed by
     * the event and the class alone gives four identical rows.
     */
    it('names the entrant', async () => {
      mockDb.query.mockResolvedValue({ rows: [entryRow()] } as any);

      const [entry] = await service.listEntries(ORG, MEMBER, TODAY);

      expect(entry.entrantName).toBe('Rónán McGrath');
    });

    it('asks the query for the name', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);
      await service.listEntries(ORG, MEMBER, TODAY);

      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('ee.first_name');
      expect(String(sql)).toContain('ee.last_name');
    });

    it('does not leave a stray space when only one part is recorded', async () => {
      mockDb.query.mockResolvedValue({
        rows: [entryRow({ first_name: 'Rónán', last_name: null })],
      } as any);

      const [entry] = await service.listEntries(ORG, MEMBER, TODAY);

      expect(entry.entrantName).toBe('Rónán');
    });

    /**
     * The security boundary. Entries carry no organisation of their own, so the
     * join to `events` is what stops one club's entries appearing in another's.
     */
    it('scopes by both the member and the organisation', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);
      await service.listEntries(ORG, MEMBER, TODAY);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('ee.user_id = $1');
      expect(String(sql)).toContain('e.organisation_id = $2');
      expect(params).toEqual([MEMBER, ORG]);
    });

    it('derives the status from the end of the event, not its start', async () => {
      // A multi-day event is not complete on its opening day.
      mockDb.query.mockResolvedValue({
        rows: [entryRow({ start_date: '2026-06-14', end_date: '2026-06-20' })],
      } as any);

      const [entry] = await service.listEntries(ORG, MEMBER, TODAY);
      expect(entry.status).toBe('confirmed');
    });

    it('marks an unpaid future entry as awaiting payment', async () => {
      mockDb.query.mockResolvedValue({
        rows: [entryRow({ payment_status: 'pending' })],
      } as any);

      const [entry] = await service.listEntries(ORG, MEMBER, TODAY);
      expect(entry.status).toBe('awaiting-payment');
    });

    it('returns a fee as a number rather than the string pg gives back', async () => {
      // decimal columns arrive as strings; leaving them would make the UI
      // concatenate rather than add.
      mockDb.query.mockResolvedValue({ rows: [entryRow({ fee: '12.50' })] } as any);

      const [entry] = await service.listEntries(ORG, MEMBER, TODAY);
      expect(entry.fee).toBe(12.5);
    });

    it('tolerates an activity with no fee', async () => {
      mockDb.query.mockResolvedValue({ rows: [entryRow({ fee: null })] } as any);

      const [entry] = await service.listEntries(ORG, MEMBER, TODAY);
      expect(entry.fee).toBeNull();
    });

    it('returns an empty list rather than failing when there is nothing', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);
      await expect(service.listEntries(ORG, MEMBER, TODAY)).resolves.toEqual([]);
    });
  });

  describe('getEntry', () => {
    it('returns the detail C2 renders', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          entryRow({
            first_name: 'Sam',
            last_name: 'Rivers',
            email: 'sam@example.com',
            form_submission_id: 'fs-1',
            event_description: 'Annual regatta',
            activity_description: 'Under 18',
            add_confirmation_message: true,
            confirmation_message: 'See you there',
          }),
        ],
      } as any);

      const entry = await service.getEntry(ORG, MEMBER, 'entry-1', TODAY);

      expect(entry).toMatchObject({
        firstName: 'Sam',
        email: 'sam@example.com',
        formSubmissionId: 'fs-1',
        confirmationMessage: 'See you there',
      });
    });

    it('withholds a confirmation message the club has not switched on', async () => {
      // Otherwise an unfinished draft is shown to members.
      mockDb.query.mockResolvedValue({
        rows: [
          entryRow({
            add_confirmation_message: false,
            confirmation_message: 'draft, do not send',
          }),
        ],
      } as any);

      const entry = await service.getEntry(ORG, MEMBER, 'entry-1', TODAY);
      expect(entry.confirmationMessage).toBeNull();
    });

    it('reports another member\'s entry as simply not found', async () => {
      // Distinguishing "not yours" from "does not exist" would confirm the id
      // is real to someone probing for it.
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.getEntry(ORG, MEMBER, 'someone-elses', TODAY)).rejects.toThrow(
        NotFoundError
      );
    });

    /**
     * What the member wrote on the entry form.
     *
     * The detail screen is the only place they can see it — the form is gone
     * once the entry exists, and the submission endpoint serves only lines
     * still in an open basket. It said "your answers are not available to view
     * here" about answers the member had just typed.
     */
    it('returns the answers the member gave', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [entryRow({ form_submission_id: 'fs-1' })] } as any)
        // The form-summary join: one row per answered field, in form order.
        .mockResolvedValueOnce({
          rows: [
            { submission_id: 'fs-1', submission_data: { rider_name: 'Sam Rivers', diet: 'Gluten free' }, field_name: 'rider_name', label: 'Rider name', order: 1 },
            { submission_id: 'fs-1', submission_data: { rider_name: 'Sam Rivers', diet: 'Gluten free' }, field_name: 'diet', label: 'Dietary requirements', order: 2 },
          ],
        } as any);

      const entry = await service.getEntry(ORG, MEMBER, 'entry-1', TODAY);

      expect(entry.formSummary).toEqual([
        { label: 'Rider name', value: 'Sam Rivers' },
        { label: 'Dietary requirements', value: 'Gluten free' },
      ]);
    });

    it('returns no answers for an activity that asked nothing', async () => {
      // A real case, and a different statement from "we cannot show you what
      // you wrote" — the screen says so rather than showing an empty heading.
      mockDb.query
        .mockResolvedValueOnce({ rows: [entryRow({ form_submission_id: null })] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const entry = await service.getEntry(ORG, MEMBER, 'entry-1', TODAY);

      expect(entry.formSummary).toEqual([]);
    });

    it('scopes the lookup by entry, member and organisation together', async () => {
      mockDb.query.mockResolvedValue({ rows: [entryRow()] } as any);
      await service.getEntry(ORG, MEMBER, 'entry-1', TODAY);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('ee.id = $1');
      expect(String(sql)).toContain('ee.user_id = $2');
      expect(String(sql)).toContain('e.organisation_id = $3');
      expect(params).toEqual(['entry-1', MEMBER, ORG]);
    });
  });

  describe('listBookings', () => {
    const bookingRow = (over: Record<string, any> = {}) => ({
      id: 'booking-1',
      booking_reference: 'BK-001',
      calendar_id: 'cal-1',
      booking_date: '2026-07-01',
      start_time: '09:00',
      end_time: '10:00',
      duration: 60,
      places_booked: 2,
      total_price: '30.00',
      booking_status: 'confirmed',
      payment_status: 'paid',
      cancelled_at: null,
      calendar_name: 'Court 1',
      ...over,
    });

    it('returns bookings with their calendar named', async () => {
      mockDb.query.mockResolvedValue({ rows: [bookingRow()] } as any);

      const [booking] = await service.listBookings(ORG, MEMBER, TODAY);
      expect(booking).toMatchObject({
        bookingReference: 'BK-001',
        calendarName: 'Court 1',
        totalPrice: 30,
        status: 'confirmed',
      });
    });

    it('scopes through the calendar to the organisation', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);
      await service.listBookings(ORG, MEMBER, TODAY);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('b.user_id = $1');
      expect(String(sql)).toContain('c.organisation_id = $2');
      expect(params).toEqual([MEMBER, ORG]);
    });

    it('shows a cancelled past booking as cancelled, not completed', async () => {
      mockDb.query.mockResolvedValue({
        rows: [bookingRow({ booking_status: 'cancelled', booking_date: '2026-01-01' })],
      } as any);

      const [booking] = await service.listBookings(ORG, MEMBER, TODAY);
      expect(booking.status).toBe('cancelled');
    });
  });

  describe('listMemberships', () => {
    /** First call is the membership list, second the open types. */
    const respond = (memberships: any[], openTypes: any[]) => {
      mockDb.query
        .mockResolvedValueOnce({ rows: memberships } as any)
        .mockResolvedValueOnce({ rows: openTypes } as any);
    };

    it('returns memberships with their type named', async () => {
      respond([membershipRow()], [{ id: 'mt-1' }]);

      const [membership] = await service.listMemberships(ORG, MEMBER, TODAY);
      expect(membership).toMatchObject({
        membershipNumber: 'M-0001',
        membershipTypeName: 'Full Member',
        status: 'active',
      });
    });

    it('scopes by member and organisation', async () => {
      respond([membershipRow()], [{ id: 'mt-1' }]);
      await service.listMemberships(ORG, MEMBER, TODAY);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('m.user_id = $1');
      expect(String(sql)).toContain('m.organisation_id = $2');
      expect(params).toEqual([MEMBER, ORG]);
    });

    it('does not offer renewal while there is plenty of time left', async () => {
      respond([membershipRow({ valid_until: '2026-12-31' })], [{ id: 'mt-1' }]);

      const [membership] = await service.listMemberships(ORG, MEMBER, TODAY);
      expect(membership.canRenew).toBe(false);
      expect(membership.renewalNotOpen).toBe(false);
    });

    it('offers renewal inside the window when something is open to renew into', async () => {
      respond([membershipRow({ valid_until: '2026-07-01' })], [{ id: 'mt-1' }]);

      const [membership] = await service.listMemberships(ORG, MEMBER, TODAY);
      expect(membership.canRenew).toBe(true);
      expect(membership.daysRemaining).toBe(16);
    });

    /**
     * The third condition of the C4 rule. Without it the screen shows a Renew
     * button that leads to a page with nothing on it.
     */
    it('reports renewals as not yet open when no membership type is available', async () => {
      respond([membershipRow({ valid_until: '2026-07-01' })], []);

      const [membership] = await service.listMemberships(ORG, MEMBER, TODAY);
      expect(membership.canRenew).toBe(false);
      expect(membership.renewalNotOpen).toBe(true);
    });

    it('does not offer renewal for a cancelled membership', async () => {
      respond(
        [membershipRow({ status: 'cancelled', valid_until: '2026-07-01' })],
        [{ id: 'mt-1' }]
      );

      const [membership] = await service.listMemberships(ORG, MEMBER, TODAY);
      expect(membership.canRenew).toBe(false);
      expect(membership.renewalNotOpen).toBe(false);
    });

    it('skips the membership-type lookup entirely when the member has none', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await expect(service.listMemberships(ORG, MEMBER, TODAY)).resolves.toEqual([]);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('names who the membership is for, not who holds it', async () => {
      // A parent holds their children's: `user_id` is theirs, the name is the
      // child's, and a screen headed by the type cannot tell them apart.
      respond(
        [membershipRow({ first_name: 'Conor', last_name: 'McGrath' })],
        [{ id: 'mt-1' }]
      );

      const [membership] = await service.listMemberships(ORG, MEMBER, TODAY);

      expect(membership.memberName).toBe('Conor McGrath');
    });

    it('does not leave a stray space when only one name is recorded', async () => {
      respond([membershipRow({ first_name: 'Cher', last_name: null })], [{ id: 'mt-1' }]);

      const [membership] = await service.listMemberships(ORG, MEMBER, TODAY);

      expect(membership.memberName).toBe('Cher');
    });

    it('offers renewal when an open type exists to renew into', async () => {
      // Regression: this query matched `membership_status = 'active'`, a value
      // the column never takes, so no membership was ever renewable.
      // Sixteen days out, inside the 30-day renewal window.
      respond([membershipRow({ valid_until: '2026-07-01' })], [{ id: 'mt-1' }]);

      const [membership] = await service.listMemberships(ORG, MEMBER, TODAY);

      expect(membership.canRenew).toBe(true);
      expect(membership.renewalNotOpen).toBe(false);
    });

    it('only counts membership types that are open and not expired', async () => {
      respond([membershipRow({ valid_until: '2026-07-01' })], [{ id: 'mt-1' }]);
      await service.listMemberships(ORG, MEMBER, TODAY);

      const [sql] = mockDb.query.mock.calls[1];
      // `open`, not `active`: those are the only two values the column takes,
      // and matching on `active` silently made every renewal impossible.
      expect(String(sql)).toContain("membership_status = 'open'");
      expect(String(sql)).toContain('valid_until IS NULL OR valid_until >=');
    });
  });
  /**
   * F1/F2 — receipts.
   *
   * The total is `card_amount + offline_amount`: one order can be part card and
   * part cheque, and `payments.amount` is the decimal legacy column that
   * predates the split. Reading it would understate a mixed order.
   */
  describe('listPayments', () => {
    const paymentRow = (over: Record<string, any> = {}) => ({
      id: 'pay-1',
      payment_status: 'paid',
      currency: 'EUR',
      payment_method: 'card',
      payment_date: new Date('2026-06-01'),
      created_at: new Date('2026-06-01'),
      card_amount: 5500,
      offline_amount: 0,
      handling_fee: 150,
      offline_received_at: null,
      lines: [
        {
          id: 'line-1',
          itemType: 'merchandise',
          description: 'Club polo — Large',
          fee: 2750,
          handlingFee: 75,
          fulfilled: true,
          fulfilmentError: null,
          fulfilmentRef: 'order-1',
          subjectName: null,
        },
      ],
      ...over,
    });

    /**
     * Attempts are not payments.
     *
     * A member reported the payments screen as "confused": one item in their
     * basket, and a pending payment beside it listing that item twice. The
     * pending payment was a checkout they had started and abandoned, still
     * carrying the contents of a basket from ten minutes earlier.
     */
    it('leaves out checkouts that were started and never finished', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await service.listPayments(ORG, MEMBER);

      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain("NOT IN ('pending', 'abandoned')");
    });

    it('excludes those two and nothing else', async () => {
      /*
       * The other half of the rule, and the one worth pinning: `awaiting_offline`
       * is money the member owes, `failed` is a decline they have to act on, and
       * hiding either would be worse than showing an attempt. Asserting the
       * exclusion list exactly is what stops a later edit quietly widening it.
       */
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await service.listPayments(ORG, MEMBER);

      const sql = String(mockDb.query.mock.calls[0][0]);
      const excluded = sql.match(/NOT IN \(([^)]*)\)/)?.[1] ?? '';
      const statuses = excluded
        .split(',')
        .map((s) => s.trim().replace(/'/g, ''))
        .filter(Boolean);

      expect(statuses.sort()).toEqual(['abandoned', 'pending']);
    });

    it('totals card and offline together', async () => {
      mockDb.query.mockResolvedValue({
        rows: [paymentRow({ card_amount: 3000, offline_amount: 2500 })],
        rowCount: 1,
      } as any);

      const [payment] = await service.listPayments(ORG, MEMBER);

      expect(payment).toMatchObject({ cardAmount: 3000, offlineAmount: 2500, total: 5500 });
    });

    it('carries the lines so a receipt reads as more than a figure', async () => {
      mockDb.query.mockResolvedValue({ rows: [paymentRow()], rowCount: 1 } as any);

      const [payment] = await service.listPayments(ORG, MEMBER);

      expect(payment.lines).toEqual([
        expect.objectContaining({ description: 'Club polo — Large', fee: 2750, fulfilled: true }),
      ]);
    });

    /*
     * Who each line was for, and what it produced.
     *
     * A payment covering a basket — two children entered, a membership
     * renewed, a shirt — reads as four figures unless each line says who it
     * was for and leads to the thing it bought. The description alone cannot:
     * it is composed when the basket is filled, so two children in one class
     * give two lines reading identically.
     */
    it('names who each line was for, and what it produced', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          paymentRow({
            lines: [
              { id: 'l-1', itemType: 'event_entry', description: 'Spring League — Class 2', fee: 2500, handlingFee: 0, fulfilled: true, fulfilmentError: null, fulfilmentRef: 'entry-9', subjectName: 'Rónán McGrath' },
              { id: 'l-2', itemType: 'membership', description: 'Family Membership', fee: 9600, handlingFee: 0, fulfilled: true, fulfilmentError: null, fulfilmentRef: 'member-3', subjectName: 'Conor McGrath' },
            ],
          }),
        ],
        rowCount: 1,
      } as any);

      const [payment] = await service.listPayments(ORG, MEMBER);

      expect(payment.lines).toEqual([
        expect.objectContaining({ subjectName: 'Rónán McGrath', fulfilmentRef: 'entry-9' }),
        expect.objectContaining({ subjectName: 'Conor McGrath', fulfilmentRef: 'member-3' }),
      ]);
    });

    it('reports no name and no record where the line has neither', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          paymentRow({
            lines: [
              { id: 'l-1', itemType: 'merchandise', description: 'Club cap', fee: 1500, handlingFee: 0, fulfilled: false, fulfilmentError: null, fulfilmentRef: null, subjectName: null },
            ],
          }),
        ],
        rowCount: 1,
      } as any);

      const [payment] = await service.listPayments(ORG, MEMBER);

      // Null, not an empty string: the screen offers no link rather than a
      // dead one, and prints no name rather than a blank line.
      expect(payment.lines[0]).toMatchObject({ subjectName: null, fulfilmentRef: null });
    });

    /*
     * The join has to answer per item type.
     *
     * `CONCAT_WS` returns an empty string rather than null when every argument
     * is null, so a `COALESCE` over bare concatenations always picks the first
     * branch — which made every membership line come back nameless while the
     * entries looked fine.
     */
    it('reads the name from the record each item type produced', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await service.listPayments(ORG, MEMBER);

      const [sql] = mockDb.query.mock.calls[0];
      const text = String(sql);
      expect(text).toContain('pt.item_type = \'event_entry\' AND ee.id = pt.fulfilment_ref');
      expect(text).toContain('pt.item_type = \'membership\' AND mem.id = pt.fulfilment_ref');
      expect(text).toContain('pt.item_type = \'registration\' AND reg.id = pt.fulfilment_ref');
      // Each branch nulls its own empty string, or the first would always win.
      expect(text).toContain("NULLIF(TRIM(CONCAT_WS(' ', mem.first_name, mem.last_name)), '')");
    });

    /** Paid for and produced nothing — the member should hear it here. */
    it('surfaces a line that failed to fulfil, with the reason', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          paymentRow({
            lines: [
              {
                id: 'line-1',
                itemType: 'booking',
                description: 'Tennis court 1',
                fee: 1200,
                handlingFee: 0,
                fulfilled: false,
                fulfilmentError: 'That slot is fully booked',
              },
            ],
          }),
        ],
        rowCount: 1,
      } as any);

      const [payment] = await service.listPayments(ORG, MEMBER);

      expect(payment.lines[0]).toMatchObject({
        fulfilled: false,
        fulfilmentError: 'That slot is fully booked',
      });
    });

    it('survives a payment with no lines at all', async () => {
      mockDb.query.mockResolvedValue({ rows: [paymentRow({ lines: null })], rowCount: 1 } as any);

      expect((await service.listPayments(ORG, MEMBER))[0].lines).toEqual([]);
    });

    it('scopes to this member in this organisation', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await service.listPayments(ORG, MEMBER);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('p.user_id = $1');
      expect(String(sql)).toContain('p.organisation_id = $2');
      expect(params).toEqual([MEMBER, ORG]);
    });

    it('says when the club recorded an offline payment as received', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          paymentRow({
            card_amount: 0,
            offline_amount: 5500,
            offline_received_at: new Date('2026-06-09'),
          }),
        ],
        rowCount: 1,
      } as any);

      const [payment] = await service.listPayments(ORG, MEMBER);

      expect(payment.offlineReceivedAt).toEqual(new Date('2026-06-09'));
    });
  });
  /**
   * The one thing a member may change: cancelling their own booking.
   *
   * The policy is re-read from the database rather than trusted from the list —
   * `canCancel` there is a snapshot, and a member who left the page open until
   * the notice lapsed must not slip through. **No money moves**: the refund
   * stays an act of the club.
   */
  describe('cancelBooking', () => {
    const mockCalendar = calendarService as jest.Mocked<typeof calendarService>;

    const bookingRow = (over: Record<string, any> = {}) => ({
      id: 'booking-1',
      booking_status: 'confirmed',
      payment_status: 'paid',
      booking_date: '2026-07-05',
      refund_processed: false,
      allow_cancellations: true,
      cancel_days_in_advance: 2,
      refund_payment_automatically: false,
      ...over,
    });

    beforeEach(() => {
      mockCalendar.cancelBookingWithRefund.mockReset();
      mockCalendar.cancelBookingWithRefund.mockResolvedValue({ id: 'booking-1' } as any);
    });

    it('cancels a booking well inside the notice period', async () => {
      mockDb.query.mockResolvedValue({ rows: [bookingRow()], rowCount: 1 } as any);

      const outcome = await service.cancelBooking(ORG, MEMBER, 'booking-1', TODAY);

      expect(outcome).toEqual({ refundExpected: false });
      expect(mockCalendar.cancelBookingWithRefund).toHaveBeenCalledWith(
        'booking-1',
        MEMBER,
        expect.any(String),
        // `refund_processed` records that money has gone back. It has not.
        false
      );
    });

    it('scopes the lookup to this member and organisation', async () => {
      mockDb.query.mockResolvedValue({ rows: [bookingRow()], rowCount: 1 } as any);

      await service.cancelBooking(ORG, MEMBER, 'booking-1', TODAY);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('b.user_id = $2');
      expect(String(sql)).toContain('c.organisation_id = $3');
      expect(params).toEqual(['booking-1', MEMBER, ORG]);
    });

    /** Somebody else's booking and a nonexistent one are the same answer. */
    it('reports a booking that is not this member’s as not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await expect(service.cancelBooking(ORG, MEMBER, 'booking-1', TODAY)).rejects.toBeInstanceOf(
        NotFoundError
      );
      expect(mockCalendar.cancelBookingWithRefund).not.toHaveBeenCalled();
    });

    it('refuses when the club does not allow members to cancel', async () => {
      mockDb.query.mockResolvedValue({
        rows: [bookingRow({ allow_cancellations: false })],
        rowCount: 1,
      } as any);

      await expect(service.cancelBooking(ORG, MEMBER, 'booking-1', TODAY)).rejects.toThrow(
        /does not allow/i
      );
      expect(mockCalendar.cancelBookingWithRefund).not.toHaveBeenCalled();
    });

    /** The snapshot problem: the page was open while the window closed. */
    it('refuses when the notice period has lapsed since the list was drawn', async () => {
      mockDb.query.mockResolvedValue({
        rows: [bookingRow({ booking_date: '2026-06-16' })],
        rowCount: 1,
      } as any);

      await expect(service.cancelBooking(ORG, MEMBER, 'booking-1', TODAY)).rejects.toThrow(
        /at least 2 days/i
      );
    });

    it('refuses one already cancelled', async () => {
      mockDb.query.mockResolvedValue({
        rows: [bookingRow({ booking_status: 'cancelled' })],
        rowCount: 1,
      } as any);

      await expect(service.cancelBooking(ORG, MEMBER, 'booking-1', TODAY)).rejects.toBeInstanceOf(
        ValidationError
      );
    });

    it('reports that a refund is due when the club refunds automatically', async () => {
      mockDb.query.mockResolvedValue({
        rows: [bookingRow({ refund_payment_automatically: true })],
        rowCount: 1,
      } as any);

      expect(await service.cancelBooking(ORG, MEMBER, 'booking-1', TODAY)).toEqual({
        refundExpected: true,
      });
      // Still not marked as refunded — that is the club's act, not this one.
      expect(mockCalendar.cancelBookingWithRefund).toHaveBeenCalledWith(
        'booking-1',
        MEMBER,
        expect.any(String),
        false
      );
    });
  });
});

/**
 * What a member answered last time, for prefilling a renewal.
 *
 * Renewing gives the club the same address and emergency contact as last
 * season, and the member was retyping every one of them.
 */
describe('membershipFormAnswers', () => {
  const service = new AccountActivityService();

  beforeEach(() => mockDb.query.mockReset());

  it('returns the answers keyed by field name', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        {
          membership_type_id: 'mt-1',
          first_name: 'Rónán',
          last_name: 'McGrath',
          submission_data: { rider_name: 'Rónán McGrath', address_line: '1 Main Street' },
        },
      ],
    } as any);

    const result = await service.membershipFormAnswers(ORG, MEMBER, 'member-9');

    expect(result).toEqual({
      membershipTypeId: 'mt-1',
      memberName: 'Rónán McGrath',
      answers: { rider_name: 'Rónán McGrath', address_line: '1 Main Street' },
    });
  });

  it('says who the membership is for, so the form can say so too', async () => {
    /*
     * The answers and the name belong together. A renewal form filled in from
     * Áine's membership under an empty "Who is this membership for?" is a form
     * that will be submitted for whoever is picked next, over answers that were
     * hers.
     */
    mockDb.query.mockResolvedValue({
      rows: [
        {
          membership_type_id: 'mt-1',
          first_name: 'Áine',
          last_name: 'McGrath',
          submission_data: {},
        },
      ],
    } as any);

    expect((await service.membershipFormAnswers(ORG, MEMBER, 'member-9'))?.memberName).toBe(
      'Áine McGrath'
    );
  });

  it('reports no name rather than an empty one', async () => {
    // A record with neither name on it: null is a fact the form can act on,
    // where '' would be filled into the box as a name.
    mockDb.query.mockResolvedValue({
      rows: [{ membership_type_id: 'mt-1', first_name: null, last_name: null, submission_data: {} }],
    } as any);

    expect((await service.membershipFormAnswers(ORG, MEMBER, 'member-9'))?.memberName).toBeNull();
  });

  /*
   * Not found and not-yours are the same answer. This returns the contents of
   * somebody's application form, so confirming that an id is real would be a
   * way of learning which ids exist.
   */
  it('scopes to the caller’s own memberships', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as any);

    const result = await service.membershipFormAnswers(ORG, MEMBER, 'member-9');

    expect(result).toBeNull();
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(String(sql)).toContain('m.id = $1 AND m.user_id = $2 AND m.organisation_id = $3');
    expect(params).toEqual(['member-9', MEMBER, ORG]);
  });

  /* A club that asked nothing, or a submission since removed. */
  it('reports no answers rather than failing when there is no submission', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ membership_type_id: 'mt-1', submission_data: null }],
    } as any);

    await expect(service.membershipFormAnswers(ORG, MEMBER, 'member-9')).resolves.toEqual({
      membershipTypeId: 'mt-1',
      memberName: null,
      answers: {},
    });
  });
});
