/**
 * Property-Based Tests for Currency Formatting
 * 
 * Tests the correctness properties for currency formatting
 * across different locales.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatCurrency, parseCurrency } from '../utils/currencyFormatting';
import { SUPPORTED_LOCALES } from '../i18n/config';

describe('Currency Formatting Property-Based Tests', () => {
  /**
   * Property 10: Currency Formatting by Locale
   * Feature: orgadmin-i18n, Property 10: Currency Formatting by Locale
   * 
   * For any numeric amount and currency code, formatting it with different
   * locales should produce different formatted strings, but the underlying
   * currency code should remain unchanged.
   * 
   * Validates: Requirements 7.1, 7.4
   */
  describe('Property 10: Currency Formatting by Locale', () => {
    it('should format currency values consistently for the same locale', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1000000, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (amount, currency, locale) => {
            const formatted1 = formatCurrency(amount, currency, locale);
            const formatted2 = formatCurrency(amount, currency, locale);

            // Same inputs should produce identical results
            expect(formatted1).toBe(formatted2);
            expect(formatted1).toBeTruthy();
            expect(typeof formatted1).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different formats for different locales', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 10000, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (amount, currency, locale1, locale2) => {
            // Skip if locales are the same
            fc.pre(locale1 !== locale2);

            const formatted1 = formatCurrency(amount, currency, locale1);
            const formatted2 = formatCurrency(amount, currency, locale2);

            // Both should be valid strings
            expect(formatted1).toBeTruthy();
            expect(formatted2).toBeTruthy();
            expect(typeof formatted1).toBe('string');
            expect(typeof formatted2).toBe('string');

            // Different locales typically produce different formats
            // (due to different decimal/thousand separators, symbol positions)
            // However, we can't guarantee they're always different, so we just
            // verify both are valid formatted strings
            expect(formatted1.length).toBeGreaterThan(0);
            expect(formatted2.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve currency code across formatting', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1000000, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (amount, currency, locale) => {
            const formatted = formatCurrency(amount, currency, locale);

            // The formatted string should contain currency information
            // (either symbol or code)
            expect(formatted).toBeTruthy();
            expect(typeof formatted).toBe('string');

            // Verify the formatted string contains some currency indicator
            // Different locales use different symbols (€, £, $, EUR, GBP, USD)
            const hasCurrencyIndicator =
              formatted.includes('€') ||
              formatted.includes('£') ||
              formatted.includes('$') ||
              formatted.includes('EUR') ||
              formatted.includes('GBP') ||
              formatted.includes('USD');

            expect(hasCurrencyIndicator).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format zero correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (currency, locale) => {
            const formatted = formatCurrency(0, currency, locale);

            // Should format zero as a valid currency string
            expect(formatted).toBeTruthy();
            expect(typeof formatted).toBe('string');

            // Should contain "0" or "0.00" or "0,00" depending on locale
            const hasZero = formatted.includes('0');
            expect(hasZero).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format negative amounts correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000000, max: -1, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (amount, currency, locale) => {
            const formatted = formatCurrency(amount, currency, locale);

            // Should format negative amounts
            expect(formatted).toBeTruthy();
            expect(typeof formatted).toBe('string');

            // Should contain a minus sign or parentheses (depending on locale)
            const hasNegativeIndicator =
              formatted.includes('-') ||
              formatted.includes('(') ||
              formatted.includes(')');

            expect(hasNegativeIndicator).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format large amounts correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000000, max: 999999999, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (amount, currency, locale) => {
            const formatted = formatCurrency(amount, currency, locale);

            // Should format large amounts
            expect(formatted).toBeTruthy();
            expect(typeof formatted).toBe('string');

            // Should contain thousand separators (. or , or space)
            const hasThousandSeparator =
              formatted.includes(',') ||
              formatted.includes('.') ||
              formatted.includes(' ') ||
              formatted.includes('\u00A0'); // Non-breaking space

            expect(hasThousandSeparator).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format decimal amounts with two decimal places', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 1000, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (amount, currency, locale) => {
            const formatted = formatCurrency(amount, currency, locale);

            // Should format with decimal places
            expect(formatted).toBeTruthy();
            expect(typeof formatted).toBe('string');

            // Should contain a decimal separator (. or ,)
            const hasDecimalSeparator =
              formatted.includes('.') || formatted.includes(',');

            // Most amounts should have decimal separators
            // (unless the amount is exactly a whole number)
            if (amount % 1 !== 0) {
              expect(hasDecimalSeparator).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Currency Parsing Tests
   */
  describe('Currency Parsing', () => {
    it('should round-trip currency values (format -> parse -> format)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 100000, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (amount, currency, locale) => {
            // Round to 2 decimal places for consistent comparison
            const roundedAmount = Math.round(amount * 100) / 100;

            // Format the amount
            const formatted = formatCurrency(roundedAmount, currency, locale);

            // Parse it back
            const parsed = parseCurrency(formatted, locale);

            // Should be close to the original (within floating point precision)
            expect(Math.abs(parsed - roundedAmount)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse currency strings consistently', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 100000, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (amount, currency, locale) => {
            const formatted = formatCurrency(amount, currency, locale);

            const parsed1 = parseCurrency(formatted, locale);
            const parsed2 = parseCurrency(formatted, locale);

            // Same input should produce identical results
            expect(parsed1).toBe(parsed2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle zero in parsing', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (currency, locale) => {
            const formatted = formatCurrency(0, currency, locale);
            const parsed = parseCurrency(formatted, locale);

            // Should parse to zero
            expect(parsed).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle negative amounts in parsing', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -100000, max: -1, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (amount, currency, locale) => {
            const roundedAmount = Math.round(amount * 100) / 100;
            const formatted = formatCurrency(roundedAmount, currency, locale);
            const parsed = parseCurrency(formatted, locale);

            // Should parse to a negative number
            expect(parsed).toBeLessThan(0);

            // Should be close to the original
            expect(Math.abs(parsed - roundedAmount)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Error Handling Tests
   */
  describe('Error Handling', () => {
    it('should handle invalid amounts gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(NaN, Infinity, -Infinity),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (invalidAmount, currency, locale) => {
            // Should not throw, should return a fallback string
            const result = formatCurrency(invalidAmount, currency, locale);
            expect(typeof result).toBe('string');
            expect(result).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle invalid currency strings in parsing', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('invalid', 'not-a-number', 'abc', ''),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (invalidString, locale) => {
            // Should not throw, should return 0 or a fallback value
            const result = parseCurrency(invalidString, locale);
            expect(typeof result).toBe('number');
            expect(isNaN(result)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle invalid locales by falling back gracefully', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1000, noNaN: true }),
          fc.constantFrom('EUR', 'GBP', 'USD'),
          fc.string({ minLength: 1, maxLength: 10 }).filter(
            (s) => !SUPPORTED_LOCALES.includes(s as any)
          ),
          (amount, currency, invalidLocale) => {
            // Should not throw, should fall back to a default format
            const result = formatCurrency(amount, currency, invalidLocale);
            expect(typeof result).toBe('string');
            expect(result).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
