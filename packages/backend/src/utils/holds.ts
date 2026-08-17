/**
 * Soft holds — how long a member keeps a thing they have put in their basket.
 *
 * A court, an arena and a capped event entry are all things two people want at
 * once. Until now the basket recorded an intention and nothing more: two
 * members could add the same Saturday arena slot, both reach checkout, and the
 * loser found out only after paying, when fulfilment re-checked availability
 * and failed their line. That is a refund the club has to process and a member
 * who has every reason to be annoyed.
 *
 * A hold closes that window. Adding a limited thing to a basket takes it out of
 * everybody else's catalogue for a short time, and the hold lapses on its own
 * rather than needing anything to clean up after it — an expiry stamp on the
 * basket line, compared against `NOW()` wherever availability is worked out.
 * Nothing has to run on a timer, and a crashed process leaves no debris.
 *
 * **Holds are advisory, not a lock.** They stop the ordinary race, not a
 * determined one. The authority on whether a slot was actually got is still
 * `fulfilment.service`, which re-checks at the moment it creates the booking.
 */

/**
 * The browsing hold: long enough to finish choosing, short enough that a member
 * who wandered off does not keep a Saturday slot out of circulation.
 *
 * Two minutes is the club-facing number the product asked for. It is
 * deliberately tight because this is the *pre-checkout* window — the moment a
 * member commits to paying, {@link CHECKOUT_HOLD_MINUTES} takes over.
 */
export const BASKET_HOLD_MINUTES = 2;

/**
 * The payment hold: from starting checkout until the attempt is resolved.
 *
 * Two minutes is nowhere near enough to get through a card form, a bank's 3-D
 * Secure step and a redirect back. If the hold lapsed mid-payment somebody else
 * could take the slot while the member was typing, and the member would pay for
 * something fulfilment then refuses to give them. Starting checkout therefore
 * extends every hold on the cart to this longer window.
 *
 * Fifteen minutes is chosen to outlast a slow 3-D Secure round trip without
 * stranding the slot for the rest of the afternoon when somebody abandons the
 * payment page.
 */
export const CHECKOUT_HOLD_MINUTES = 15;

/**
 * The kinds of basket line that take a hold.
 *
 * Only things with a real limit. A membership or a t-shirt is not contended in
 * the same way — stock is checked at fulfilment and there is no slot for a
 * second member to lose. Holding those would mean expiring baskets for no
 * benefit, and an expired line drops out of the basket total.
 *
 * `event_entry` is conditional even here: an entry takes a hold only when the
 * event or the activity actually caps entries. An uncapped activity has nothing
 * to contend over. See `holdRequiredForEntry` in the account routes.
 */
export const HOLDABLE_ITEM_TYPES = ['booking', 'event_entry'] as const;

export type HoldableItemType = (typeof HOLDABLE_ITEM_TYPES)[number];

export const isHoldableItemType = (value: unknown): value is HoldableItemType =>
  typeof value === 'string' && (HOLDABLE_ITEM_TYPES as readonly string[]).includes(value);

/** The instant a hold taken now should lapse. */
export const holdExpiry = (minutes: number, from: Date = new Date()): Date =>
  new Date(from.getTime() + minutes * 60_000);

/** Whether a stored expiry is still in force at `now`. */
export const isHoldLive = (expiresAt: Date | string | null | undefined, now: Date = new Date()): boolean => {
  if (!expiresAt) return false;
  const at = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return !Number.isNaN(at.getTime()) && at.getTime() > now.getTime();
};
