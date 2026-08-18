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
 * Three minutes is the default; a club may set its own (see
 * {@link holdWindowsFrom}). It is deliberately tight because this is the
 * *pre-checkout* window — the moment a member commits to paying,
 * {@link CHECKOUT_HOLD_MINUTES} takes over.
 */
export const BASKET_HOLD_MINUTES = 3;

/**
 * The payment hold: from starting checkout until the attempt is resolved.
 *
 * Two minutes is nowhere near enough to get through a card form, a bank's 3-D
 * Secure step and a redirect back. If the hold lapsed mid-payment somebody else
 * could take the slot while the member was typing, and the member would pay for
 * something fulfilment then refuses to give them. Starting checkout therefore
 * extends every hold on the cart to this longer window.
 *
 * Fifteen minutes is the default — chosen to outlast a slow 3-D Secure round
 * trip without stranding the slot for the rest of the afternoon when somebody
 * abandons the payment page. A club may set its own.
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


/** How long one organisation holds things for, in minutes. */
export interface HoldWindows {
  basketMinutes: number;
  checkoutMinutes: number;
}

export const DEFAULT_HOLD_WINDOWS: HoldWindows = {
  basketMinutes: BASKET_HOLD_MINUTES,
  checkoutMinutes: CHECKOUT_HOLD_MINUTES,
};

/**
 * The bounds a club may set a window within.
 *
 * A basket hold under a minute expires while the member is still reading the
 * confirmation; one over an hour is a slot taken out of circulation by somebody
 * who has wandered off. The payment window has to outlast a 3-D Secure round
 * trip at the bottom, and a card session at the top.
 *
 * Enforced when the value is *read* as well as when it is written: a number
 * that reached the column another way still has to produce a sane hold.
 */
export const HOLD_LIMITS = {
  basketMinutes: { min: 1, max: 60 },
  checkoutMinutes: { min: 5, max: 180 },
} as const;

const clamp = (value: number, { min, max }: { min: number; max: number }): number =>
  Math.min(max, Math.max(min, Math.round(value)));

/**
 * One club's hold windows, read from `organizations.settings.holds`.
 *
 * Anything missing, unparseable or out of range falls back to the default
 * rather than throwing: a mistyped setting must not stop a member adding
 * something to their basket, and a hold of the wrong length is a far smaller
 * fault than a checkout that refuses.
 */
export function holdWindowsFrom(settings: unknown): HoldWindows {
  const holds = (settings as { holds?: Record<string, unknown> } | null)?.holds;
  if (!holds || typeof holds !== 'object') return { ...DEFAULT_HOLD_WINDOWS };

  const read = (key: keyof HoldWindows): number => {
    const raw = Number(holds[key]);
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_HOLD_WINDOWS[key];
    return clamp(raw, HOLD_LIMITS[key]);
  };

  return {
    basketMinutes: read('basketMinutes'),
    checkoutMinutes: read('checkoutMinutes'),
  };
}

/**
 * Whether a club's proposed windows are acceptable, and why not.
 *
 * Returns a message rather than clamping, because an administrator who typed
 * 500 should be told the limit rather than silently given 180.
 */
export function holdWindowsError(input: Partial<HoldWindows>): string | null {
  for (const key of ['basketMinutes', 'checkoutMinutes'] as const) {
    const value = input[key];
    if (value === undefined || value === null) continue;

    const { min, max } = HOLD_LIMITS[key];
    if (!Number.isFinite(Number(value)) || !Number.isInteger(Number(value))) {
      return `${key} must be a whole number of minutes`;
    }
    if (Number(value) < min || Number(value) > max) {
      return `${key} must be between ${min} and ${max} minutes`;
    }
  }

  return null;
}
