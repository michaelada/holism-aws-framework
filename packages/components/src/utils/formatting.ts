/**
 * Locale-aware formatting shared across front ends.
 *
 * Lives in `packages/components` because more than one front end needs it
 * (CLAUDE.md §1.5): the account-user app renders fees and expiry dates, and so
 * does the org-admin shell.
 *
 * `orgadmin-shell/src/utils/{currencyFormatting,dateFormatting}.ts` predate
 * this and still hold their own memoising implementations. They are not changed
 * here — converging them is a refactor of a working, tested surface with no
 * behavioural gain, and would be a change to make deliberately rather than as a
 * side effect of building a new screen.
 */

/**
 * Format a money amount.
 *
 * Falls back to the plain number rather than throwing when the currency code is
 * missing or unrecognised. A club with a bad currency should show an unadorned
 * figure, not an error boundary where its fees ought to be.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined,
  locale = 'en-GB'
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

/**
 * Format a date for display.
 *
 * Returns an em dash for a missing or unparseable value. Several of the columns
 * this feeds are nullable in the database, and rendering "Invalid Date" in a
 * table reads as a fault in the member's own record.
 */
export function formatDisplayDate(
  value: string | Date | null | undefined,
  locale = 'en-GB'
): string {
  const date = toDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** As `formatDisplayDate`, with the time of day. */
export function formatDisplayDateTime(
  value: string | Date | null | undefined,
  locale = 'en-GB'
): string {
  const date = toDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Render a start and end date as one span.
 *
 * A single-day event shows one date rather than "1 Jul – 1 Jul", which reads as
 * a formatting bug to anyone looking at it.
 */
export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  locale = 'en-GB'
): string {
  const from = toDate(start);
  const to = toDate(end);

  if (!from && !to) return '—';
  if (!from) return formatDisplayDate(to, locale);
  if (!to) return formatDisplayDate(from, locale);

  if (from.toDateString() === to.toDateString()) {
    return formatDisplayDate(from, locale);
  }

  return `${formatDisplayDate(from, locale)} – ${formatDisplayDate(to, locale)}`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
