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
 * Day-of-month suffixes, by language.
 *
 * Deliberately not every locale. An ordinal date is an English habit and a
 * French one; German writes `1.` for every day, which `Intl` already produces,
 * and Spanish, Italian and Portuguese use a plain numeral. Inventing suffixes
 * for those would not be a nicer date — it would be a wrong one, in a language
 * the reader speaks and we do not.
 *
 * Keyed by the `Intl.PluralRules` ordinal category, which is what knows that
 * English 21 takes `st` while 11 takes `th`.
 */
const ORDINAL_SUFFIXES: Record<string, Partial<Record<Intl.LDMLPluralRule, string>>> = {
  en: { one: 'st', two: 'nd', few: 'rd', other: 'th' },
  // "1er septembre", then "2 septembre" — only the first takes a suffix.
  fr: { one: 'er' },
};

/** The language part of a locale tag, lower-cased: `en-GB` → `en`. */
const languageOf = (locale: string): string => locale.split('-')[0]!.toLowerCase();

/**
 * The same date, with an ordinal day where the language uses one.
 *
 * Built from `formatToParts` rather than by assembling a string, so the
 * locale keeps its own order and separators — only the day token is touched.
 * A locale with no suffix table comes back exactly as `Intl` rendered it.
 */
function withOrdinalDay(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  const suffixes = ORDINAL_SUFFIXES[languageOf(locale)];

  const parts = new Intl.DateTimeFormat(locale, options).formatToParts(date);
  if (!suffixes) return parts.map((part) => part.value).join('');

  const category = new Intl.PluralRules(locale, { type: 'ordinal' }).select(date.getDate());
  const suffix = suffixes[category];
  if (!suffix) return parts.map((part) => part.value).join('');

  return parts
    .map((part) => (part.type === 'day' ? `${part.value}${suffix}` : part.value))
    .join('');
}

/**
 * A date with an ordinal day — "1st Sept 2026".
 *
 * For dates a member reads as a deadline rather than scans in a column. An
 * ordinal reads the way the date is spoken, which is what makes "closes on the
 * 22nd" land as a day rather than as a number in a row of numbers.
 */
export function formatOrdinalDate(
  value: string | Date | null | undefined,
  locale = 'en-GB'
): string {
  const date = toDate(value);
  if (!date) return '—';

  return withOrdinalDay(date, locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** As `formatOrdinalDate`, with the time of day. */
export function formatOrdinalDateTime(
  value: string | Date | null | undefined,
  locale = 'en-GB'
): string {
  const date = toDate(value);
  if (!date) return '—';

  return withOrdinalDay(date, locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
