/**
 * What to tell a member about an event's entry window and its capacity.
 *
 * Pure and separate from the card that renders it, because these are rules
 * rather than presentation: "opening soon" and "closing soon" are judgements
 * about how much notice somebody needs, and they are easier to argue about — and
 * to test — when they are not tangled up in MUI.
 *
 * **Availability itself stays on the server.** `unavailableReason` is computed
 * in `account-catalogue.service` (G8), and this module never contradicts it: it
 * decides *how to phrase* a window, and only adds urgency where the server has
 * already said the event is enterable.
 */

/** Enough notice to plan around, and short enough that "soon" still means soon. */
export const OPENING_SOON_DAYS = 14;

/**
 * Shorter than the opening window on purpose. Missing an opening is an
 * inconvenience — you enter later. Missing a closing means not entering at all,
 * so the warning should be loud when it is genuinely close rather than for a
 * fortnight, by which point it is background noise.
 */
export const CLOSING_SOON_DAYS = 7;

export type EntryWindowState =
  | 'not-open'
  | 'opening-soon'
  | 'open'
  | 'closing-soon'
  | 'closed';

export interface EntryWindow {
  state: EntryWindowState;
  /** Whole days until the event opens or closes; null when there is no date. */
  days: number | null;
  /** The date the message refers to, for formatting by the caller. */
  date: string | null;
}

/** Whole days between two instants, counting from the start of each day. */
export function daysBetween(from: Date, to: Date): number {
  const startOfFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const startOfTo = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((startOfTo.getTime() - startOfFrom.getTime()) / 86_400_000);
}

export interface EntryWindowInput {
  entriesOpenDate: string | null;
  entriesClosingDate: string | null;
}

/**
 * Where in its entry window this event currently sits.
 *
 * Order matters, and matches the server's: not-open beats closed beats open.
 * An event whose window has not started is "not open yet" even if its closing
 * date has also passed — a misconfigured pair of dates should read as the
 * earlier problem, not as a slammed door.
 */
export function entryWindowFor(
  event: EntryWindowInput,
  now: Date = new Date()
): EntryWindow {
  const open = event.entriesOpenDate ? new Date(event.entriesOpenDate) : null;
  const close = event.entriesClosingDate ? new Date(event.entriesClosingDate) : null;

  const validOpen = open && !Number.isNaN(open.getTime()) ? open : null;
  const validClose = close && !Number.isNaN(close.getTime()) ? close : null;

  if (validOpen && validOpen > now) {
    const days = daysBetween(now, validOpen);
    return {
      state: days <= OPENING_SOON_DAYS ? 'opening-soon' : 'not-open',
      days,
      date: event.entriesOpenDate,
    };
  }

  if (validClose && validClose < now) {
    return { state: 'closed', days: daysBetween(validClose, now), date: event.entriesClosingDate };
  }

  if (validClose) {
    const days = daysBetween(now, validClose);
    return {
      state: days <= CLOSING_SOON_DAYS ? 'closing-soon' : 'open',
      days,
      date: event.entriesClosingDate,
    };
  }

  return { state: 'open', days: null, date: null };
}

export type CapacityState = 'uncapped' | 'available' | 'full';

export interface Capacity {
  state: CapacityState;
  limit: number | null;
  remaining: number | null;
}

/**
 * How many places are left, at whichever level is capped.
 *
 * An event and an activity can each carry their own limit. When both do, the
 * **tighter** one governs: a class with two places left inside an event with
 * twenty is a two-place class, and quoting the twenty would be a promise the
 * next screen breaks.
 */
export function capacityFor(
  event: { entriesLimit: number | null; placesRemaining: number | null },
  activity?: { entriesLimit?: number | null; placesRemaining: number | null } | null
): Capacity {
  const candidates: Array<{ limit: number | null; remaining: number }> = [];

  if (event.placesRemaining !== null && event.placesRemaining !== undefined) {
    candidates.push({ limit: event.entriesLimit, remaining: event.placesRemaining });
  }
  if (activity?.placesRemaining !== null && activity?.placesRemaining !== undefined) {
    candidates.push({ limit: activity.entriesLimit ?? null, remaining: activity.placesRemaining });
  }

  if (candidates.length === 0) {
    return { state: 'uncapped', limit: null, remaining: null };
  }

  const tightest = candidates.reduce((a, b) => (b.remaining < a.remaining ? b : a));

  return {
    state: tightest.remaining <= 0 ? 'full' : 'available',
    limit: tightest.limit,
    remaining: tightest.remaining,
  };
}
