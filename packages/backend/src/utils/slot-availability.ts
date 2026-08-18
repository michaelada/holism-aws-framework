/**
 * Which slots on a calendar are actually bookable.
 *
 * **This is a deliberate second implementation.** The org-admin app computes
 * availability in the browser (`orgadmin-calendar/src/utils/slotAvailabilityCalculator.ts`)
 * because it draws a grid an administrator is looking at. A member's booking
 * cannot be decided that way: the browser is not trustworthy, and the answer to
 * "may I book 09:00 on Saturday" has to be the same one the cart enforces. So
 * the rules live here too, in a pure function, and both are tested against the
 * same cases.
 *
 * They must agree. The rules, in the order they apply:
 *
 *  1. **Generate** every slot a time-slot configuration produces — for each day
 *     of the week it names, within its effective dates, on its recurrence, one
 *     series per duration option stepping by that duration from the start time.
 *  2. **Block** — remove slots inside a blocked period, whether a date range
 *     (maintenance week) or a recurring time segment (closed before 08:00).
 *  3. **Window** — a club takes bookings between `minDaysInAdvance` and
 *     `maxDaysInAdvance` from today, and no further.
 *  4. **Occupy** — subtract confirmed bookings. An *exact* booking (same start,
 *     same duration) consumes a place; an *overlapping* one of a different
 *     length takes the slot out entirely, because the resource is in use.
 *  5. **Hold** — a live reservation does the same, including over slots it
 *     merely overlaps.
 *
 * Times are minutes since midnight throughout: string comparison of "09:00"
 * against "9:00" is the bug this avoids, and arithmetic on Date objects across
 * a daylight-saving boundary is the one after that.
 */

export interface DurationOption {
  duration: number;
  price: number;
  label?: string | null;
}

export interface SlotConfiguration {
  daysOfWeek: number[];
  startTime: string;
  effectiveDateStart: string | null;
  effectiveDateEnd: string | null;
  recurrenceWeeks: number | null;
  placesAvailable: number | null;
  minPlacesRequired: number | null;
  durationOptions: DurationOption[];
}

export interface BlockedPeriod {
  blockType: string;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: number[] | null;
  startTime: string | null;
  endTime: string | null;
}

export interface ExistingBooking {
  bookingDate: string;
  startTime: string;
  duration: number;
  placesBooked: number;
  bookingStatus: string;
}

export interface ExistingReservation {
  slotDate: string;
  startTime: string;
  duration: number;
}

/**
 * A live soft hold — a slot sitting in somebody's basket.
 *
 * Distinct from {@link ExistingReservation}, which is a club official blocking
 * the court for a reason of their own. A hold belongs to a member, lapses by
 * itself, and is worded differently to the person who owns it: "in your basket"
 * rather than "held by someone else".
 *
 * Only holds that have not yet lapsed should be passed in; the calculator does
 * not know what time it is relative to a hold's expiry.
 */
export interface ExistingHold {
  slotDate: string;
  startTime: string;
  duration: number;
  /** Places the hold takes; a hold on a multi-place slot need not take it all. */
  places: number;
  /** True when this hold belongs to the member the calendar is being drawn for. */
  heldByViewer: boolean;
  /**
   * Whether the hold is still in force.
   *
   * A lapsed hold reserves nothing — the slot is genuinely back on sale — but
   * the **viewer's own** lapsed line is still sitting in their basket, and the
   * screen has to say so. A member whose hold has run out was being shown their
   * own slot as free, invited to add it again, and then refused with "that slot
   * is already in your basket".
   *
   * So a lapsed hold takes no places and blocks nobody, and is passed in only
   * for the viewer's own lines, purely to mark them as theirs.
   */
  live: boolean;
  /** ISO instant the hold lapses, so the holder can be shown a countdown. */
  expiresAt: string;
}

export interface AvailableSlot {
  /** `YYYY-MM-DD`, the club's local date. */
  date: string;
  /** `HH:MM`. */
  startTime: string;
  endTime: string;
  /** Minutes. */
  duration: number;
  /** Minor units, from the duration option. */
  price: number;
  placesAvailable: number;
  placesBooked: number;
  placesRemaining: number;
  available: boolean;
  /**
   * Why the slot cannot be taken.
   *
   * `held` covers both a club official's block and another member's basket —
   * from the outside they are the same thing, "somebody has this right now".
   * `in-your-basket` is the viewer's own hold, which is worth saying plainly:
   * otherwise a member sees the slot they just chose greyed out and reads it as
   * having lost it.
   */
  unavailableReason:
    | 'full'
    | 'in-use'
    | 'held'
    | 'in-your-basket'
    /**
     * A *different* slot that overlaps one the member already has.
     *
     * A calendar offering several lengths from the same start — a three-hour
     * morning and a four-hour extended morning — produces overlapping slots by
     * design. Taking both is booking the same session twice, so it is refused;
     * but it is not the slot in the basket, and saying "that slot is already in
     * your basket" about a row the member can see is plainly untrue.
     */
    | 'clashes-with-basket'
    | null;
  /**
   * When the viewer's own hold lapses; ISO, and null unless they hold it.
   *
   * Never set from somebody else's hold — how long a stranger has left is not
   * the viewer's business, and showing it invites people to sit and wait.
   */
  heldUntil: string | null;
}

const MINUTES_IN_DAY = 24 * 60;

/** "09:30", "09:30:00" and Postgres `time` values all mean the same thing. */
const toMinutes = (time: string): number => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const toTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60) % 24;
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

/** `YYYY-MM-DD` from anything the driver might hand back. */
export const toDateKey = (value: unknown): string => {
  if (value instanceof Date) {
    // Local parts, not toISOString: a date-only value read as UTC and printed
    // in a negative offset comes back a day early.
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate()
    ).padStart(2, '0')}`;
  }
  return String(value ?? '').slice(0, 10);
};

const fromDateKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

/** The Sunday that starts this date's week, for recurrence arithmetic. */
const weekStart = (date: Date): Date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const weeksBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000));

const isBlocked = (dateKey: string, startMinutes: number, periods: BlockedPeriod[]): boolean => {
  const date = fromDateKey(dateKey);

  return periods.some((period) => {
    if (period.blockType === 'date_range') {
      if (!period.startDate || !period.endDate) return false;
      return dateKey >= toDateKey(period.startDate) && dateKey <= toDateKey(period.endDate);
    }

    if (period.blockType === 'time_segment') {
      if (!period.daysOfWeek?.includes(date.getDay())) return false;
      if (!period.startTime || !period.endTime) return false;

      const blockStart = toMinutes(period.startTime);
      const blockEnd = toMinutes(period.endTime);

      // An end at or before the start wraps past midnight: 18:00 → 00:00 means
      // "from six in the evening", not "no time at all".
      return blockEnd <= blockStart
        ? startMinutes >= blockStart || startMinutes < blockEnd
        : startMinutes >= blockStart && startMinutes < blockEnd;
    }

    return false;
  });
};

/**
 * Every slot a member could book between two dates, with what is left of each.
 *
 * `from` and `to` are `YYYY-MM-DD` and inclusive. The booking window is applied
 * relative to `today`, which is passed in rather than read from the clock so
 * the result is testable against a fixed set of rows.
 */
export function calculateAvailableSlots(options: {
  configurations: SlotConfiguration[];
  blockedPeriods: BlockedPeriod[];
  bookings: ExistingBooking[];
  reservations: ExistingReservation[];
  /** Live basket holds. Optional: a caller with no notion of holds passes none. */
  holds?: ExistingHold[];
  from: string;
  to: string;
  minDaysInAdvance: number;
  maxDaysInAdvance: number;
  today?: Date;
}): AvailableSlot[] {
  const {
    configurations,
    blockedPeriods,
    bookings,
    reservations,
    from,
    to,
    minDaysInAdvance,
    maxDaysInAdvance,
  } = options;

  const today = options.today ?? new Date();
  const earliest = new Date(today);
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() + minDaysInAdvance);
  const latest = new Date(today);
  latest.setHours(23, 59, 59, 999);
  latest.setDate(latest.getDate() + maxDaysInAdvance);

  const confirmed = bookings
    .filter((booking) => booking.bookingStatus === 'confirmed')
    .map((booking) => ({
      dateKey: toDateKey(booking.bookingDate),
      start: toMinutes(booking.startTime),
      end: toMinutes(booking.startTime) + booking.duration,
      duration: booking.duration,
      places: booking.placesBooked ?? 1,
    }));

  const held = reservations.map((reservation) => ({
    dateKey: toDateKey(reservation.slotDate),
    start: toMinutes(reservation.startTime),
    end: toMinutes(reservation.startTime) + reservation.duration,
  }));

  const holding = (options.holds ?? []).map((hold) => ({
    dateKey: toDateKey(hold.slotDate),
    start: toMinutes(hold.startTime),
    end: toMinutes(hold.startTime) + hold.duration,
    duration: hold.duration,
    places: hold.places > 0 ? hold.places : 1,
    mine: hold.heldByViewer,
    // Absent means in force, so a caller that predates the distinction keeps
    // the old behaviour rather than silently freeing every slot.
    live: hold.live !== false,
    expiresAt: hold.expiresAt,
  }));

  const slots = new Map<string, AvailableSlot>();

  for (const config of configurations) {
    const durations =
      config.durationOptions.length > 0
        ? config.durationOptions
        : // A configuration with no durations still offers something: an hour.
          [{ duration: 60, price: 0 }];

    const recurrence = config.recurrenceWeeks && config.recurrenceWeeks > 0 ? config.recurrenceWeeks : 1;
    const effectiveStart = config.effectiveDateStart ? toDateKey(config.effectiveDateStart) : null;
    const effectiveEnd = config.effectiveDateEnd ? toDateKey(config.effectiveDateEnd) : null;
    const reference = weekStart(effectiveStart ? fromDateKey(effectiveStart) : fromDateKey(from));
    const placesAvailable = config.placesAvailable && config.placesAvailable > 0 ? config.placesAvailable : 1;
    const configStart = toMinutes(config.startTime);

    for (
      const day = fromDateKey(from);
      toDateKey(day) <= to;
      day.setDate(day.getDate() + 1)
    ) {
      const dateKey = toDateKey(day);

      if (!config.daysOfWeek.includes(day.getDay())) continue;
      if (effectiveStart && dateKey < effectiveStart) continue;
      if (effectiveEnd && dateKey > effectiveEnd) continue;
      if (recurrence > 1 && weeksBetween(reference, weekStart(day)) % recurrence !== 0) continue;

      const withinWindow = day >= earliest && day <= latest;

      for (const option of durations) {
        for (
          let start = configStart;
          start + option.duration <= MINUTES_IN_DAY;
          start += option.duration
        ) {
          if (isBlocked(dateKey, start, blockedPeriods)) continue;
          // A day outside the club's booking window produces nothing at all,
          // rather than a row the member can see and not have.
          if (!withinWindow) continue;

          const end = start + option.duration;
          const key = `${dateKey}|${start}|${option.duration}`;
          if (slots.has(key)) continue;

          const exact = confirmed.filter(
            (booking) =>
              booking.dateKey === dateKey &&
              booking.start === start &&
              booking.duration === option.duration
          );
          const placesBooked = exact.reduce((total, booking) => total + booking.places, 0);
          const placesRemaining = placesAvailable - placesBooked;

          /*
           * A booking of a different length across this time takes the slot
           * out entirely: the court is in use, whatever the shape of the
           * booking that is using it.
           */
          const inUse = confirmed.some(
            (booking) =>
              booking.dateKey === dateKey &&
              booking.start < end &&
              booking.end > start &&
              !(booking.start === start && booking.duration === option.duration)
          );

          const onHold = held.some(
            (reservation) =>
              reservation.dateKey === dateKey &&
              reservation.start < end &&
              reservation.end > start
          );

          /*
           * Basket holds are counted exactly as bookings are, because that is
           * what they are on their way to becoming: a hold of this same shape
           * takes places, and a hold of a different shape across this time
           * takes the court out entirely.
           */
          const exactHolds = holding.filter(
            (hold) =>
              hold.dateKey === dateKey &&
              hold.start === start &&
              hold.duration === option.duration
          );
          const overlappingHolds = holding.filter(
            (hold) =>
              hold.dateKey === dateKey &&
              hold.start < end &&
              hold.end > start &&
              !(hold.start === start && hold.duration === option.duration)
          );

          /*
           * Only a **live** hold takes places or blocks the time. A lapsed one
           * reserves nothing: the slot really is back on sale, and pretending
           * otherwise would keep it out of everybody's reach for ever.
           */
          const placesHeld = exactHolds
            .filter((hold) => hold.live)
            .reduce((total, hold) => total + hold.places, 0);
          const remaining = placesRemaining - placesHeld;
          const liveOverlaps = overlappingHolds.filter((hold) => hold.live);
          const heldOut = liveOverlaps.length > 0 || (placesHeld > 0 && remaining <= 0);

          /*
           * The viewer's own lines count whether or not the hold still stands.
           *
           * It is in their basket until they remove it or check out, and they
           * cannot add it twice — the basket guard refuses regardless of the
           * clock. Showing it as free was an invitation followed by "that slot
           * is already in your basket", which is the screen contradicting
           * itself.
           *
           * **This slot** and **a slot that overlaps it** are kept apart. A
           * calendar with several duration options from one start time produces
           * overlapping rows by design, and telling a member that the four-hour
           * session is "already in your basket" when the three-hour one is,
           * is a statement they can see is false.
           */
          const mineExactly = exactHolds.some((hold) => hold.mine);
          const mineOverlapping = overlappingHolds.some((hold) => hold.mine);

          /*
           * The viewer's own line outranks a stranger's hold when both exist:
           * being told the slot is in your basket is actionable, being told
           * somebody has it is not, and they cannot add it twice either way.
           */
          const reason = onHold
            ? 'held'
            : inUse
              ? 'in-use'
              : mineExactly
                ? 'in-your-basket'
                : mineOverlapping
                  ? 'clashes-with-basket'
                  : heldOut
                    ? 'held'
                    : remaining <= 0
                      ? 'full'
                      : null;

          slots.set(key, {
            date: dateKey,
            startTime: toTime(start),
            endTime: toTime(end),
            duration: option.duration,
            price: option.price,
            placesAvailable,
            placesBooked,
            placesRemaining: Math.max(0, remaining),
            available: reason === null,
            unavailableReason: reason,
            // The longest of the viewer's own holds: with two, the slot is
            // theirs until the later one goes.
            /*
             * Only for the slot the member actually holds. A clashing row is
             * not theirs and has no countdown of its own — showing one would
             * imply it frees up when the clock runs out, which is not what it
             * is waiting on.
             */
            heldUntil: mineExactly
              ? exactHolds
                  .filter((hold) => hold.mine)
                  .map((hold) => hold.expiresAt)
                  .sort()
                  .slice(-1)[0]
              : null,
          });
        }
      }
    }
  }

  return [...slots.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      toMinutes(a.startTime) - toMinutes(b.startTime) ||
      a.duration - b.duration
  );
}
