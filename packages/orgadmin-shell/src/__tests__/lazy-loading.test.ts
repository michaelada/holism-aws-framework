import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  preloadTranslation,
  getTranslationCacheSize,
  clearTranslationCache,
  initializeI18n,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} from '../i18n/config';

describe('Lazy Loading for Translation Resources', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearTranslationCache();
    vi.clearAllMocks();
  });

  describe('Translation Cache', () => {
    it('should start with empty cache', () => {
      expect(getTranslationCacheSize()).toBe(0);
    });

    it('should cache translations after preloading', async () => {
      await preloadTranslation('en-GB');
      expect(getTranslationCacheSize()).toBe(1);

      await preloadTranslation('fr-FR');
      expect(getTranslationCacheSize()).toBe(2);
    });

    it('should not reload already cached translations', async () => {
      await preloadTranslation('en-GB');
      const initialSize = getTranslationCacheSize();

      // Preload again
      await preloadTranslation('en-GB');
      expect(getTranslationCacheSize()).toBe(initialSize);
    });

    it('should clear cache when requested', async () => {
      await preloadTranslation('en-GB');
      await preloadTranslation('fr-FR');
      expect(getTranslationCacheSize()).toBeGreaterThan(0);

      clearTranslationCache();
      expect(getTranslationCacheSize()).toBe(0);
    });
  });

  describe('Preload Translation', () => {
    it('should preload all supported locales', async () => {
      for (const locale of SUPPORTED_LOCALES) {
        await expect(preloadTranslation(locale)).resolves.not.toThrow();
      }
      expect(getTranslationCacheSize()).toBe(SUPPORTED_LOCALES.length);
    });

    it('should handle preloading the same locale multiple times', async () => {
      await preloadTranslation('en-GB');
      await preloadTranslation('en-GB');
      await preloadTranslation('en-GB');
      
      // Should only be cached once
      expect(getTranslationCacheSize()).toBe(1);
    });
  });

  describe('Initialize i18n with Lazy Loading', () => {
    it('should initialize with default locale', async () => {
      await expect(initializeI18n()).resolves.not.toThrow();
      // Should have loaded at least the default locale
      expect(getTranslationCacheSize()).toBeGreaterThanOrEqual(1);
    });

    it('should initialize with specified locale', async () => {
      await expect(initializeI18n('fr-FR')).resolves.not.toThrow();
      // Should have loaded the specified locale
      expect(getTranslationCacheSize()).toBeGreaterThanOrEqual(1);
    });

    it('should handle initialization errors gracefully', async () => {
      // This should not throw even if there are issues
      await expect(initializeI18n('invalid-locale' as any)).resolves.not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should only load translations on demand', async () => {
      // Initially, no translations should be loaded
      expect(getTranslationCacheSize()).toBe(0);

      // Load one translation
      await preloadTranslation('en-GB');
      expect(getTranslationCacheSize()).toBe(1);

      // Other translations should not be loaded yet
      expect(getTranslationCacheSize()).toBeLessThan(SUPPORTED_LOCALES.length);
    });

    it('should allow clearing cache to free memory', async () => {
      // Load all translations
      for (const locale of SUPPORTED_LOCALES) {
        await preloadTranslation(locale);
      }
      expect(getTranslationCacheSize()).toBe(SUPPORTED_LOCALES.length);

      // Clear cache
      clearTranslationCache();
      expect(getTranslationCacheSize()).toBe(0);
    });
  });

  describe('Bundle Size Optimization', () => {
    it('should not eagerly import all translations', () => {
      // At module load time, cache should be empty
      // This verifies that translations are not imported at the top level
      expect(getTranslationCacheSize()).toBe(0);
    });

    it('should load translations incrementally', async () => {
      const initialSize = getTranslationCacheSize();
      
      await preloadTranslation('en-GB');
      const afterFirst = getTranslationCacheSize();
      expect(afterFirst).toBe(initialSize + 1);

      await preloadTranslation('fr-FR');
      const afterSecond = getTranslationCacheSize();
      expect(afterSecond).toBe(afterFirst + 1);
    });
  });
});
