import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDateRange,
  formatOrdinalDate,
  formatOrdinalDateTime,
} from '../formatting';

describe('formatCurrency', () => {
  it('formats an amount in the given currency', () => {
    expect(formatCurrency(25, 'EUR', 'en-GB')).toBe('€25.00');
    expect(formatCurrency(25, 'GBP', 'en-GB')).toBe('£25.00');
  });

  it('follows the locale, not just the currency', () => {
    // Same amount, different conventions — a German member should see their own.
    const de = formatCurrency(1234.5, 'EUR', 'de-DE');
    expect(de).toContain('1.234,50');
  });

  it('shows a dash rather than a stray zero for a missing amount', () => {
    // Several of the columns this feeds are nullable; "€0.00" would state a
    // fact the record does not contain.
    expect(formatCurrency(null, 'EUR')).toBe('—');
    expect(formatCurrency(undefined, 'EUR')).toBe('—');
    expect(formatCurrency(NaN, 'EUR')).toBe('—');
  });

  it('formats zero, which is a real fee', () => {
    expect(formatCurrency(0, 'EUR', 'en-GB')).toBe('€0.00');
  });

  it('defaults a missing currency rather than throwing', () => {
    expect(formatCurrency(10, null, 'en-GB')).toBe('€10.00');
  });

  it('falls back to a plain number for an unrecognised currency', () => {
    // A club with a bad currency code should show an unadorned figure, not an
    // error boundary where its fees belong.
    expect(formatCurrency(10, 'NOT-A-CURRENCY', 'en-GB')).toBe('10.00');
  });
});

describe('formatDisplayDate', () => {
  it('formats a date readably', () => {
    expect(formatDisplayDate('2026-07-01', 'en-GB')).toBe('1 Jul 2026');
  });

  it('accepts a Date as well as a string', () => {
    expect(formatDisplayDate(new Date('2026-07-01T00:00:00Z'), 'en-GB')).toBe('1 Jul 2026');
  });

  it('shows a dash rather than "Invalid Date"', () => {
    // Rendering "Invalid Date" in a member's own record reads as a fault in
    // their data.
    expect(formatDisplayDate(null)).toBe('—');
    expect(formatDisplayDate('not a date')).toBe('—');
    expect(formatDisplayDate('')).toBe('—');
  });
});

describe('formatDisplayDateTime', () => {
  it('includes the time of day', () => {
    const formatted = formatDisplayDateTime('2026-07-01T14:30:00Z', 'en-GB');
    expect(formatted).toContain('Jul 2026');
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('shows a dash for a missing value', () => {
    expect(formatDisplayDateTime(null)).toBe('—');
  });
});

describe('formatDateRange', () => {
  it('shows a span across two days', () => {
    expect(formatDateRange('2026-07-01', '2026-07-03', 'en-GB')).toBe(
      '1 Jul 2026 – 3 Jul 2026'
    );
  });

  it('collapses a single-day event to one date', () => {
    // "1 Jul – 1 Jul" reads as a formatting bug to anyone looking at it.
    expect(formatDateRange('2026-07-01', '2026-07-01', 'en-GB')).toBe('1 Jul 2026');
  });

  it('copes with only one end of the range', () => {
    expect(formatDateRange('2026-07-01', null, 'en-GB')).toBe('1 Jul 2026');
    expect(formatDateRange(null, '2026-07-03', 'en-GB')).toBe('3 Jul 2026');
  });

  it('shows a dash when there is no range at all', () => {
    expect(formatDateRange(null, null)).toBe('—');
  });
});

describe('formatOrdinalDate', () => {
  it('suffixes the day in English', () => {
    expect(formatOrdinalDate('2026-09-01', 'en-GB')).toBe('1st Sept 2026');
    expect(formatOrdinalDate('2026-09-02', 'en-GB')).toBe('2nd Sept 2026');
    expect(formatOrdinalDate('2026-09-03', 'en-GB')).toBe('3rd Sept 2026');
    expect(formatOrdinalDate('2026-09-04', 'en-GB')).toBe('4th Sept 2026');
  });

  it('gets the teens right', () => {
    // The case a naive last-digit rule breaks on: 11th, not 11st.
    expect(formatOrdinalDate('2026-09-11', 'en-GB')).toBe('11th Sept 2026');
    expect(formatOrdinalDate('2026-09-12', 'en-GB')).toBe('12th Sept 2026');
    expect(formatOrdinalDate('2026-09-13', 'en-GB')).toBe('13th Sept 2026');
  });

  it('gets the twenties and thirties right', () => {
    expect(formatOrdinalDate('2026-09-21', 'en-GB')).toBe('21st Sept 2026');
    expect(formatOrdinalDate('2026-09-22', 'en-GB')).toBe('22nd Sept 2026');
    expect(formatOrdinalDate('2026-09-23', 'en-GB')).toBe('23rd Sept 2026');
    expect(formatOrdinalDate('2026-08-31', 'en-GB')).toBe('31st Aug 2026');
  });

  it('uses "er" for the first of the month in French, and nothing after', () => {
    expect(formatOrdinalDate('2026-09-01', 'fr-FR')).toContain('1er');
    // "2 septembre", not "2e septembre".
    expect(formatOrdinalDate('2026-09-02', 'fr-FR')).not.toContain('2e');
  });

  it('leaves languages that do not ordinal-suffix dates alone', () => {
    // German already writes "1." and the others use a plain numeral. Inventing
    // a suffix would be a wrong date in a language we do not speak.
    for (const locale of ['de-DE', 'es-ES', 'it-IT', 'pt-PT']) {
      expect(formatOrdinalDate('2026-09-22', locale)).toBe(
        formatDisplayDate('2026-09-22', locale)
      );
    }
  });

  it('shows a dash for a missing or unparseable value', () => {
    expect(formatOrdinalDate(null)).toBe('—');
    expect(formatOrdinalDate('not a date')).toBe('—');
  });
});

describe('formatOrdinalDateTime', () => {
  it('keeps the time alongside the ordinal day', () => {
    // Midday UTC, so the calendar day is the same in every timezone the suite
    // might run in.
    const formatted = formatOrdinalDateTime('2026-09-22T12:00:00Z', 'en-GB');

    expect(formatted).toContain('22nd Sept 2026');
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('suffixes the day and nothing else', () => {
    // The hour is a two-digit number too, and a suffix appended by string
    // matching rather than by part type would decorate it as well.
    const formatted = formatOrdinalDateTime('2026-09-22T12:00:00Z', 'en-GB');
    const suffixes = formatted.match(/\d(?:st|nd|rd|th)\b/g) ?? [];

    expect(suffixes).toEqual(['2nd']);
  });

  it('shows a dash for a missing value', () => {
    expect(formatOrdinalDateTime(null)).toBe('—');
  });
});
