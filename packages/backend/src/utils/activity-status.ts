/**
 * The status vocabulary the account application shows for a member's own
 * activity — entries, bookings and memberships alike (C1/C2/C4/C6/C8).
 *
 * There are four words and they are shared deliberately. A member looking at a
 * list of entries and a list of bookings should not have to learn two
 * vocabularies for the same four situations, so the derivation lives here once
 * rather than in each query.
 *
 * This is separate from the *payment* status stored on the row. `paid` and
 * `pending` describe money; these describe what the member can expect. A
 * confirmed entry to an event that has already happened is `completed`, and no
 * payment column says so.
 */
export type ActivityStatus =
  /** Checked out against an offline method the club has not yet recorded. */
  | 'awaiting-payment'
  /** Paid for (or free) and still ahead. */
  | 'confirmed'
  /** In the past. */
  | 'completed'
  /** Withdrawn or refused. */
  | 'cancelled';

/** Payment states that mean the club is still waiting for money. */
const UNPAID = new Set(['pending', 'awaiting', 'awaiting_payment', 'unpaid', 'failed']);

export function isPaid(paymentStatus: string | null | undefined): boolean {
  if (!paymentStatus) return false;
  return !UNPAID.has(paymentStatus.toLowerCase());
}

/**
 * Whether `date` is strictly before the start of `today`.
 *
 * Compared at day granularity: an event finishing today is still today's
 * event, and calling it `completed` while a member is standing at it would be
 * wrong. Both sides are normalised to midnight so a timestamp column does not
 * make the comparison depend on the time of day the query ran.
 */
export function isPast(date: Date | string | null | undefined, today: Date): boolean {
  if (!date) return false;
  const value = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(value.getTime())) return false;

  value.setHours(0, 0, 0, 0);
  const midnight = new Date(today);
  midnight.setHours(0, 0, 0, 0);

  return value.getTime() < midnight.getTime();
}

export interface ActivityStatusInput {
  /** `booking_status` / `members.status`; absent for event entries, which have none. */
  recordStatus?: string | null;
  paymentStatus?: string | null;
  /** When the thing happens — event end, booking date, membership expiry. */
  occursOn?: Date | string | null;
}

/**
 * Derive the status a member is shown.
 *
 * Order matters and encodes the precedence the screens rely on:
 *
 * 1. **Cancelled wins over everything.** A cancelled booking for a past date is
 *    cancelled, not completed — the member did not attend, and saying they did
 *    misrepresents their own history back to them.
 * 2. **Past next.** Once something has happened, an unpaid balance is a debt to
 *    settle with the club, not a thing the member can still act on, so it reads
 *    as completed rather than inviting a payment that changes nothing.
 * 3. **Awaiting payment before confirmed**, because an unpaid future entry is
 *    precisely what a member needs to act on.
 */
export function deriveActivityStatus(
  input: ActivityStatusInput,
  today: Date = new Date()
): ActivityStatus {
  const record = input.recordStatus?.toLowerCase();

  if (record === 'cancelled' || record === 'rejected' || record === 'refused') {
    return 'cancelled';
  }

  if (isPast(input.occursOn, today)) {
    return 'completed';
  }

  if (!isPaid(input.paymentStatus)) {
    return 'awaiting-payment';
  }

  return 'confirmed';
}

/** How many days remain until `date`; negative once it has passed. */
export function daysUntil(date: Date | string | null | undefined, today: Date): number | null {
  if (!date) return null;
  const value = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(value.getTime())) return null;

  value.setHours(0, 0, 0, 0);
  const midnight = new Date(today);
  midnight.setHours(0, 0, 0, 0);

  return Math.round((value.getTime() - midnight.getTime()) / 86_400_000);
}

/** The window in which a membership is treated as due for renewal. */
export const RENEWAL_WINDOW_DAYS = 30;

/**
 * Whether a membership is inside its renewal window.
 *
 * This is only two thirds of the rule the screen applies. The third condition —
 * that a membership type actually exists for the following period — cannot be
 * answered from the membership row, and without it the button leads to a dead
 * end (C4). The service checks that separately.
 */
export function isDueForRenewal(
  membership: { status?: string | null; validUntil?: Date | string | null },
  today: Date = new Date()
): boolean {
  if (membership.status?.toLowerCase() !== 'active') return false;

  const remaining = daysUntil(membership.validUntil, today);
  if (remaining === null) return false;

  // A lapsed membership is still offered for renewal — a member who is a week
  // late should be able to rejoin rather than be told to start again.
  return remaining <= RENEWAL_WINDOW_DAYS;
}
