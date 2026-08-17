import { db } from '../database/pool';
import { formSummariesFor } from '../utils/form-summary';
import { logger } from '../config/logger';
import { NotFoundError, ValidationError } from '../middleware/errors';
import { calendarService } from './calendar.service';
import {
  ActivityStatus,
  deriveActivityStatus,
  daysUntil,
  isDueForRenewal,
} from '../utils/activity-status';
import { decideCancellation, CancellationRefusal } from '../utils/booking-cancellation';

/**
 * A member's own activity within one organisation — screens C1, C2 and C4.
 *
 * **Every query in here is scoped by both the organisation and the member's
 * `organization_users.id`**, which the caller never supplies: it comes from
 * `req.account`, which `resolveAccountOrganisation` derived from the token.
 * That pairing is the whole security model of this service. A member must not
 * be able to read another member's entries by guessing an id, and must not be
 * able to read their *own* entries in an organisation they have left.
 *
 * The queries are read-only but for one: a member may cancel their own
 * **booking**, subject to the club's policy. Entries are deliberately not
 * self-cancellable (Q6) — a withdrawn entry has consequences for a start list
 * that the club, not the member, has to manage.
 *
 * Every method takes `today`. Status depends on the current date, so without it
 * the results would depend on the wall clock and could not be tested against a
 * fixed set of rows — and half the service being deterministic while the other
 * half was not is worse than either.
 */

/** Decimal money out of the database, minor units to the client. */
const toMinor = (value: unknown): number =>
  value === null || value === undefined ? 0 : Math.round(Number(value) * 100);

/** The one image a list row shows, out of a JSONB array that may be a string. */
const firstImage = (value: unknown): string | null => {
  const images = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  return typeof images[0] === 'string' ? images[0] : null;
};

/**
 * Why a cancellation was refused, in the member's terms.
 *
 * Written here rather than on the screen because the endpoint refuses too, and
 * the two must say the same thing — a member told "two days' notice" by the
 * list and "not allowed" by the button would rightly complain.
 */
const refusalMessage = (reason: string | null, noticeDays: number): string => {
  switch (reason) {
    case 'already-cancelled':
      return 'That booking has already been cancelled';
    case 'not-allowed':
      return 'This calendar does not allow members to cancel';
    case 'already-passed':
      return 'That booking has already passed';
    case 'too-late':
      return noticeDays === 1
        ? 'Cancellations need at least one day’s notice'
        : `Cancellations need at least ${noticeDays} days’ notice`;
    default:
      return 'That booking cannot be cancelled';
  }
};

export interface AccountEntry {
  id: string;
  eventId: string;
  eventName: string;
  activityId: string;
  activityName: string;
  startDate: string | null;
  endDate: string | null;
  quantity: number;
  fee: number | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  entryDate: string;
  status: ActivityStatus;
}

export interface AccountEntryDetail extends AccountEntry {
  firstName: string;
  lastName: string;
  email: string;
  formSubmissionId: string | null;
  /**
   * What the member answered on the entry form, labelled and in the club's own
   * field order. Empty when the activity asked nothing.
   */
  formSummary: Array<{ label: string; value: string }>;
  eventDescription: string | null;
  activityDescription: string | null;
  confirmationMessage: string | null;
}

export interface AccountBooking {
  id: string;
  bookingReference: string;
  calendarId: string;
  calendarName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  duration: number;
  placesBooked: number;
  totalPrice: number | null;
  paymentStatus: string | null;
  bookingStatus: string | null;
  cancelledAt: string | null;
  /** The club's policy, evaluated server-side (C1, C3). */
  canCancel: boolean;
  /** Why not — so the screen explains rather than hides. */
  cancellationRefusal: CancellationRefusal | null;
  /** The notice the club asks for, so the refusal can name it. */
  cancellationNoticeDays: number;
  /** Whether the club's policy means the member should expect their money back. */
  refundExpected: boolean;
  /**
   * The calendar's own icon key and colour, as the club chose them.
   *
   * Carried so the activity screen can mark a booking with the same symbol the
   * member picked it from — a court, an arena, a clubhouse — rather than one
   * generic booking glyph for all of them.
   */
  displayIcon: string | null;
  displayColour: string | null;
  status: ActivityStatus;
}

export interface AccountMerchandiseOrder {
  id: string;
  merchandiseTypeId: string;
  itemName: string;
  /** First image, or null — the list shows one thumbnail, not a gallery. */
  image: string | null;
  /** `{ "Size": "Large", "Colour": "Navy" }` — names, not ids. */
  options: Record<string, string>;
  quantity: number;
  /** Minor units, as everywhere money is shown. */
  unitPrice: number;
  deliveryFee: number;
  totalPrice: number;
  orderDate: string;
  paymentStatus: string | null;
  /** The club's own progress: pending, processing, ready, collected… */
  orderStatus: string | null;
  status: ActivityStatus;
}

/** One line of a payment — what it bought, and whether that arrived. */
export interface AccountPaymentLine {
  id: string;
  itemType: string;
  description: string;
  /** Minor units. */
  fee: number;
  handlingFee: number;
  fulfilled: boolean;
  /** Why the line produced nothing, when it did not. */
  fulfilmentError: string | null;
}

/** `GET /api/account/:orgCode/payments` — screens F1 and F2. */
export interface AccountPayment {
  id: string;
  status: string;
  currency: string;
  paymentMethod: string | null;
  paidOn: string | null;
  createdAt: string;
  /** Minor units. Card and offline are separate because one order can be both. */
  cardAmount: number;
  offlineAmount: number;
  handlingFee: number;
  total: number;
  offlineReceivedAt: string | null;
  lines: AccountPaymentLine[];
}

/** `GET /api/account/:orgCode/registrations` — screen C6. */
export interface AccountRegistration {
  id: string;
  registrationNumber: string;
  registrationTypeId: string;
  typeName: string;
  /** The club's word for the thing registered — "Horse", "Boat". */
  entityLabel: string;
  /** Its name — "Rocket". */
  entityName: string;
  ownerName: string | null;
  validUntil: string | null;
  dateLastRenewed: string | null;
  /** The club's own state: active, pending, elapsed. */
  registrationStatus: string | null;
  paymentStatus: string | null;
  status: ActivityStatus;
}

export interface AccountMembershipRecord {
  id: string;
  membershipNumber: string;
  membershipTypeId: string;
  membershipTypeName: string;
  /**
   * Who the membership is *for*, which is not always who is logged in.
   *
   * A parent holds their children's memberships: `members.user_id` is the
   * parent's, while each row carries the child's name. Without this the three
   * cards on their screen all read "Junior Member" and differ only by a number
   * they have no reason to recognise.
   */
  memberName: string;
  status: string;
  validUntil: string;
  dateLastRenewed: string;
  paymentStatus: string | null;
  daysRemaining: number | null;
  /**
   * What the member answered on the application form, labelled and in the
   * club's own field order. Empty when the club asked nothing.
   */
  formSummary: Array<{ label: string; value: string }>;
  /** In the renewal window *and* something exists to renew into. */
  canRenew: boolean;
  /**
   * Due for renewal but with nothing open to renew into.
   *
   * Distinguished from `canRenew` so the screen can say "renewals are not open
   * yet" rather than showing a button that leads nowhere (C4).
   */
  renewalNotOpen: boolean;
}

export class AccountActivityService {
  /**
   * Event entries, newest first.
   *
   * Scoped through `events.organisation_id` rather than a column on
   * `event_entries` — entries carry no organisation of their own, so the join
   * is what enforces the boundary. Dropping it would leak every organisation's
   * entries for this member.
   */
  async listEntries(
    organisationId: string,
    organisationUserId: string,
    today: Date = new Date()
  ): Promise<AccountEntry[]> {
    try {
      const result = await db.query(
        `SELECT
           ee.id, ee.event_id, ee.event_activity_id, ee.quantity,
           ee.payment_status, ee.payment_method, ee.entry_date,
           e.name AS event_name, e.start_date, e.end_date,
           ea.name AS activity_name, ea.fee
         FROM event_entries ee
         JOIN events e ON e.id = ee.event_id
         JOIN event_activities ea ON ea.id = ee.event_activity_id
         WHERE ee.user_id = $1 AND e.organisation_id = $2
         ORDER BY e.start_date DESC NULLS LAST, ee.entry_date DESC`,
        [organisationUserId, organisationId]
      );

      return result.rows.map((row) => this.toEntry(row, today));
    } catch (error) {
      logger.error('Failed to list account entries:', error);
      throw error;
    }
  }

  /**
   * One entry, with everything C2 renders.
   *
   * Not found and not-yours are deliberately the same answer: telling a member
   * that an entry exists but belongs to someone else confirms the id is real.
   */
  async getEntry(
    organisationId: string,
    organisationUserId: string,
    entryId: string,
    today: Date = new Date()
  ): Promise<AccountEntryDetail> {
    try {
      const result = await db.query(
        `SELECT
           ee.id, ee.event_id, ee.event_activity_id, ee.quantity,
           ee.payment_status, ee.payment_method, ee.entry_date,
           ee.first_name, ee.last_name, ee.email, ee.form_submission_id,
           e.name AS event_name, e.description AS event_description,
           e.start_date, e.end_date,
           e.add_confirmation_message, e.confirmation_message,
           ea.name AS activity_name, ea.description AS activity_description, ea.fee
         FROM event_entries ee
         JOIN events e ON e.id = ee.event_id
         JOIN event_activities ea ON ea.id = ee.event_activity_id
         WHERE ee.id = $1 AND ee.user_id = $2 AND e.organisation_id = $3`,
        [entryId, organisationUserId, organisationId]
      );

      const row = result.rows[0];
      if (!row) {
        throw new NotFoundError('Entry not found');
      }

      /*
       * The answers the member gave when they entered.
       *
       * This screen is the only place they can see them: the form itself is
       * gone once the entry exists, and the submission endpoint only serves
       * lines still sitting in an open basket. Without this the page had
       * nothing to show and said so — "your answers are not available to view
       * here" — about answers the member had just typed.
       */
      const answers = await formSummariesFor([row.form_submission_id]);

      return {
        ...this.toEntry(row, today),
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        formSubmissionId: row.form_submission_id ?? null,
        // Empty when the activity had no form, which is a real case: the page
        // then shows nothing rather than an empty heading.
        formSummary: answers.get(row.form_submission_id) ?? [],
        eventDescription: row.event_description ?? null,
        activityDescription: row.activity_description ?? null,
        // Suppressed unless the club turned it on, so an unfinished draft
        // message is not shown to members.
        confirmationMessage: row.add_confirmation_message
          ? (row.confirmation_message ?? null)
          : null,
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to load an account entry:', error);
      throw error;
    }
  }

  /** Bookings, newest first. Scoped through `calendars.organisation_id`. */
  async listBookings(
    organisationId: string,
    organisationUserId: string,
    today: Date = new Date()
  ): Promise<AccountBooking[]> {
    try {
      const result = await db.query(
        `SELECT
           b.id, b.booking_reference, b.calendar_id, b.booking_date,
           b.start_time, b.end_time, b.duration, b.places_booked,
           b.total_price, b.booking_status, b.payment_status, b.cancelled_at,
           b.refund_processed,
           c.name AS calendar_name, c.allow_cancellations,
           c.cancel_days_in_advance, c.refund_payment_automatically,
           -- The club's own mark for this calendar. Entries and bookings share
           -- one table on the activity screen, and the icon is what tells a
           -- lesson from a show entry at a glance.
           c.display_icon, c.display_colour
         FROM bookings b
         JOIN calendars c ON c.id = b.calendar_id
         WHERE b.user_id = $1 AND c.organisation_id = $2
         ORDER BY b.booking_date DESC, b.start_time DESC`,
        [organisationUserId, organisationId]
      );

      return result.rows.map((row) => {
        /*
         * Whether the member may cancel is decided here, not on the screen, and
         * returned with the reason it may not — so C1 can explain a missing
         * button instead of showing one that the endpoint would refuse.
         */
        const cancellation = decideCancellation(
          {
            bookingStatus: row.booking_status,
            paymentStatus: row.payment_status,
            bookingDate: row.booking_date,
            refundProcessed: row.refund_processed,
          },
          {
            allowCancellations: row.allow_cancellations,
            cancelDaysInAdvance: row.cancel_days_in_advance,
            refundPaymentAutomatically: row.refund_payment_automatically,
          },
          today
        );

        return {
        id: row.id,
        bookingReference: row.booking_reference,
        calendarId: row.calendar_id,
        calendarName: row.calendar_name,
        bookingDate: row.booking_date,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        placesBooked: row.places_booked ?? 1,
        totalPrice: row.total_price === null ? null : Number(row.total_price),
        paymentStatus: row.payment_status ?? null,
        bookingStatus: row.booking_status ?? null,
        cancelledAt: row.cancelled_at ?? null,
        canCancel: cancellation.canCancel,
        cancellationRefusal: cancellation.reason,
        cancellationNoticeDays: cancellation.noticeDays,
        refundExpected: cancellation.refundExpected,
        displayIcon: row.display_icon ?? null,
        displayColour: row.display_colour ?? null,
        status: deriveActivityStatus(
          {
            recordStatus: row.booking_status,
            paymentStatus: row.payment_status,
            occursOn: row.booking_date,
          },
          today
        ),
        };
      });
    } catch (error) {
      logger.error('Failed to list account bookings:', error);
      throw error;
    }
  }

  /**
   * Merchandise the member has ordered (C8).
   *
   * The chosen options are resolved to their names here rather than returned as
   * the ids `merchandise_orders.selected_options` stores. "Size: Large" is what
   * the member chose; a pair of uuids is what the database happens to record,
   * and the screen has no other way to turn one into the other.
   *
   * Names are read from the option values **as they are now**, which can drift
   * from what was ordered if a club renames a size. The alternative — snapshot
   * the names onto the order — is a schema change to `merchandise_orders` for a
   * rare case, and a renamed size is still the same size (§1.7).
   */
  async listMerchandiseOrders(
    organisationId: string,
    organisationUserId: string,
    today: Date = new Date()
  ): Promise<AccountMerchandiseOrder[]> {
    try {
      const result = await db.query(
        `SELECT o.id, o.merchandise_type_id, o.selected_options, o.quantity,
                o.unit_price, o.subtotal, o.delivery_fee, o.total_price,
                o.payment_status, o.order_status, o.order_date,
                mt.name AS item_name, mt.images, mt.delivery_type,
                COALESCE(
                  (SELECT jsonb_object_agg(ot.name, ov.name)
                     FROM merchandise_option_values ov
                     JOIN merchandise_option_types ot ON ot.id = ov.option_type_id
                    WHERE ov.id::text IN (
                      SELECT jsonb_each_text.value
                        FROM jsonb_each_text(o.selected_options)
                    )),
                  '{}'::jsonb
                ) AS option_names
         FROM merchandise_orders o
         JOIN merchandise_types mt ON mt.id = o.merchandise_type_id
         WHERE o.user_id = $1 AND o.organisation_id = $2
         ORDER BY o.order_date DESC`,
        [organisationUserId, organisationId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        merchandiseTypeId: row.merchandise_type_id,
        itemName: row.item_name,
        image: firstImage(row.images),
        options: row.option_names ?? {},
        quantity: row.quantity,
        unitPrice: toMinor(row.unit_price),
        deliveryFee: toMinor(row.delivery_fee),
        totalPrice: toMinor(row.total_price),
        orderDate: row.order_date,
        paymentStatus: row.payment_status ?? null,
        orderStatus: row.order_status ?? null,
        /*
         * An order has no date it "happens on" — it is placed, paid for and
         * then handed over. `occursOn` is left null so the shared vocabulary
         * reads as awaiting payment until the money arrives, and confirmed
         * after; the club's own order status carries the rest.
         */
        status: deriveActivityStatus(
          {
            recordStatus: row.order_status === 'cancelled' ? 'cancelled' : null,
            paymentStatus: row.payment_status,
            occursOn: null,
          },
          today
        ),
      }));
    } catch (error) {
      logger.error('Failed to list account merchandise orders:', error);
      throw error;
    }
  }

  /**
   * A member cancelling their own booking.
   *
   * **The policy is re-checked here, from the database**, not taken from the
   * screen: `canCancel` on the list is a snapshot, and a member who left the
   * page open until the notice period lapsed must not slip through. The same
   * query is the ownership check — a booking belonging to somebody else, or to
   * another organisation, simply is not found.
   *
   * **No money moves.** The refund stays an act of the club, through the
   * org-admin payments screens, and `refundExpected` tells the member what to
   * expect. Returning money on a member's click because a policy flag was set
   * would be a real transfer nobody reviewed.
   */
  async cancelBooking(
    organisationId: string,
    organisationUserId: string,
    bookingId: string,
    today: Date = new Date()
  ): Promise<{ refundExpected: boolean }> {
    const result = await db.query(
      `SELECT b.id, b.booking_status, b.payment_status, b.booking_date, b.refund_processed,
              c.allow_cancellations, c.cancel_days_in_advance, c.refund_payment_automatically
       FROM bookings b
       JOIN calendars c ON c.id = b.calendar_id
       WHERE b.id = $1 AND b.user_id = $2 AND c.organisation_id = $3`,
      [bookingId, organisationUserId, organisationId]
    );

    const row = result.rows[0];
    if (!row) {
      // Not found and not-yours are the same answer: confirming the id exists
      // would tell a guesser they had guessed right.
      throw new NotFoundError('Booking not found');
    }

    const decision = decideCancellation(
      {
        bookingStatus: row.booking_status,
        paymentStatus: row.payment_status,
        bookingDate: row.booking_date,
        refundProcessed: row.refund_processed,
      },
      {
        allowCancellations: row.allow_cancellations,
        cancelDaysInAdvance: row.cancel_days_in_advance,
        refundPaymentAutomatically: row.refund_payment_automatically,
      },
      today
    );

    if (!decision.canCancel) {
      throw new ValidationError(refusalMessage(decision.reason, decision.noticeDays));
    }

    await calendarService.cancelBookingWithRefund(
      bookingId,
      organisationUserId,
      'Cancelled by the member',
      // `refund_processed` records that money has gone back. It has not.
      false
    );

    return { refundExpected: decision.refundExpected };
  }

  /**
   * What the member has paid, newest first (F1).
   *
   * **The total is `card_amount + offline_amount`, not `amount`.** A single
   * order can be part card and part cheque — the basket lets a member choose
   * per item — and `payments.amount` is the decimal legacy column that predates
   * the split. Reading it would understate a mixed order.
   *
   * Line descriptions come back with the row rather than behind a second
   * request: "€45.00" tells a member nothing, and "Horse registration 2026 —
   * Rocket" is the whole reason they are on this screen.
   */
  async listPayments(
    organisationId: string,
    organisationUserId: string
  ): Promise<AccountPayment[]> {
    try {
      const result = await db.query(
        `SELECT p.id, p.payment_status, p.currency, p.payment_method, p.payment_date,
                p.created_at, p.card_amount, p.offline_amount, p.handling_fee,
                p.offline_received_at,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', pt.id,
                      'itemType', pt.item_type,
                      'description', pt.description,
                      'fee', pt.fee,
                      'handlingFee', pt.handling_fee,
                      'fulfilled', pt.fulfilled_at IS NOT NULL,
                      'fulfilmentError', pt.fulfilment_error
                    ) ORDER BY pt.created_at
                  ) FILTER (WHERE pt.id IS NOT NULL),
                  '[]'
                ) AS lines
         FROM payments p
         LEFT JOIN payment_transactions pt ON pt.payment_id = p.id
         WHERE p.user_id = $1 AND p.organisation_id = $2
           -- Attempts are not payments. A pending checkout is one a member
           -- opened and has not finished; an abandoned one had its basket
           -- change underneath it. Neither is something the member did, and
           -- listing them puts orders in the history that were never placed,
           -- itemised with lines they may since have removed.
           --
           -- Everything representing a real obligation or outcome stays: paid,
           -- awaiting_offline, refunded, and failed -- a decline is worth
           -- seeing, because the member has to act on it.
           -- See docs/PAYMENT_HISTORY_SHOWED_ATTEMPTS.md.
           AND p.payment_status NOT IN ('pending', 'abandoned')
         GROUP BY p.id
         ORDER BY COALESCE(p.payment_date, p.created_at) DESC`,
        [organisationUserId, organisationId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        status: row.payment_status,
        currency: row.currency,
        paymentMethod: row.payment_method ?? null,
        paidOn: row.payment_date ?? null,
        createdAt: row.created_at,
        cardAmount: row.card_amount ?? 0,
        offlineAmount: row.offline_amount ?? 0,
        handlingFee: row.handling_fee ?? 0,
        total: (row.card_amount ?? 0) + (row.offline_amount ?? 0),
        /** When the club recorded a cheque or a transfer as received. */
        offlineReceivedAt: row.offline_received_at ?? null,
        lines: (row.lines ?? []).map((line: any) => ({
          id: line.id,
          itemType: line.itemType,
          description: line.description ?? '',
          fee: line.fee ?? 0,
          handlingFee: line.handlingFee ?? 0,
          fulfilled: Boolean(line.fulfilled),
          /*
           * Surfaced to the member on purpose. A line that was paid for and
           * produced nothing is the club's problem to fix, but hiding it means
           * the member finds out at the gate instead of on this screen.
           */
          fulfilmentError: line.fulfilmentError ?? null,
        })),
      }));
    } catch (error) {
      logger.error('Failed to list account payments:', error);
      throw error;
    }
  }

  /**
   * What the member has registered (C6).
   *
   * The entity is the subject of the row, not a detail of it: "Rocket" is what
   * the member is looking for, and `entity_name` on the *type* is the word for
   * what Rocket is. Both are returned, because "Horse: Rocket" needs the label
   * and the name.
   *
   * `status` here is the club's own — active, pending, elapsed — folded into
   * the shared vocabulary, so a registration awaiting the club's approval reads
   * as awaiting rather than as confirmed.
   */
  async listRegistrations(
    organisationId: string,
    organisationUserId: string,
    today: Date = new Date()
  ): Promise<AccountRegistration[]> {
    try {
      const result = await db.query(
        `SELECT r.id, r.registration_number, r.registration_type_id, r.entity_name,
                r.owner_name, r.status, r.payment_status, r.valid_until,
                r.date_last_renewed, r.created_at,
                rt.name AS type_name, rt.entity_name AS entity_label
         FROM registrations r
         JOIN registration_types rt ON rt.id = r.registration_type_id
         WHERE r.user_id = $1 AND r.organisation_id = $2
         ORDER BY r.created_at DESC`,
        [organisationUserId, organisationId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        registrationNumber: row.registration_number,
        registrationTypeId: row.registration_type_id,
        typeName: row.type_name,
        /** The club's word for the thing — "Horse", "Boat". */
        entityLabel: row.entity_label,
        entityName: row.entity_name,
        ownerName: row.owner_name ?? null,
        validUntil: row.valid_until ?? null,
        dateLastRenewed: row.date_last_renewed ?? null,
        registrationStatus: row.status ?? null,
        paymentStatus: row.payment_status ?? null,
        /*
         * The shared vocabulary answers "where is the money?" — and a
         * registration has a second question, "has the club approved it?",
         * which no one of those four words can carry. So `status` stays about
         * payment and expiry, and `registrationStatus` is returned beside it
         * for the screen to show as its own chip (as C8 does for orders).
         *
         * An elapsed registration needs no special case: its `valid_until` is
         * in the past, which is already `completed`.
         */
        status: deriveActivityStatus(
          {
            recordStatus: null,
            paymentStatus: row.payment_status,
            occursOn: row.valid_until,
          },
          today
        ),
      }));
    } catch (error) {
      logger.error('Failed to list account registrations:', error);
      throw error;
    }
  }

  /**
   * Memberships, and whether each can be renewed.
   *
   * The renewal rule has three conditions (C4) and the third — that a
   * membership type is actually open for the following period — cannot be
   * answered from the membership row. It is checked here so the screen never
   * offers a button that leads nowhere; when the first two hold and the third
   * does not, `renewalNotOpen` says so instead.
   */
  async listMemberships(
    organisationId: string,
    organisationUserId: string,
    today: Date = new Date()
  ): Promise<AccountMembershipRecord[]> {
    try {
      const result = await db.query(
        `SELECT
           m.id, m.membership_number, m.membership_type_id, m.status,
           m.valid_until, m.date_last_renewed, m.payment_status,
           m.first_name, m.last_name, m.form_submission_id,
           mt.name AS membership_type_name
         FROM members m
         JOIN membership_types mt ON mt.id = m.membership_type_id
         WHERE m.user_id = $1 AND m.organisation_id = $2
         ORDER BY m.valid_until DESC`,
        [organisationUserId, organisationId]
      );

      if (result.rows.length === 0) return [];

      const renewable = await this.openMembershipTypeIds(organisationId, today);
      /*
       * What the member filled in when they applied.
       *
       * One query for the whole list. It is the only record they have of what
       * the club was told — the form itself is gone once the application is
       * approved — so it belongs on this screen rather than nowhere.
       */
      const answers = await formSummariesFor(
        result.rows.map((row) => row.form_submission_id)
      );

      return result.rows.map((row) => {
        const due = isDueForRenewal(
          { status: row.status, validUntil: row.valid_until },
          today
        );
        // Renewal into the *same* type is the common case; a club that has
        // published next year's type as a new row is handled by any open type
        // being enough to offer the action.
        const somethingToRenewInto = renewable.size > 0;

        return {
          id: row.id,
          membershipNumber: row.membership_number,
          membershipTypeId: row.membership_type_id,
          membershipTypeName: row.membership_type_name,
          memberName: [row.first_name, row.last_name].filter(Boolean).join(' '),
          status: row.status,
          validUntil: row.valid_until,
          dateLastRenewed: row.date_last_renewed,
          paymentStatus: row.payment_status ?? null,
          daysRemaining: daysUntil(row.valid_until, today),
          canRenew: due && somethingToRenewInto,
          renewalNotOpen: due && !somethingToRenewInto,
          // Empty when the club asked nothing, or the application predates the
          // form. The screen then shows no expander rather than an empty one.
          formSummary: answers.get(row.form_submission_id) ?? [],
        };
      });
    } catch (error) {
      logger.error('Failed to list account memberships:', error);
      throw error;
    }
  }

  /** Membership types a member could join or renew into right now. */
  private async openMembershipTypeIds(
    organisationId: string,
    today: Date
  ): Promise<Set<string>> {
    const result = await db.query(
      `SELECT id
       FROM membership_types
       WHERE organisation_id = $1
         AND deleted = FALSE
         AND membership_status = 'open'
         AND (valid_until IS NULL OR valid_until >= $2)`,
      [organisationId, today]
    );
    return new Set(result.rows.map((row) => row.id));
  }

  private toEntry(row: any, today: Date): AccountEntry {
    return {
      id: row.id,
      eventId: row.event_id,
      eventName: row.event_name,
      activityId: row.event_activity_id,
      activityName: row.activity_name,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      quantity: row.quantity ?? 1,
      fee: row.fee === null || row.fee === undefined ? null : Number(row.fee),
      paymentStatus: row.payment_status ?? null,
      paymentMethod: row.payment_method ?? null,
      entryDate: row.entry_date,
      status: deriveActivityStatus(
        {
          paymentStatus: row.payment_status,
          // The end of the event, not its start — a multi-day event is not
          // complete on its opening day.
          occursOn: row.end_date ?? row.start_date,
        },
        today
      ),
    };
  }
}

export const accountActivityService = new AccountActivityService();
