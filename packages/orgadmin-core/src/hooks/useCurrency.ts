import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganisation } from '../context/OrganisationContext';

/**
 * Money, in the organisation's own currency.
 *
 * Every amount in the org-admin used to name its currency at the call site, and
 * every call site guessed: the payments and lodgement screens hard-coded `GBP`,
 * the reporting screens hard-coded `EUR`. A euro club therefore saw its
 * payments, its CSV export and its refund confirmation in sterling, while a
 * sterling club saw its revenue reports in euro. Both were wrong, in opposite
 * directions, on the same screen set.
 *
 * The currency is not a per-screen decision and never was. It follows the
 * organisation — fixed by its organisation type — so it belongs to the
 * organisation context and reaches the interface through one hook.
 *
 * **When the currency is unknown, no symbol is shown.** An organisation still
 * loading, or one whose type never set a currency, produces a plain formatted
 * number rather than a confident guess. Showing the wrong symbol on a refund
 * confirmation is the failure this exists to prevent; showing none is merely
 * incomplete, and PRODUCT.md's fifth principle asks for exactly that trade —
 * never assert more certainty than the data has.
 */
export interface UseCurrencyResult {
  /** ISO 4217 code for this organisation, or `undefined` while unknown. */
  currency: string | undefined;
  /** Format an amount in the organisation's currency and the active locale. */
  format: (amount: number | null | undefined) => string;
}

export function useCurrency(): UseCurrencyResult {
  const { organisation } = useOrganisation();
  const { i18n } = useTranslation();

  const currency = organisation?.currency || undefined;
  const locale = i18n?.language || 'en-GB';

  const format = useCallback(
    (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined || Number.isNaN(amount)) return '';

      try {
        return new Intl.NumberFormat(locale, {
          style: currency ? 'currency' : 'decimal',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        /*
         * An unrecognised code reaches `Intl` as a `RangeError`. Fall back to
         * the bare number rather than to a default currency — a club whose
         * settings hold a typo should see an amount it can still read, not
         * somebody else's money.
         */
        return amount.toFixed(2);
      }
    },
    [currency, locale]
  );

  return useMemo(() => ({ currency, format }), [currency, format]);
}
