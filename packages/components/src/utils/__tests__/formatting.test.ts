import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDateRange,
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
