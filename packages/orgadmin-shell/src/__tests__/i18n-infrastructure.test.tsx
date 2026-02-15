import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import i18n, { initializeI18n, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../i18n/config';
import { LocaleProvider, useLocale } from '../context/LocaleContext';
import { useTranslation } from '../hooks/useTranslation';

describe('i18n Infrastructure', () => {
  beforeEach(async () => {
    // Reset i18n to default state before each test with all translations preloaded
    await initializeI18n(DEFAULT_LOCALE, true);
  });

  describe('i18n Configuration', () => {
    it('should initialize with all six supported locales', () => {
      expect(i18n.options.supportedLngs).toEqual(expect.arrayContaining(SUPPORTED_LOCALES));
      expect(i18n.options.supportedLngs?.length).toBeGreaterThanOrEqual(6);
    });

    it('should have en-GB as default locale', () => {
      expect(DEFAULT_LOCALE).toBe('en-GB');
      expect(i18n.options.fallbackLng).toEqual(['en-GB']);
    });

    it('should have all translation resources loaded', () => {
      SUPPORTED_LOCALES.forEach((locale) => {
        expect(i18n.hasResourceBundle(locale, 'translation')).toBe(true);
      });
    });

    it('should have common translations in all locales', () => {
      SUPPORTED_LOCALES.forEach((locale) => {
        const bundle = i18n.getResourceBundle(locale, 'translation');
        expect(bundle).toHaveProperty('common');
        expect(bundle.common).toHaveProperty('actions');
        expect(bundle.common).toHaveProperty('status');
        expect(bundle.common).toHaveProperty('validation');
      });
    });
  });

  describe('LocaleContext', () => {
    it('should provide locale to components', () => {
      const { result } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      expect(result.current.locale).toBe('en-GB');
      expect(result.current.setLocale).toBeInstanceOf(Function);
      expect(result.current.isLoading).toBe(false);
    });

    it('should initialize with organization locale when provided', () => {
      const { result } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => (
          <LocaleProvider organizationLocale="fr-FR">{children}</LocaleProvider>
        ),
      });

      expect(result.current.locale).toBe('fr-FR');
    });

    it('should fall back to default locale for invalid organization locale', () => {
      const { result } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => (
          <LocaleProvider organizationLocale="invalid-locale">{children}</LocaleProvider>
        ),
      });

      expect(result.current.locale).toBe('en-GB');
    });

    it('should change locale when setLocale is called', async () => {
      const { result } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      await act(async () => {
        await result.current.setLocale('fr-FR');
      });

      expect(result.current.locale).toBe('fr-FR');
    });

    it('should throw error when useLocale is used outside provider', () => {
      expect(() => {
        renderHook(() => useLocale());
      }).toThrow('useLocale must be used within a LocaleProvider');
    });
  });

  describe('useTranslation Hook', () => {
    it('should return translation function', () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      expect(result.current.t).toBeInstanceOf(Function);
      expect(result.current.i18n).toBeDefined();
      expect(result.current.ready).toBe(true);
    });

    it('should translate common action keys', () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      expect(result.current.t('common.actions.save')).toBe('Save');
      expect(result.current.t('common.actions.cancel')).toBe('Cancel');
      expect(result.current.t('common.actions.delete')).toBe('Delete');
    });

    it('should translate with interpolation', () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      const translated = result.current.t('common.validation.minLength', { min: 5 });
      expect(translated).toBe('Must be at least 5 characters');
    });

    it('should return different translations for different locales', async () => {
      const { result: localeResult } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      const { result: translationResult } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
      });

      // English
      expect(translationResult.current.t('common.actions.save')).toBe('Save');

      // Change to French
      await act(async () => {
        await localeResult.current.setLocale('fr-FR');
      });

      await waitFor(() => {
        expect(translationResult.current.t('common.actions.save')).toBe('Enregistrer');
      });
    });
  });

  describe('Translation Completeness', () => {
    const testKeys = [
      'common.actions.save',
      'common.actions.cancel',
      'common.status.active',
      'common.validation.required',
    ];

    SUPPORTED_LOCALES.forEach((locale) => {
      it(`should have all test keys in ${locale}`, () => {
        testKeys.forEach((key) => {
          const translation = i18n.t(key, { lng: locale });
          expect(translation).toBeTruthy();
          expect(translation).not.toBe(key); // Should not return the key itself
        });
      });
    });
  });
});
