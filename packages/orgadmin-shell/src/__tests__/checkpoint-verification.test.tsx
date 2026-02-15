import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { initializeI18n, DEFAULT_LOCALE } from '../i18n/config';
import { LocaleProvider, useLocale } from '../context/LocaleContext';
import { useTranslation } from '../hooks/useTranslation';
import { formatDate, formatCurrency } from '../utils/dateFormatting';
import { formatCurrency as formatCurrencyUtil } from '../utils/currencyFormatting';

/**
 * Checkpoint 5: Infrastructure ready for translation
 * 
 * This test file verifies that:
 * 1. i18n is initialized and locale context is available
 * 2. Changing locale in code updates the active language
 * 3. Date and currency formatting utilities work correctly
 */
describe('Checkpoint 5: Infrastructure Ready for Translation', () => {
  beforeEach(async () => {
    await initializeI18n(DEFAULT_LOCALE, true);
  });

  describe('1. i18n initialization and locale context availability', () => {
    it('should have i18n initialized with locale context available', () => {
      const { result } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      // Verify locale context is available
      expect(result.current).toBeDefined();
      expect(result.current.locale).toBe('en-GB');
      expect(result.current.setLocale).toBeInstanceOf(Function);
      expect(result.current.isLoading).toBe(false);
    });

    it('should have translation function available', () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      // Verify translation function is available
      expect(result.current.t).toBeInstanceOf(Function);
      expect(result.current.i18n).toBeDefined();
      expect(result.current.ready).toBe(true);
    });
  });

  describe('2. Changing locale updates active language', () => {
    it('should update translations when locale changes from en-GB to fr-FR', async () => {
      const { result: localeResult } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      const { result: translationResult, rerender } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      // Initial state - English
      expect(localeResult.current.locale).toBe('en-GB');
      expect(translationResult.current.t('common.actions.save')).toBe('Save');

      // Change to French
      await act(async () => {
        await localeResult.current.setLocale('fr-FR');
      });

      // Rerender to get updated translation
      rerender();

      // Verify locale changed
      expect(localeResult.current.locale).toBe('fr-FR');
      
      // Verify translation updated
      const frenchTranslation = translationResult.current.t('common.actions.save');
      expect(frenchTranslation).toBe('Enregistrer');
      expect(frenchTranslation).not.toBe('Save');
    });

    it('should update translations when locale changes from en-GB to es-ES', async () => {
      const { result: localeResult } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      const { result: translationResult, rerender } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      // Initial state - English
      expect(translationResult.current.t('common.actions.cancel')).toBe('Cancel');

      // Change to Spanish
      await act(async () => {
        await localeResult.current.setLocale('es-ES');
      });

      rerender();

      // Verify translation updated
      const spanishTranslation = translationResult.current.t('common.actions.cancel');
      expect(spanishTranslation).toBe('Cancelar');
      expect(spanishTranslation).not.toBe('Cancel');
    });

    it('should cycle through multiple locales correctly', async () => {
      const { result: localeResult } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      const { result: translationResult, rerender } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      const locales = ['fr-FR', 'de-DE', 'it-IT', 'en-GB'] as const;
      const expectedTranslations = {
        'fr-FR': 'Supprimer',
        'de-DE': 'Löschen',
        'it-IT': 'Elimina',
        'en-GB': 'Delete',
      };

      for (const locale of locales) {
        await act(async () => {
          await localeResult.current.setLocale(locale);
        });

        rerender();

        expect(localeResult.current.locale).toBe(locale);
        expect(translationResult.current.t('common.actions.delete')).toBe(
          expectedTranslations[locale]
        );
      }
    });
  });

  describe('3. Date and currency formatting utilities work correctly', () => {
    const testDate = new Date('2024-02-14T15:30:00Z');
    const testAmount = 1234.56;

    it('should format dates correctly for different locales', () => {
      // English (UK)
      const enDate = formatDate(testDate, 'dd/MM/yyyy', 'en-GB');
      expect(enDate).toBe('14/02/2024');

      // French
      const frDate = formatDate(testDate, 'dd/MM/yyyy', 'fr-FR');
      expect(frDate).toBe('14/02/2024');

      // German - month names should be different
      const enMonth = formatDate(testDate, 'MMMM', 'en-GB');
      const deMonth = formatDate(testDate, 'MMMM', 'de-DE');
      expect(enMonth).toBe('February');
      expect(deMonth).toBe('Februar');
    });

    it('should format currency correctly for different locales', () => {
      // English (UK) - uses comma for thousands, dot for decimal
      const enCurrency = formatCurrencyUtil(testAmount, 'EUR', 'en-GB');
      expect(enCurrency).toContain('1,234.56');
      expect(enCurrency).toContain('€');

      // French - uses space for thousands, comma for decimal
      const frCurrency = formatCurrencyUtil(testAmount, 'EUR', 'fr-FR');
      expect(frCurrency).toMatch(/1\s?234,56/);
      expect(frCurrency).toContain('€');

      // German - uses dot for thousands, comma for decimal
      const deCurrency = formatCurrencyUtil(testAmount, 'EUR', 'de-DE');
      expect(deCurrency).toMatch(/1\.234,56/);
      expect(deCurrency).toContain('€');
    });

    it('should handle edge cases in date formatting', () => {
      // Invalid date
      const invalidDate = formatDate('invalid', 'dd/MM/yyyy', 'en-GB');
      expect(invalidDate).toBe('invalid');

      // String date
      const stringDate = formatDate('2024-02-14', 'dd/MM/yyyy', 'en-GB');
      expect(stringDate).toBe('14/02/2024');

      // Timestamp
      const timestamp = formatDate(testDate.getTime(), 'dd/MM/yyyy', 'en-GB');
      expect(timestamp).toBe('14/02/2024');
    });

    it('should handle edge cases in currency formatting', () => {
      // Zero
      const zero = formatCurrencyUtil(0, 'EUR', 'en-GB');
      expect(zero).toContain('0.00');

      // Negative
      const negative = formatCurrencyUtil(-100, 'EUR', 'en-GB');
      expect(negative).toContain('-');
      expect(negative).toContain('100.00');

      // Large number
      const large = formatCurrencyUtil(1234567.89, 'EUR', 'en-GB');
      expect(large).toContain('1,234,567.89');

      // Invalid (NaN)
      const invalid = formatCurrencyUtil(NaN, 'EUR', 'en-GB');
      expect(invalid).toBe('EUR 0.00');
    });

    it('should preserve currency codes across locales', () => {
      // Use a larger amount to ensure different formatting
      const amount = 1234.56;
      const eurEn = formatCurrencyUtil(amount, 'EUR', 'en-GB');
      const eurFr = formatCurrencyUtil(amount, 'EUR', 'fr-FR');
      const eurDe = formatCurrencyUtil(amount, 'EUR', 'de-DE');

      // All should contain the Euro symbol
      expect(eurEn).toContain('€');
      expect(eurFr).toContain('€');
      expect(eurDe).toContain('€');

      // But formats should be different
      expect(eurEn).not.toBe(eurFr);
      expect(eurEn).not.toBe(eurDe);
      // Note: fr-FR and de-DE might have similar formats for some amounts
    });
  });

  describe('Summary: All checkpoint requirements verified', () => {
    it('should confirm all infrastructure is ready', () => {
      // This test serves as a summary confirmation
      const { result: localeResult } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      const { result: translationResult } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      // 1. i18n is initialized and locale context is available ✓
      expect(localeResult.current).toBeDefined();
      expect(translationResult.current.t).toBeInstanceOf(Function);

      // 2. Locale can be changed programmatically ✓
      expect(localeResult.current.setLocale).toBeInstanceOf(Function);

      // 3. Date and currency formatting utilities work ✓
      const date = formatDate(new Date(), 'dd/MM/yyyy', 'en-GB');
      expect(date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

      const currency = formatCurrencyUtil(100, 'EUR', 'en-GB');
      expect(currency).toContain('€');
      expect(currency).toContain('100.00');

      // All requirements met!
      expect(true).toBe(true);
    });
  });
});
