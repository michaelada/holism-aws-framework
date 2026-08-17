import { db } from '../database/pool';
import { logger } from '../config/logger';
import { membershipService } from './membership.service';
import { merchandiseService } from './merchandise.service';
import { calendarService } from './calendar.service';
import { registrationService } from './registration.service';
import { accountCatalogueService } from './account-catalogue.service';
import { ticketingService } from './ticketing.service';
import { parseContextRef } from '../utils/context-ref';

/**
 * Turning a paid payment into the things it bought.
 *
 * Fulfilment is deliberately **separate from confirming the payment**, and runs
 * after it rather than inside its transaction. The reasons are worth stating,
 * because the obvious design — do it all in one transaction — is wrong here:
 *
 *  - **The money is the part that must never be lost.** If fulfilment fails, a
 *    payment that has genuinely been taken must still be recorded as paid.
 *    Rolling it back would leave the member charged by Stripe and marked unpaid
 *    here, which is the worst of both.
 *  - **Lines fail independently.** A membership with no application form cannot
 *    be created; the event entry alongside it can. One bad line must not block
 *    the rest of the order.
 *  - **It has to be resumable.** A webhook retry after a partial failure needs
 *    to finish the job without re-issuing what already succeeded.
 *
 * So each `payment_transactions` line carries its own `fulfilled_at`, and this
 * service only ever looks at lines that do not have one. Running it twice is
 * safe; running it after a partial failure completes the remainder.
 */

/**
 * One spelling of an item type, whichever spelling the row carries.
 *
 * `cart_items.item_type` is `event_entry`, and `payment_transactions` copies it
 * verbatim — but this service was written against `event-entry` and never
 * updated when the basket moved to the underscore form to satisfy
 * `cart_items_item_type_check`. Every entry therefore fell through to the
 * `default` branch and failed with "fulfilment is not implemented for
 * event_entry".
 *
 * It went unnoticed because no payment had ever reached fulfilment: confirming
 * one always rolled back on a separate constraint fault (see migration
 * `1709000000025`). Two dormant bugs hid each other.
 *
 * Both spellings are accepted rather than one being chosen, because rows
 * written under either convention may exist and a payment must not fail over
 * punctuation.
 */
const itemTypeOf = (value: unknown): string => String(value ?? '').replace(/-/g, '_');

/** `YYYY-MM-DD` as local midnight — see `createBooking` for why not `new Date`. */
const localDate = (key: string): Date => {
  const [year, month, day] = key.slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export interface FulfilmentOutcome {
  /** Lines that produced a record on this run. */
  fulfilled: number;
  /** Lines that could not be fulfilled, with the reason recorded against them. */
  failed: number;
  /** True when nothing is left outstanding for this payment. */
  complete: boolean;
}

export class FulfilmentService {
  /**
   * Fulfil everything outstanding on a paid payment.
   *
   * Never throws for a line-level failure — the reason is recorded on the line
   * and the run continues. It throws only when the payment itself cannot be
   * read, which is a genuine fault worth retrying the webhook for.
   */
  async fulfilPayment(paymentId: string): Promise<FulfilmentOutcome> {
    const lines = await db.query(
      `SELECT pt.id, pt.item_type, pt.context_id, pt.context_ref, pt.quantity,
              pt.form_submission_id, pt.description, pt.organisation_id, pt.fee,
              p.user_id, p.payment_status
       FROM payment_transactions pt
       JOIN payments p ON p.id = pt.payment_id
       WHERE pt.payment_id = $1 AND pt.fulfilled_at IS NULL`,
      [paymentId]
    );

    if (lines.rows.length === 0) {
      return { fulfilled: 0, failed: 0, complete: true };
    }

    const paymentStatus = lines.rows[0].payment_status;
    const paid = paymentStatus === 'paid';

    /*
     * An order settled offline is fulfilled when it is placed, not when the
     * money arrives.
     *
     * The two payment routes differ in how long "not yet paid" lasts. A card
     * order is confirmed by Stripe seconds later, so waiting costs nothing. An
     * offline order might wait weeks for a cheque, and a member who has
     * completed checkout should not be without their entry — or their ticket —
     * for that whole time. The entry records `pending` and the ticket reads
     * "awaiting payment" until the club records the money, so nothing here
     * claims the order has been paid for.
     *
     * Anything else — pending card, failed, refunded — is still refused.
     */
    const placedOffline = paymentStatus === 'awaiting_offline';

    if (!paid && !placedOffline) {
      logger.warn('Refusing to fulfil a payment that is neither paid nor placed offline', {
        paymentId,
        status: paymentStatus,
      });
      return { fulfilled: 0, failed: 0, complete: false };
    }

    let fulfilled = 0;
    let failed = 0;
    let deferred = 0;

    for (const line of lines.rows) {
      /*
       * What an offline order creates before the money arrives.
       *
       * The distinction is **not** "cheap things yes, valuable things no". It is
       * whether the record can exist in a state that grants nothing:
       *
       *  - `event_entry` — created `pending`; the gate checks on the day.
       *  - `booking` — created with `payment_status: pending`. A slot that is
       *    not booked is a slot *still on sale*, and the basket hold lapses two
       *    minutes after checkout, so deferring loses the member the thing they
       *    have just committed to pay for.
       *  - `merchandise` — `merchandise_orders` defaults **both**
       *    `order_status` and `payment_status` to `pending`, so the order
       *    exists and nothing is dispatched. Deferring it meant the member saw
       *    nothing under "My shop orders" *and the club had no order at all* —
       *    no record that money was owed, or what to set aside. An order record
       *    is not the goods.
       *
       * Memberships and registrations stay deferred, and for a reason that does
       * apply to them specifically: `createMember` and `createRegistration` set
       * `active` when the type auto-approves, so creating one before payment
       * hands over a year's entitlement. Making them would need that rule
       * changed first, which is a decision about approval rather than about
       * fulfilment.
       */
      const createdBeforePayment = ['event_entry', 'booking', 'merchandise'];
      if (!paid && !createdBeforePayment.includes(itemTypeOf(line.item_type))) {
        deferred += 1;
        continue;
      }

      try {
        const ref = await this.fulfilLine(line);
        await this.markFulfilled(line.id, ref);
        fulfilled += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Fulfilment failed';
        // Recorded, not thrown. An order that is paid but incomplete needs a
        // human to look at it, and "which line and why" is the whole question.
        await this.markFailed(line.id, reason);
        logger.error('Failed to fulfil a payment line', {
          paymentId,
          lineId: line.id,
          itemType: line.item_type,
          reason,
        });
        failed += 1;
      }
    }

    // Deferred lines are not failures, but the order is not finished either —
    // `complete` must stay false so a later run knows to come back for them.
    return { fulfilled, failed, complete: failed === 0 && deferred === 0 };
  }

  /** Create the record one line paid for, returning its id. */
  private async fulfilLine(line: any): Promise<string> {
    switch (itemTypeOf(line.item_type)) {
      case 'event_entry':
        return this.createEventEntry(line);
      case 'membership':
        return this.createMembership(line);
      case 'merchandise':
        return this.createMerchandiseOrder(line);
      case 'booking':
        return this.createBooking(line);
      case 'registration':
        return this.createRegistration(line);
      default:
        /*
         * Every item type the basket allows is now fulfillable, so this is a
         * line whose type is not one of them. Failing explicitly is better than
         * silently doing nothing: the line is left visible with a reason rather
         * than appearing fulfilled.
         */
        throw new Error(`Fulfilment is not implemented for "${line.item_type}"`);
    }
  }

  /**
   * The entry the member paid for.
   *
   * `context_id` is the activity; the event is derived from it rather than
   * stored twice, so the two can never disagree.
   *
   * The entrant's name and email are copied onto the entry, as
   * `event_entries` requires. They are a snapshot: the entry records who
   * entered at the time, and a later change of name on the account should not
   * silently rewrite the start list of a past event.
   */
  private async createEventEntry(line: any): Promise<string> {
    if (!line.context_id) {
      throw new Error('The entry has no activity recorded against it');
    }

    const activity = await db.query(
      `SELECT a.id, a.event_id
       FROM event_activities a
       JOIN events e ON e.id = a.event_id
       WHERE a.id = $1 AND e.organisation_id = $2`,
      [line.context_id, line.organisation_id]
    );

    if (activity.rows.length === 0) {
      throw new Error('The activity no longer exists');
    }

    const member = await db.query(
      `SELECT first_name, last_name, email FROM organization_users WHERE id = $1`,
      [line.user_id]
    );

    if (member.rows.length === 0) {
      throw new Error('The member could not be found');
    }

    const { first_name, last_name, email } = member.rows[0];

    /*
     * The entry records what is actually true of the money.
     *
     * An offline order is fulfilled when it is placed, so hard-coding `paid`
     * here would mark a cheque as received the moment the member pressed
     * confirm — and the ticket, whose state is derived from this column, would
     * read "valid" at a gate for an entry nobody had paid for.
     */
    const paid = line.payment_status === 'paid';

    const result = await db.query(
      `INSERT INTO event_entries
         (event_id, event_activity_id, user_id, first_name, last_name, email,
          form_submission_id, quantity, payment_status, payment_method,
          entry_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, NOW(), NOW(), NOW())
       RETURNING id`,
      [
        activity.rows[0].event_id,
        activity.rows[0].id,
        line.user_id,
        first_name,
        last_name,
        email,
        line.form_submission_id ?? null,
        paid ? 'paid' : 'pending',
        paid ? 'card' : 'offline',
      ]
    );

    const entryId = result.rows[0].id;

    /*
     * The ticket, if the event issues them.
     *
     * Deliberately non-fatal. The member has paid and the entry exists; those
     * are the facts that matter and they are already committed. Letting a
     * ticketing problem throw here would mark the line failed and leave the
     * member looking at a failed order for a payment that went through — a far
     * worse outcome than an entry whose ticket has to be issued by hand.
     */
    try {
      await ticketingService.issueTicketForEntry(entryId);
    } catch (error) {
      logger.error(`Entry ${entryId} was created but its ticket could not be issued:`, error);
    }

    return entryId;
  }

  /**
   * The membership the member paid for.
   *
   * Delegated to `membershipService.createMember` rather than inserting
   * directly, because that is where membership-number generation and the expiry
   * calculation live. Reimplementing either here would produce numbers from a
   * second sequence and quietly break uniqueness.
   *
   * **`form_submission_id` is required and is not yet populated by the basket.**
   * `members.form_submission_id` is NOT NULL, and a membership application is
   * meaningless without the answers, so a line with none fails with a readable
   * reason rather than a constraint violation.
   */
  private async createMembership(line: any): Promise<string> {
    if (!line.context_id) {
      throw new Error('The membership has no type recorded against it');
    }
    if (!line.form_submission_id) {
      throw new Error(
        'The membership application form has not been completed for this item'
      );
    }

    const member = await db.query(
      `SELECT first_name, last_name FROM organization_users WHERE id = $1`,
      [line.user_id]
    );

    if (member.rows.length === 0) {
      throw new Error('The member could not be found');
    }

    const created = await membershipService.createMember({
      organisationId: line.organisation_id,
      membershipTypeId: line.context_id,
      userId: line.user_id,
      firstName: member.rows[0].first_name,
      lastName: member.rows[0].last_name,
      formSubmissionId: line.form_submission_id,
    });

    return created.id;
  }

  /**
   * The merchandise order the member paid for.
   *
   * `merchandiseService.createOrder` is called rather than an insert written
   * here: it is the same call the org-admin screens make, and it owns the
   * quantity rules, the pricing from the chosen option values and the stock
   * decrement. A second implementation would be a second answer to "what does
   * this cost", and this one runs after the money has been taken.
   *
   * **Stock is consumed here, not at add-to-cart.** A basket is not a
   * reservation — holding stock for an abandoned basket takes the last shirt
   * off the shelf for everyone else. The catalogue re-checks stock when the
   * line is added, which narrows the window without pretending to close it; if
   * the last one goes in between, this line fails with a reason a human can
   * act on rather than silently overselling.
   */
  private async createMerchandiseOrder(line: any): Promise<string> {
    if (!line.context_id) {
      throw new Error('The order has no item recorded against it');
    }

    const contextRef = parseContextRef(line.context_ref);
    const selectedOptions = contextRef.selectedOptions;

    if (!selectedOptions || typeof selectedOptions !== 'object') {
      throw new Error('The order has no options recorded against it');
    }

    const order = await merchandiseService.createOrder({
      organisationId: line.organisation_id,
      merchandiseTypeId: line.context_id,
      userId: line.user_id,
      selectedOptions: selectedOptions as Record<string, string>,
      // Null quantity means one: lines created before the column existed.
      quantity: line.quantity ?? 1,
      formSubmissionId: line.form_submission_id ?? undefined,
      /*
       * How it will be paid, recorded on the order so the club's own list says
       * what it is waiting for. `payment_status` defaults to `pending` either
       * way — this does not claim the order has been settled.
       */
      paymentMethod: line.payment_status === 'paid' ? undefined : 'offline',
    });

    return order.id;
  }

  /**
   * The slot the member paid for.
   *
   * **The last check on double-booking happens here**, not on the screen and
   * not in the basket. Availability was checked when the line was added, but a
   * court is exactly the thing two people want at once, and between adding and
   * paying somebody else may have taken it. `assertSlotAvailable` is asked
   * again with the payment line's own details; if it refuses, the line fails
   * with the reason and the club has a member to refund rather than two
   * bookings on one court.
   *
   * The price comes from the line, not from the calendar. The member agreed to
   * a figure at checkout and a club that re-priced its slots since must not
   * silently change what was bought.
   */
  private async createBooking(line: any): Promise<string> {
    const contextRef = parseContextRef(line.context_ref);
    const { calendarId, date, startTime, duration, places } = contextRef as Record<string, any>;

    if (!calendarId || !date || !startTime || !duration) {
      throw new Error('The booking has no slot recorded against it');
    }

    const placesBooked = Number(places ?? 1);

    /*
     * Throws with a readable reason when the slot has gone in the meantime.
     *
     * The buyer's own basket hold is left out of the sum: this line *is* that
     * hold being redeemed, and counting it would have the member's own
     * reservation report the slot as taken and refuse the booking it exists to
     * guarantee.
     */
    await accountCatalogueService.assertSlotAvailable(
      line.organisation_id,
      String(calendarId),
      String(date),
      String(startTime),
      Number(duration),
      placesBooked,
      new Date(),
      line.user_id,
      true
    );

    const booking = await calendarService.createBooking({
      calendarId: String(calendarId),
      userId: line.user_id,
      /*
       * Parsed as local midnight rather than `new Date('2026-08-08')`, which
       * JavaScript reads as UTC — west of Greenwich that is the evening of the
       * 7th, and the booking lands on the wrong day.
       */
      bookingDate: localDate(String(date)),
      startTime: String(startTime),
      duration: Number(duration),
      placesBooked,
      // `bookings.price_per_place` is decimal; the line is in minor units.
      pricePerPlace: (line.fee ?? 0) / 100 / Math.max(1, placesBooked),
      formSubmissionId: line.form_submission_id ?? undefined,
      /*
       * `calendar.service` reads a payment method as "not paid yet" — it sets
       * `payment_status` to `pending` when one is given and `paid` when it is
       * not. Passing the order's method is therefore what stops an offline
       * booking claiming to have been paid for, which is the whole reason it
       * can be created this early.
       */
      paymentMethod: line.payment_status === 'paid' ? undefined : 'offline',
    });

    return booking.id;
  }

  /**
   * The registration the member paid for.
   *
   * **The club's `automaticallyApprove` decides whether this is finished.** A
   * scheme that reviews its registrations creates a `pending` row: the member
   * has paid and is in the queue, not registered. Creating it `active` would
   * hand out a registration the club intended to look at first, and there is no
   * later gate to catch it.
   *
   * `entity_name` — the horse, the boat — is the substance of the record and is
   * NOT NULL. It was checked when the line was added; checking again here is
   * cheap and turns a constraint violation into a sentence.
   */
  private async createRegistration(line: any): Promise<string> {
    if (!line.context_id) {
      throw new Error('The registration has no type recorded against it');
    }
    if (!line.form_submission_id) {
      throw new Error('The registration form has not been completed for this item');
    }

    const contextRef = parseContextRef(line.context_ref);
    const entityName = typeof contextRef.entityName === 'string' ? contextRef.entityName.trim() : '';

    if (!entityName) {
      throw new Error('The registration has no name recorded against it');
    }

    const type = await registrationService.getRegistrationTypeById(line.context_id);
    if (!type) {
      throw new Error('The registration type could not be found');
    }

    const member = await db.query(
      `SELECT first_name, last_name FROM organization_users WHERE id = $1`,
      [line.user_id]
    );
    if (member.rows.length === 0) {
      throw new Error('The member could not be found');
    }

    const created = await registrationService.createRegistration({
      organisationId: line.organisation_id,
      registrationTypeId: line.context_id,
      userId: line.user_id,
      entityName,
      // The owner is the member, recorded as a snapshot: a later change of name
      // should not rewrite who registered the horse in 2026.
      ownerName: `${member.rows[0].first_name ?? ''} ${member.rows[0].last_name ?? ''}`.trim(),
      formSubmissionId: line.form_submission_id,
      status: type.automaticallyApprove ? 'active' : 'pending',
    });

    return created.id;
  }

  private async markFulfilled(lineId: string, ref: string): Promise<void> {
    await db.query(
      `UPDATE payment_transactions
       SET fulfilled_at = NOW(), fulfilment_ref = $2, fulfilment_error = NULL,
           status = 'fulfilled', updated_at = NOW()
       WHERE id = $1`,
      [lineId, ref]
    );
  }

  /**
   * Record why a line failed, leaving `fulfilled_at` null.
   *
   * That is deliberate: the line stays outstanding, so a later retry — a
   * webhook redelivery, or an administrator re-running fulfilment once the
   * cause is fixed — picks it up again.
   */
  private async markFailed(lineId: string, reason: string): Promise<void> {
    await db.query(
      `UPDATE payment_transactions
       SET fulfilment_error = $2, updated_at = NOW()
       WHERE id = $1`,
      [lineId, reason]
    );
  }
}

export const fulfilmentService = new FulfilmentService();
