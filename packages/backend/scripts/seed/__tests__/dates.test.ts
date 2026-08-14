import {
  RENEWAL_WINDOW_DAYS,
  SEASON_ROLLOVER_DAYS,
  birthDateForAge,
  currentSeasonYear,
  dateOnly,
  membershipEnd,
  seasonEnd,
} from '../dates';

/**
 * The seed's dates, run against a calendar that has not happened yet.
 *
 * The whole point of expressing them as offsets is that the fixture still
 * reaches the same states a year from now, and that is exactly the claim a
 * suite run today cannot make by accident. Every case here picks a `now` and
 * asserts the relationship, never the literal date.
 */
describe('seed dates', () => {
  /** Local midnight, so the assertions do not depend on the runner's timezone. */
  const at = (year: number, month: number, day: number) => new Date(year, month - 1, day);

  const daysBetween = (from: string, to: string) =>
    Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000
    );

  describe('dateOnly', () => {
    it('counts forward and back from the day it is given', () => {
      const now = at(2026, 8, 14);

      expect(dateOnly(0, now)).toBe('2026-08-14');
      expect(dateOnly(7, now)).toBe('2026-08-21');
      expect(dateOnly(-14, now)).toBe('2026-07-31');
    });

    it('crosses a year boundary', () => {
      expect(dateOnly(20, at(2026, 12, 25))).toBe('2027-01-14');
      expect(dateOnly(-30, at(2027, 1, 10))).toBe('2026-12-11');
    });

    it('handles a leap day', () => {
      expect(dateOnly(1, at(2028, 2, 28))).toBe('2028-02-29');
    });

    it('does not slip a day when run just after midnight', () => {
      // `toISOString` converts to UTC first, which in a zone ahead of UTC dates
      // the small hours to the previous day.
      const justAfterMidnight = new Date(2026, 7, 14, 0, 30);

      expect(dateOnly(0, justAfterMidnight)).toBe('2026-08-14');
    });

    it('does not slip a day when run late in the evening', () => {
      const lateEvening = new Date(2026, 7, 14, 23, 30);

      expect(dateOnly(0, lateEvening)).toBe('2026-08-14');
    });
  });

  describe('currentSeasonYear', () => {
    it('is the year it is run in, for most of the year', () => {
      expect(currentSeasonYear(at(2026, 1, 5))).toBe(2026);
      expect(currentSeasonYear(at(2026, 8, 14))).toBe(2026);
      expect(currentSeasonYear(at(2026, 10, 1))).toBe(2026);
    });

    it('rolls on to the next season once this one is nearly over', () => {
      // Run in December and every "current" membership would otherwise expire
      // within days, so the whole cohort would read as due for renewal.
      expect(currentSeasonYear(at(2026, 12, 1))).toBe(2027);
      expect(currentSeasonYear(at(2026, 12, 31))).toBe(2027);
    });

    it('rolls exactly at the threshold, not a day either side', () => {
      const lastDayBefore = at(2026, 12, 31 - SEASON_ROLLOVER_DAYS);
      const firstDayAfter = at(2026, 12, 31 - SEASON_ROLLOVER_DAYS + 1);

      expect(currentSeasonYear(lastDayBefore)).toBe(2026);
      expect(currentSeasonYear(firstDayAfter)).toBe(2027);
    });
  });

  describe('membershipEnd', () => {
    /*
     * The states the seed exists to produce. Asserted as relationships to the
     * run date, because that is what has to survive the calendar moving on.
     */
    const runDates = [
      ['midsummer', at(2026, 6, 1)],
      ['late in the season', at(2026, 11, 20)],
      ['past the rollover', at(2026, 12, 20)],
      ['the first week of a season', at(2027, 1, 3)],
      ['a leap year', at(2028, 2, 29)],
    ] as const;

    it.each(runDates)('leaves a current membership well clear of renewal when run %s', (_label, now) => {
      const days = daysBetween(dateOnly(0, now), membershipEnd('current', now));

      expect(days).toBeGreaterThan(RENEWAL_WINDOW_DAYS);
    });

    it.each(runDates)('puts an expiring membership inside the renewal window when run %s', (_label, now) => {
      const days = daysBetween(dateOnly(0, now), membershipEnd('expiring', now));

      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThanOrEqual(RENEWAL_WINDOW_DAYS);
    });

    it.each(runDates)('leaves a previous membership already lapsed when run %s', (_label, now) => {
      const days = daysBetween(dateOnly(0, now), membershipEnd('previous', now));

      expect(days).toBeLessThan(0);
    });

    it('keeps the three seasons distinct and in order', () => {
      const now = at(2026, 8, 14);

      expect(membershipEnd('previous', now) < dateOnly(0, now)).toBe(true);
      expect(membershipEnd('expiring', now) < membershipEnd('current', now)).toBe(true);
    });
  });

  describe('seasonEnd', () => {
    it('ends a season on the last day of its year', () => {
      expect(seasonEnd(0, at(2026, 8, 14))).toBe('2026-12-31');
      expect(seasonEnd(-1, at(2026, 8, 14))).toBe('2025-12-31');
    });
  });

  describe('birthDateForAge', () => {
    it('produces someone of that age whenever it is run', () => {
      for (const now of [at(2026, 8, 14), at(2031, 5, 2)]) {
        const dob = birthDateForAge(13, now);

        // A junior stays a junior; a fixed birth year would not.
        expect(now.getFullYear() - Number(dob.slice(0, 4))).toBe(13);
      }
    });
  });
});
