import { db } from '../database/pool';
import { logger } from '../config/logger';
import { accountCatalogueService } from './account-catalogue.service';
import { parseContextRef } from '../utils/context-ref';

/**
 * Is everything in this order still there?
 *
 * Asked once, between the card authorising and the money being taken. It is the
 * whole point of manual capture: the platform holds the funds, checks that the
 * slots and capped entries the member paid for are still available, and only
 * then captures. If something went in the meantime the authorisation is
 * reversed instead — no money moved, so no refund and no refund fee.
 *
 * **Only contended things are checked.** A membership or a jumper cannot be
 * taken by somebody else between authorising and capturing, so re-checking them
 * would add failure modes without preventing anything. Merchandise stock is
 * still the province of fulfilment, which decrements it transactionally.
 *
 * **The buyer's own holds are excluded** throughout. The order being checked
 * *is* those holds being redeemed; counting them would have a member's own
 * reservation report their slot as taken and reverse a payment that should have
 * gone through.
 */

export interface OrderAvailability {
  available: boolean;
  /** Member-facing, and specific: which line, and why. */
  reason: string | null;
}

export class OrderAvailabilityService {
  async check(paymentId: string): Promise<OrderAvailability> {
    const lines = await db.query(
      `SELECT pt.id, pt.item_type, pt.context_ref, pt.quantity, pt.description,
              p.organisation_id, p.user_id
       FROM payment_transactions pt
       JOIN payments p ON p.id = pt.payment_id
       WHERE pt.payment_id = $1
         -- Both spellings: payment_transactions copies whatever the basket
         -- wrote, and rows exist under each convention. See itemTypeOf in
         -- fulfilment.service for how that came about.
         AND pt.item_type IN ('booking', 'event_entry', 'event-entry')
         AND pt.fulfilled_at IS NULL`,
      [paymentId]
    );

    for (const line of lines.rows) {
      const reason =
        line.item_type === 'booking'
          ? await this.bookingReason(line)
          : await this.entryReason(line);

      if (reason) {
        logger.info('An order is no longer available at capture time', {
          paymentId,
          itemType: line.item_type,
          reason,
        });
        return { available: false, reason };
      }
    }

    return { available: true, reason: null };
  }

  /** Null when the slot is still gettable; otherwise why not. */
  private async bookingReason(line: any): Promise<string | null> {
    const ref = parseContextRef(line.context_ref) as Record<string, any>;
    const { calendarId, date, startTime, duration, places } = ref;

    if (!calendarId || !date || !startTime || !duration) {
      // Malformed rather than unavailable. Fulfilment fails this line with its
      // own message; reversing the whole payment over it would be wrong.
      return null;
    }

    try {
      await accountCatalogueService.assertSlotAvailable(
        line.organisation_id,
        String(calendarId),
        String(date),
        String(startTime),
        Number(duration),
        Number(places ?? 1),
        new Date(),
        line.user_id,
        true
      );
      return null;
    } catch (error) {
      return `${line.description}: ${(error as Error).message}`;
    }
  }

  /** Null when there is still room; otherwise why not. */
  private async entryReason(line: any): Promise<string | null> {
    const ref = parseContextRef(line.context_ref) as Record<string, any>;
    const activityId = ref.activityId;

    if (!activityId) return null;

    const found = await accountCatalogueService.findActivity(
      line.organisation_id,
      line.user_id,
      String(activityId),
      new Date(),
      { excludeOwnHolds: true }
    );

    if (!found) {
      return `${line.description}: that activity is no longer available`;
    }

    const wanted = Number(line.quantity ?? 1);
    const remaining = found.activity.placesRemaining;

    /*
     * `placesRemaining` is null for an uncapped activity, which is the case
     * this check does not apply to — there is nothing to run out of.
     */
    if (remaining !== null && remaining < wanted) {
      return remaining === 0
        ? `${line.description}: that activity is now full`
        : `${line.description}: only ${remaining} place(s) are left`;
    }

    /*
     * The event's own window can have closed while the member was paying — a
     * closing date passing is not a race with another member, but it has the
     * same consequence for an entry that has not been created yet.
     */
    if (
      found.event.unavailableReason === 'entries-closed' ||
      found.event.unavailableReason === 'event-full'
    ) {
      return `${line.description}: entries have closed`;
    }

    return null;
  }
}

export const orderAvailabilityService = new OrderAvailabilityService();
