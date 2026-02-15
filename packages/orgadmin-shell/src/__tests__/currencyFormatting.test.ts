import { describe, it, expect } from 'vitest';
import { formatCurrency, parseCurrency } from '../utils/currencyFormatting';

describe('Currency Formatting Utilities', () => {
  describe('formatCurrency', () => {
    it('should format currency with en-GB locale', () => {
      const formatted = formatCurrency(1234.56, 'EUR', 'en-GB');
      expect(formatted).toContain('1,234.56');
      expect(formatted).toContain('€');
    });

    it('should format currency with fr-FR locale', () => {
      const formatted = formatCurrency(1234.56, 'EUR', 'fr-FR');
      // French format uses space as thousand separator and comma as decimal
      expect(formatted).toMatch(/1\s?234,56/);
      expect(formatted).toContain('€');
    });

    it('should format currency with de-DE locale', () => {
      const formatted = formatCurrency(1234.56, 'EUR', 'de-DE');
      // German format uses dot as thousand separator and comma as decimal
      expect(formatted).toMatch(/1\.234,56/);
      expect(formatted).toContain('€');
    });

    it('should format currency with es-ES locale', () => {
      const formatted = formatCurrency(1234.56, 'EUR', 'es-ES');
      expect(formatted).toMatch(/1\.?234,56/);
      expect(formatted).toContain('€');
    });

    it('should format GBP currency', () => {
      const formatted = formatCurrency(1234.56, 'GBP', 'en-GB');
      expect(formatted).toContain('1,234.56');
      expect(formatted).toContain('£');
    });

    it('should format USD currency', () => {
      const formatted = formatCurrency(1234.56, 'USD', 'en-GB');
      expect(formatted).toContain('1,234.56');
      expect(formatted).toContain('$');
    });

    it('should handle zero amount', () => {
      const formatted = formatCurrency(0, 'EUR', 'en-GB');
      expect(formatted).toContain('0.00');
      expect(formatted).toContain('€');
    });

    it('should handle negative amount', () => {
      const formatted = formatCurrency(-1234.56, 'EUR', 'en-GB');
      expect(formatted).toContain('1,234.56');
      expect(formatted).toContain('€');
      expect(formatted).toContain('-');
    });

    it('should handle large numbers', () => {
      const formatted = formatCurrency(1234567.89, 'EUR', 'en-GB');
      expect(formatted).toContain('1,234,567.89');
      expect(formatted).toContain('€');
    });

    it('should handle invalid amount gracefully', () => {
      const formatted = formatCurrency(NaN, 'EUR', 'en-GB');
      expect(formatted).toBe('EUR 0.00');
    });

    it('should always show two decimal places', () => {
      const formatted1 = formatCurrency(100, 'EUR', 'en-GB');
      expect(formatted1).toContain('100.00');

      const formatted2 = formatCurrency(100.5, 'EUR', 'en-GB');
      expect(formatted2).toContain('100.50');
    });
  });

  describe('parseCurrency', () => {
    it('should parse en-GB formatted currency', () => {
      const parsed = parseCurrency('€1,234.56', 'en-GB');
      expect(parsed).toBe(1234.56);
    });

    it('should parse fr-FR formatted currency', () => {
      const parsed = parseCurrency('1 234,56 €', 'fr-FR');
      expect(parsed).toBe(1234.56);
    });

    it('should parse de-DE formatted currency', () => {
      const parsed = parseCurrency('1.234,56 €', 'de-DE');
      expect(parsed).toBe(1234.56);
    });

    it('should parse currency without thousand separators', () => {
      const parsed = parseCurrency('€123.45', 'en-GB');
      expect(parsed).toBe(123.45);
    });

    it('should parse negative currency', () => {
      const parsed = parseCurrency('-€1,234.56', 'en-GB');
      expect(parsed).toBe(-1234.56);
    });

    it('should parse zero', () => {
      const parsed = parseCurrency('€0.00', 'en-GB');
      expect(parsed).toBe(0);
    });

    it('should handle invalid currency string gracefully', () => {
      const parsed = parseCurrency('invalid', 'en-GB');
      expect(parsed).toBe(0);
    });

    it('should handle empty string gracefully', () => {
      const parsed = parseCurrency('', 'en-GB');
      expect(parsed).toBe(0);
    });

    it('should round-trip format and parse for en-GB', () => {
      const original = 1234.56;
      const formatted = formatCurrency(original, 'EUR', 'en-GB');
      const parsed = parseCurrency(formatted, 'en-GB');
      expect(parsed).toBe(original);
    });

    it('should round-trip format and parse for fr-FR', () => {
      const original = 1234.56;
      const formatted = formatCurrency(original, 'EUR', 'fr-FR');
      const parsed = parseCurrency(formatted, 'fr-FR');
      expect(parsed).toBe(original);
    });

    it('should round-trip format and parse for de-DE', () => {
      const original = 1234.56;
      const formatted = formatCurrency(original, 'EUR', 'de-DE');
      const parsed = parseCurrency(formatted, 'de-DE');
      expect(parsed).toBe(original);
    });
  });

  describe('Currency code preservation', () => {
    it('should preserve EUR currency code across locales', () => {
      const enFormatted = formatCurrency(100, 'EUR', 'en-GB');
      const frFormatted = formatCurrency(100, 'EUR', 'fr-FR');
      const deFormatted = formatCurrency(100, 'EUR', 'de-DE');

      expect(enFormatted).toContain('€');
      expect(frFormatted).toContain('€');
      expect(deFormatted).toContain('€');
    });

    it('should preserve GBP currency code across locales', () => {
      const enFormatted = formatCurrency(100, 'GBP', 'en-GB');
      const frFormatted = formatCurrency(100, 'GBP', 'fr-FR');

      expect(enFormatted).toContain('£');
      expect(frFormatted).toContain('£');
    });
  });

  describe('Locale-specific formatting differences', () => {
    it('should produce different formats for different locales', () => {
      const amount = 1234.56;
      const enFormatted = formatCurrency(amount, 'EUR', 'en-GB');
      const frFormatted = formatCurrency(amount, 'EUR', 'fr-FR');
      const deFormatted = formatCurrency(amount, 'EUR', 'de-DE');

      // All should contain the same currency symbol
      expect(enFormatted).toContain('€');
      expect(frFormatted).toContain('€');
      expect(deFormatted).toContain('€');

      // But formats should be different
      expect(enFormatted).not.toBe(frFormatted);
      expect(enFormatted).not.toBe(deFormatted);
      expect(frFormatted).not.toBe(deFormatted);
    });
  });
});
