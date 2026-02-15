import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatDate,
  formatTime,
  formatDateTime,
  clearDateFormatCache,
  getDateFormatCacheSize,
} from '../utils/dateFormatting';
import {
  formatCurrency,
  clearCurrencyFormatCache,
  getCurrencyFormatCacheSize,
} from '../utils/currencyFormatting';

describe('Memoization for Formatting Functions', () => {
  beforeEach(() => {
    // Clear caches before each test
    clearDateFormatCache();
    clearCurrencyFormatCache();
  });

  describe('Date Formatting Memoization', () => {
    it('should cache date formatting results', () => {
      const date = new Date('2024-02-14T15:30:00');
      const locale = 'en-GB';
      const formatString = 'PP';

      // First call should add to cache
      const result1 = formatDate(date, formatString, locale);
      const cacheSize1 = getDateFormatCacheSize();
      expect(cacheSize1).toBe(1);

      // Second call with same parameters should use cache
      const result2 = formatDate(date, formatString, locale);
      const cacheSize2 = getDateFormatCacheSize();
      expect(cacheSize2).toBe(1); // Cache size should not increase
      expect(result1).toBe(result2);
    });

    it('should cache different format strings separately', () => {
      const date = new Date('2024-02-14T15:30:00');
      const locale = 'en-GB';

      formatDate(date, 'PP', locale);
      formatDate(date, 'dd/MM/yyyy', locale);
      formatDate(date, 'yyyy-MM-dd', locale);

      expect(getDateFormatCacheSize()).toBe(3);
    });

    it('should cache different locales separately', () => {
      const date = new Date('2024-02-14T15:30:00');
      const formatString = 'PP';

      formatDate(date, formatString, 'en-GB');
      formatDate(date, formatString, 'fr-FR');
      formatDate(date, formatString, 'es-ES');

      expect(getDateFormatCacheSize()).toBe(3);
    });

    it('should improve performance on repeated calls', () => {
      const date = new Date('2024-02-14T15:30:00');
      const locale = 'en-GB';
      const formatString = 'PP';

      // Warm up
      formatDate(date, formatString, locale);

      // Measure uncached performance (different date)
      const uncachedStart = performance.now();
      for (let i = 0; i < 100; i++) {
        formatDate(new Date(`2024-02-${i + 1}T15:30:00`), formatString, locale);
      }
      const uncachedTime = performance.now() - uncachedStart;

      // Clear cache and measure cached performance
      clearDateFormatCache();
      formatDate(date, formatString, locale); // Prime cache

      const cachedStart = performance.now();
      for (let i = 0; i < 100; i++) {
        formatDate(date, formatString, locale);
      }
      const cachedTime = performance.now() - cachedStart;

      // Cached calls should be significantly faster
      // We expect at least 2x improvement, but typically much more
      expect(cachedTime).toBeLessThan(uncachedTime / 2);
    });

    it('should cache formatTime results', () => {
      const date = new Date('2024-02-14T15:30:00');
      const locale = 'en-GB';

      formatTime(date, locale);
      expect(getDateFormatCacheSize()).toBe(1);

      formatTime(date, locale);
      expect(getDateFormatCacheSize()).toBe(1); // Should not increase
    });

    it('should cache formatDateTime results', () => {
      const date = new Date('2024-02-14T15:30:00');
      const locale = 'en-GB';

      formatDateTime(date, locale);
      expect(getDateFormatCacheSize()).toBe(1);

      formatDateTime(date, locale);
      expect(getDateFormatCacheSize()).toBe(1); // Should not increase
    });

    it('should handle cache clearing', () => {
      const date = new Date('2024-02-14T15:30:00');
      const locale = 'en-GB';

      formatDate(date, 'PP', locale);
      formatTime(date, locale);
      formatDateTime(date, locale);

      expect(getDateFormatCacheSize()).toBeGreaterThan(0);

      clearDateFormatCache();
      expect(getDateFormatCacheSize()).toBe(0);
    });

    it('should handle string and number date inputs', () => {
      const dateString = '2024-02-14T15:30:00';
      const dateNumber = new Date(dateString).getTime();
      const dateObject = new Date(dateString);
      const locale = 'en-GB';
      const formatString = 'PP';

      const result1 = formatDate(dateString, formatString, locale);
      const result2 = formatDate(dateNumber, formatString, locale);
      const result3 = formatDate(dateObject, formatString, locale);

      // All should produce the same result
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);

      // All should be cached (same timestamp)
      expect(getDateFormatCacheSize()).toBe(1);
    });
  });

  describe('Currency Formatting Memoization', () => {
    it('should cache currency formatting results', () => {
      const amount = 1234.56;
      const currency = 'EUR';
      const locale = 'en-GB';

      // First call should add to cache
      const result1 = formatCurrency(amount, currency, locale);
      const cacheSize1 = getCurrencyFormatCacheSize();
      expect(cacheSize1).toBe(1);

      // Second call with same parameters should use cache
      const result2 = formatCurrency(amount, currency, locale);
      const cacheSize2 = getCurrencyFormatCacheSize();
      expect(cacheSize2).toBe(1); // Cache size should not increase
      expect(result1).toBe(result2);
    });

    it('should cache different currencies separately', () => {
      const amount = 1234.56;
      const locale = 'en-GB';

      formatCurrency(amount, 'EUR', locale);
      formatCurrency(amount, 'GBP', locale);
      formatCurrency(amount, 'USD', locale);

      expect(getCurrencyFormatCacheSize()).toBe(3);
    });

    it('should cache different locales separately', () => {
      const amount = 1234.56;
      const currency = 'EUR';

      formatCurrency(amount, currency, 'en-GB');
      formatCurrency(amount, currency, 'fr-FR');
      formatCurrency(amount, currency, 'de-DE');

      expect(getCurrencyFormatCacheSize()).toBe(3);
    });

    it('should improve performance on repeated calls', () => {
      const amount = 1234.56;
      const currency = 'EUR';
      const locale = 'en-GB';

      // Warm up
      formatCurrency(amount, currency, locale);

      // Measure uncached performance (different amounts)
      const uncachedStart = performance.now();
      for (let i = 0; i < 100; i++) {
        formatCurrency(amount + i, currency, locale);
      }
      const uncachedTime = performance.now() - uncachedStart;

      // Clear cache and measure cached performance
      clearCurrencyFormatCache();
      formatCurrency(amount, currency, locale); // Prime cache

      const cachedStart = performance.now();
      for (let i = 0; i < 100; i++) {
        formatCurrency(amount, currency, locale);
      }
      const cachedTime = performance.now() - cachedStart;

      // Cached calls should be significantly faster
      expect(cachedTime).toBeLessThan(uncachedTime / 2);
    });

    it('should handle cache clearing', () => {
      formatCurrency(100, 'EUR', 'en-GB');
      formatCurrency(200, 'GBP', 'fr-FR');
      formatCurrency(300, 'USD', 'de-DE');

      expect(getCurrencyFormatCacheSize()).toBeGreaterThan(0);

      clearCurrencyFormatCache();
      expect(getCurrencyFormatCacheSize()).toBe(0);
    });

    it('should round amounts for consistent caching', () => {
      const locale = 'en-GB';
      const currency = 'EUR';

      // These should cache to the same key (both round to 1234.56)
      formatCurrency(1234.5600001, currency, locale);
      formatCurrency(1234.5599999, currency, locale);

      // Both round to 1234.56, so should have 1 cache entry
      expect(getCurrencyFormatCacheSize()).toBe(1);
    });

    it('should handle edge cases without caching invalid values', () => {
      const locale = 'en-GB';
      const currency = 'EUR';

      // Invalid amounts should not be cached
      const initialSize = getCurrencyFormatCacheSize();
      formatCurrency(NaN, currency, locale);
      expect(getCurrencyFormatCacheSize()).toBe(initialSize);
    });
  });

  describe('Cache Memory Management', () => {
    it('should not grow date cache indefinitely', () => {
      const locale = 'en-GB';
      const formatString = 'PP';

      // Add many entries
      for (let i = 0; i < 1500; i++) {
        formatDate(new Date(`2024-01-01T${i % 24}:00:00`), formatString, locale);
      }

      // Cache should be limited
      expect(getDateFormatCacheSize()).toBeLessThanOrEqual(1000);
    });

    it('should not grow currency cache indefinitely', () => {
      const locale = 'en-GB';
      const currency = 'EUR';

      // Add many entries
      for (let i = 0; i < 1500; i++) {
        formatCurrency(i * 10.5, currency, locale);
      }

      // Cache should be limited
      expect(getCurrencyFormatCacheSize()).toBeLessThanOrEqual(1000);
    });
  });

  describe('Performance Measurement', () => {
    it('should demonstrate overall performance improvement', () => {
      const testDate = new Date('2024-02-14T15:30:00');
      const testAmount = 1234.56;
      const locale = 'en-GB';

      // Measure without memoization (clear cache each time)
      const unmemoizedStart = performance.now();
      for (let i = 0; i < 50; i++) {
        clearDateFormatCache();
        clearCurrencyFormatCache();
        formatDate(testDate, 'PP', locale);
        formatCurrency(testAmount, 'EUR', locale);
      }
      const unmemoizedTime = performance.now() - unmemoizedStart;

      // Measure with memoization
      clearDateFormatCache();
      clearCurrencyFormatCache();
      const memoizedStart = performance.now();
      for (let i = 0; i < 50; i++) {
        formatDate(testDate, 'PP', locale);
        formatCurrency(testAmount, 'EUR', locale);
      }
      const memoizedTime = performance.now() - memoizedStart;

      // Log performance improvement
      const improvement = ((unmemoizedTime - memoizedTime) / unmemoizedTime * 100).toFixed(2);
      console.log(`Performance improvement: ${improvement}% faster with memoization`);
      console.log(`Unmemoized: ${unmemoizedTime.toFixed(2)}ms, Memoized: ${memoizedTime.toFixed(2)}ms`);

      // Memoized should be significantly faster
      expect(memoizedTime).toBeLessThan(unmemoizedTime);
    });
  });
});
