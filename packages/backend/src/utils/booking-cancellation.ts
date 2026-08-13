/**
 * Whether a member may cancel their own booking, and what happens to the money.
 *
 * **A second implementation, like slot availability.** The org-admin app checks
 * the same policy in the browser (`orgadmin-calendar/src/utils/cancellationValidator.ts`)
 * to decide whether to enable a dialog for an administrator. A member cancelling
 * their own booking cannot be decided that way — the endpoint has to enforce it
 * — so the rules live here too, and both are tested against the same cases.
 *
 * The club's policy is three settings on the calendar:
 *
 *  - `allow_cancellations` — whether a member may cancel at all.
 *  - `cancel_days_in_advance` — how much notice. Zero means "up to the day".
 *  - `refund_payment_automatically` — whether the club refunds what was paid.
 *
 * **Money is not moved here.** Cancelling records the cancellation and reports
 * whether a refund is due; the refund itself stays an act of the club, through
 * the org-admin payments screens. A member-initiated action that silently
 * returned money would be a real transfer decided by a policy flag nobody
 * checked at the time.
 */

export interface CancellableBooking {
  bookingStatus: string | null;
  paymentStatus: string | null;
  /** `YYYY-MM-DD` or a Date — the day the booking is for. */
  bookingDate: string | Date;
  refundProcessed?: boolean | null;
}

export interface CancellationPolicy {
  allowCancellations: boolean | null;
  cancelDaysInAdvance: number | null;
  refundPaymentAutomatically?: boolean | null;
}

export type CancellationRefusal =
  | 'not-allowed'
  | 'already-cancelled'
  | 'too-late'
  | 'already-passed';

export interface CancellationDecision {
  canCancel: boolean;
  /** Why not, for a screen that must explain a button it is not showing. */
  reason: CancellationRefusal | null;
  /** The notice the club asks for, so the screen can name it. */
  noticeDays: number;
  /** Whole days from today to the booking; negative once it has passed. */
  daysUntil: number;
  /** Whether the club's policy means the member should expect their money back. */
  refundExpected: boolean;
}

/** Midnight local, so a comparison is between days rather than moments. */
const startOfDay = (value: string | Date): Date => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export function decideCancellation(
  booking: CancellableBooking,
  policy: CancellationPolicy,
  today: Date = new Date()
): CancellationDecision {
  const noticeDays = policy.cancelDaysInAdvance ?? 0;
  const midnightToday = startOfDay(today);
  const daysUntil = Math.round(
    (startOfDay(booking.bookingDate).getTime() - midnightToday.getTime()) / 86_400_000
  );

  /*
   * A refund is due when the club said it would refund and there is something
   * to refund. Computed even when the booking cannot be cancelled, because the
   * screen uses it to say what *would* happen — and nothing here moves money.
   */
  const refundExpected = Boolean(
    policy.refundPaymentAutomatically &&
      booking.paymentStatus === 'paid' &&
      !booking.refundProcessed
  );

  const refuse = (reason: CancellationRefusal): CancellationDecision => ({
    canCancel: false,
    reason,
    noticeDays,
    daysUntil,
    refundExpected,
  });

  if (booking.bookingStatus === 'cancelled') return refuse('already-cancelled');
  if (!policy.allowCancellations) return refuse('not-allowed');

  /*
   * A booking in the past is refused as *passed* rather than as *too late*,
   * even though both are about time. "Cancellations need two days' notice" is
   * an odd thing to read about last Tuesday.
   */
  if (daysUntil < 0) return refuse('already-passed');
  if (daysUntil < noticeDays) return refuse('too-late');

  return { canCancel: true, reason: null, noticeDays, daysUntil, refundExpected };
}
