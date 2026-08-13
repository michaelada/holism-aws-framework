import { describe, it, expect } from 'vitest';
import {
  CLOSING_SOON_DAYS,
  OPENING_SOON_DAYS,
  capacityFor,
  daysBetween,
  entryWindowFor,
} from '../entryWindow';

/**
 * The rules a member is judged by when deciding whether to enter now.
 *
 * Tested apart from the chips that render them because the thresholds are
 * judgements — how much notice is "soon" — and the boundaries are exactly where
 * an off-by-one turns "closes tomorrow" into "closes in 0 days".
 */
const AT = (iso: string) => new Date(iso);
const NOW = AT('2026-08-12T10:00:00Z');

const event = (over: Partial<{ entriesOpenDate: string | null; entriesClosingDate: string | null }> = {}) => ({
  entriesOpenDate: null,
  entriesClosingDate: null,
  ...over,
});

describe('entryWindowFor', () => {
  it('reports an event whose entries have not opened', () => {
    const window = entryWindowFor(event({ entriesOpenDate: '2026-12-01T00:00:00Z' }), NOW);
    expect(window.state).toBe('not-open');
  });

  it('switches to opening-soon inside the notice period', () => {
    const window = entryWindowFor(event({ entriesOpenDate: '2026-08-20T00:00:00Z' }), NOW);
    expect(window.state).toBe('opening-soon');
    expect(window.days).toBe(8);
  });

  /** The boundary itself counts as soon; a day past it does not. */
  it.each([
    [OPENING_SOON_DAYS, 'opening-soon'],
    [OPENING_SOON_DAYS + 1, 'not-open'],
  ])('at %i days away it is %s', (days, expected) => {
    const opens = new Date(NOW);
    opens.setDate(opens.getDate() + days);
    expect(entryWindowFor(event({ entriesOpenDate: opens.toISOString() }), NOW).state).toBe(expected);
  });

  it('reports an open window with a distant closing date', () => {
    const window = entryWindowFor(event({ entriesClosingDate: '2026-12-01T00:00:00Z' }), NOW);
    expect(window.state).toBe('open');
  });

  it('warns when closing is near', () => {
    const window = entryWindowFor(event({ entriesClosingDate: '2026-08-15T00:00:00Z' }), NOW);
    expect(window.state).toBe('closing-soon');
    expect(window.days).toBe(3);
  });

  it.each([
    [CLOSING_SOON_DAYS, 'closing-soon'],
    [CLOSING_SOON_DAYS + 1, 'open'],
  ])('closing in %i days is %s', (days, expected) => {
    const closes = new Date(NOW);
    closes.setDate(closes.getDate() + days);
    expect(entryWindowFor(event({ entriesClosingDate: closes.toISOString() }), NOW).state).toBe(
      expected
    );
  });

  it('reports a closed window', () => {
    const window = entryWindowFor(event({ entriesClosingDate: '2026-08-01T00:00:00Z' }), NOW);
    expect(window.state).toBe('closed');
    expect(window.date).toBe('2026-08-01T00:00:00Z');
  });

  /**
   * Misconfigured dates should read as the earlier problem. Telling a member
   * entries are closed for an event that has not opened sends them away for
   * good; "not open yet" sends them back later.
   */
  it('prefers not-open over closed when both dates are in the wrong order', () => {
    const window = entryWindowFor(
      event({ entriesOpenDate: '2026-12-01T00:00:00Z', entriesClosingDate: '2026-01-01T00:00:00Z' }),
      NOW
    );
    expect(window.state).toBe('not-open');
  });

  it('treats an event with no dates as open', () => {
    expect(entryWindowFor(event(), NOW).state).toBe('open');
  });

  it('ignores unparseable dates rather than throwing', () => {
    expect(entryWindowFor(event({ entriesClosingDate: 'not-a-date' }), NOW).state).toBe('open');
  });
});

describe('daysBetween', () => {
  /** Counted from the start of each day, so 23:00 → 01:00 is one day, not zero. */
  it('counts calendar days rather than elapsed hours', () => {
    expect(daysBetween(AT('2026-08-12T23:00:00'), AT('2026-08-13T01:00:00'))).toBe(1);
  });
});

describe('capacityFor', () => {
  it('reports uncapped when neither level has a limit', () => {
    expect(capacityFor({ entriesLimit: null, placesRemaining: null }).state).toBe('uncapped');
  });

  it('reports the event limit and what is left of it', () => {
    const capacity = capacityFor({ entriesLimit: 50, placesRemaining: 12 });
    expect(capacity).toEqual({ state: 'available', limit: 50, remaining: 12 });
  });

  it('reports full when the event has no places left', () => {
    expect(capacityFor({ entriesLimit: 50, placesRemaining: 0 }).state).toBe('full');
  });

  it('uses the activity limit when only the activity is capped', () => {
    const capacity = capacityFor({ entriesLimit: null, placesRemaining: null }, { placesRemaining: 3 });
    expect(capacity).toMatchObject({ state: 'available', remaining: 3 });
  });

  /**
   * Quoting the event's twenty beside a class with two left is a promise the
   * next screen breaks.
   */
  it('takes the tighter of the two when both are capped', () => {
    const capacity = capacityFor({ entriesLimit: 50, placesRemaining: 20 }, { placesRemaining: 2 });
    expect(capacity.remaining).toBe(2);
  });

  it('is full when either level is exhausted', () => {
    expect(capacityFor({ entriesLimit: 50, placesRemaining: 20 }, { placesRemaining: 0 }).state).toBe(
      'full'
    );
    expect(capacityFor({ entriesLimit: 50, placesRemaining: 0 }, { placesRemaining: 9 }).state).toBe(
      'full'
    );
  });
});
