/**
 * `timestamp without time zone` must survive a round trip.
 *
 * Saving an event used to move its entry open/close times back by the server's
 * UTC offset, every single time it was saved. Nobody touched the field. The
 * cause was an asymmetry in the driver: a naive timestamp was *read* as local
 * time and *written* back as the UTC instant of that reading, so one round trip
 * lost one offset.
 *
 * These tests run in a fixed non-UTC zone on purpose. On a UTC server the bug
 * is invisible — which is exactly how it survived: the deployed containers run
 * UTC and local machines do not.
 */

// Europe/Dublin is UTC+1 in September, so a broken round trip shifts by an
// hour and a correct one does not move at all.
process.env.TZ = 'Europe/Dublin';

import { types as pgTypes } from 'pg';
import '../pool';

const TIMESTAMP_WITHOUT_TIME_ZONE = 1114;
const DATE = 1082;

/** What the driver hands a caller for a naive timestamp column. */
const readAsDriverWould = (stored: string): Date =>
  pgTypes.getTypeParser(TIMESTAMP_WITHOUT_TIME_ZONE)(stored) as unknown as Date;

/**
 * What Postgres stores when that value comes back as JSON.
 *
 * Casting a string with an offset to `timestamp without time zone` **discards**
 * the offset and keeps the wall clock, which is the half of the asymmetry that
 * cannot be changed from here.
 */
const storedAfterWriteBack = (sent: string): string => sent.replace('T', ' ').replace('Z', '');

describe('a naive timestamp round trip', () => {
  it('does not move', () => {
    const stored = '2026-09-19 17:23:46.269';

    const sent = readAsDriverWould(stored).toISOString();
    expect(storedAfterWriteBack(sent)).toBe('2026-09-19 17:23:46.269');
  });

  it('does not move on the second or third save either', () => {
    // The original symptom was cumulative: an hour per save, walking backwards.
    let stored = '2026-09-19 17:23:46.269';

    for (let save = 0; save < 3; save++) {
      stored = storedAfterWriteBack(readAsDriverWould(stored).toISOString());
    }

    expect(stored).toBe('2026-09-19 17:23:46.269');
  });

  it('reads the wall clock as UTC rather than as local time', () => {
    // The fix itself: `17:23` in the column means `17:23Z`, not `17:23+01:00`.
    expect(readAsDriverWould('2026-09-19 17:23:46.269').toISOString()).toBe(
      '2026-09-19T17:23:46.269Z'
    );
  });

  it('holds across a daylight-saving boundary', () => {
    /*
     * Ireland leaves summer time on 25 October 2026. A parser that used local
     * time would shift by one hour on one side of that date and not the other,
     * so a fix tested only in summer would look right and rot in the autumn.
     */
    const summer = '2026-09-19 17:23:46.269';
    const winter = '2026-12-19 17:23:46.269';

    expect(readAsDriverWould(summer).toISOString()).toBe('2026-09-19T17:23:46.269Z');
    expect(readAsDriverWould(winter).toISOString()).toBe('2026-12-19T17:23:46.269Z');
  });

  it('keeps a timestamp with no fractional seconds intact', () => {
    expect(readAsDriverWould('2026-09-19 17:23:46').toISOString()).toBe(
      '2026-09-19T17:23:46.000Z'
    );
  });

  it('passes null through', () => {
    // An unset entry-opening date is null, and must not become 1970.
    expect(readAsDriverWould(null as unknown as string)).toBeNull();
  });
});

describe('what is deliberately left alone', () => {
  it('does not touch date columns', () => {
    /*
     * `date` has the same local-midnight quirk, but a browser in the server's
     * zone renders it back correctly, and turning these into strings would
     * change every caller that does arithmetic on them. Left as the driver's
     * default on purpose — see the note in pool.ts.
     */
    const value = pgTypes.getTypeParser(DATE)('2026-06-15');

    expect(value).toBeInstanceOf(Date);
    expect((value as unknown as Date).getFullYear()).toBe(2026);
    expect((value as unknown as Date).getMonth()).toBe(5);
    expect((value as unknown as Date).getDate()).toBe(15);
  });
});
