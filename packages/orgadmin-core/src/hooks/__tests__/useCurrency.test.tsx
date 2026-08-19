/**
 * Money is shown in the organisation's currency, or in none at all.
 *
 * Before this hook, every amount named its currency at the call site and every
 * call site guessed: payments and lodgements hard-coded `GBP`, reporting
 * hard-coded `EUR`, and the core dashboard carried a local formatter pinned to
 * `en-IE` + `EUR`. A euro club saw sterling on its refund confirmation; a
 * sterling club saw euro on its revenue report. The currency follows the
 * organisation — fixed by its type — so it can only be read from there.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrency } from '../useCurrency';

const mockOrganisation = vi.fn();
vi.mock('../../context/OrganisationContext', () => ({
  useOrganisation: () => mockOrganisation(),
}));

const mockLanguage = vi.fn(() => 'en-GB');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mockLanguage() } }),
}));

const withCurrency = (currency?: string) => {
  mockOrganisation.mockReturnValue({ organisation: currency === undefined ? {} : { currency } });
  return renderHook(() => useCurrency()).result.current;
};

describe('useCurrency', () => {
  it('formats in the organisation’s own currency', () => {
    expect(withCurrency('EUR').format(1234.5)).toContain('€');
  });

  it('formats a sterling club in sterling', () => {
    expect(withCurrency('GBP').format(1234.5)).toContain('£');
  });

  it('never falls back to a currency the organisation did not choose', () => {
    /*
     * The specific defect: an unset currency used to render as GBP, because
     * that was `formatCurrency`'s default. A number with no symbol is
     * incomplete; a number with the wrong symbol is a lie about money.
     */
    const formatted = withCurrency(undefined).format(1234.5);

    expect(formatted).not.toContain('£');
    expect(formatted).not.toContain('€');
    expect(formatted).not.toContain('$');
    expect(formatted).toMatch(/1[,.\s]?234[.,]50/);
  });

  it('survives a malformed currency code rather than throwing', () => {
    // A club whose settings hold a typo should still be able to read the amount.
    expect(withCurrency('NOTACURRENCY').format(99.5)).toBe('99.50');
  });

  it('follows the active locale, not just the currency', () => {
    mockLanguage.mockReturnValue('de-DE');
    const formatted = withCurrency('EUR').format(1234.5);

    // German writes 1.234,50 € — the separators invert.
    expect(formatted).toContain('1.234,50');
    mockLanguage.mockReturnValue('en-GB');
  });

  it('renders nothing for an absent amount instead of a zero', () => {
    // A missing figure and a figure of zero mean different things on a payments
    // screen, and must not look identical.
    const { format } = withCurrency('EUR');

    expect(format(null)).toBe('');
    expect(format(undefined)).toBe('');
    expect(format(0)).not.toBe('');
  });

  it('exposes the code itself, for anything that needs more than a formatted string', () => {
    expect(withCurrency('EUR').currency).toBe('EUR');
    expect(withCurrency(undefined).currency).toBeUndefined();
  });
});
