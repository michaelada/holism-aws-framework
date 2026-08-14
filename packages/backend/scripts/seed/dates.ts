/**
 * Every date the seed writes, expressed relative to the moment it runs.
 *
 * The seed exists to reach specific states — entries closing this week, a
 * membership due for renewal, a blocked week still ahead — and those are
 * *relationships to today*, not calendar dates. Written down as fixed dates
 * they hold for a fortnight and then quietly stop testing anything: entries all
 * closed, memberships all lapsed, the blocked week in the past.
 *
 * Kept apart from `database.ts` so the arithmetic can be tested against dates
 * the calendar has not reached yet. Every function takes an optional `now` for
 * that reason; the seed itself never passes one.
 */

/** Days from `now`, as a Date. Negative is the past. */
export const dayOffset = (days: number, now: Date = new Date()): Date => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Days from `now` as `YYYY-MM-DD`.
 *
 * Built from the local calendar rather than `toISOString`, which converts to
 * UTC first: at 23:00 in a zone ahead of UTC that shifts the answer to
 * tomorrow, and a seed run late in the evening would date everything a day out.
 */
export const dateOnly = (days: number, now: Date = new Date()): string => {
  const d = dayOffset(days, now);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

/** Days before a membership lapses that it counts as due for renewal. */
export const RENEWAL_WINDOW_DAYS = 30;

/**
 * How much of a season has to be left for it to still be worth seeding into.
 *
 * Comfortably more than the renewal window: the seed distinguishes memberships
 * that run on from ones deliberately made due for renewal, and that distinction
 * collapses if the whole cohort is inside the window.
 */
export const SEASON_ROLLOVER_DAYS = 60;

/**
 * The season the seed treats as current, as a year.
 *
 * A membership year is the calendar year, so ordinarily this is simply the year
 * the seed is run in. **Except near its end**: run this in December and every
 * "current" membership would expire within days, so every member would show as
 * due for renewal and the two or three meant to stand out would not. Past the
 * rollover point the seed moves on to the following season, which is what a
 * club would have done by then anyway.
 */
export const currentSeasonYear = (now: Date = new Date()): number => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const daysLeft = Math.round((yearEnd.getTime() - today.getTime()) / 86_400_000);

  return daysLeft >= SEASON_ROLLOVER_DAYS ? now.getFullYear() : now.getFullYear() + 1;
};

/**
 * The last day of a season, counted from the current one.
 */
export const seasonEnd = (seasonsFromNow: number, now: Date = new Date()): string =>
  `${currentSeasonYear(now) + seasonsFromNow}-12-31`;

/**
 * The last day of the most recent season that has actually finished.
 *
 * Not `seasonEnd(-1)`, which counts back from the *current* season — and once
 * the rollover has moved that forward, the season before it has not ended yet.
 * Run in December, `seasonEnd(-1)` lands on this month's 31st, and a member
 * meant to have lapsed last season would still be in date.
 */
export const lastCompletedSeasonEnd = (now: Date = new Date()): string =>
  `${now.getFullYear() - 1}-12-31`;

export type MembershipSeason = 'current' | 'expiring' | 'previous';

/**
 * When a membership runs out, by season.
 *
 * `expiring` is the one that needs computing rather than naming: it has to land
 * inside the renewal window whenever the seed happens to run, so it is set from
 * today rather than from the calendar. Half the window out puts it clearly
 * inside without being so close that a day's drift expires it.
 */
export const membershipEnd = (season: MembershipSeason, now: Date = new Date()): string => {
  switch (season) {
    case 'expiring':
      return dateOnly(Math.floor(RENEWAL_WINDOW_DAYS / 2), now);
    case 'previous':
      return lastCompletedSeasonEnd(now);
    default:
      return seasonEnd(0, now);
  }
};

/**
 * A birthday that makes somebody `age` today.
 *
 * An age rather than a birth year: a junior member born in a fixed year turns
 * into an adult a few seasons from now, and the seeded application form would
 * then contradict the membership type it sits under.
 */
export const birthDateForAge = (age: number, now: Date = new Date()): string =>
  `${now.getFullYear() - age}-04-18`;
