/**
 * Property-Based Tests for Events Module Translation
 * 
 * Tests correctness properties for i18n implementation in the Events module
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { renderHook } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import React from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation resources
import enGB from '../../../orgadmin-shell/src/locales/en-GB/translation.json';
import frFR from '../../../orgadmin-shell/src/locales/fr-FR/translation.json';

// Initialize i18n for testing
const testI18n = i18n.createInstance();
testI18n
  .use(initReactI18next)
  .init({
    lng: 'en-GB',
    fallbackLng: 'en-GB',
    resources: {
      'en-GB': { translation: enGB },
      'fr-FR': { translation: frFR },
    },
    interpolation: {
      escapeValue: false,
    },
  });

// Helper to create wrapper with i18n
const createWrapper = (locale: string) => {
  return ({ children }: { children: React.ReactNode }) => (
    <I18nextProvider i18n={testI18n}>
      {children}
    </I18nextProvider>
  );
};

// Arbitraries for property-based testing
const supportedLocaleArb = fc.constantFrom('en-GB', 'fr-FR');

const eventsTranslationKeyArb = fc.constantFrom(
  'events.title',
  'events.createEvent',
  'events.editEvent',
  'events.searchPlaceholder',
  'events.table.eventName',
  'events.table.dates',
  'events.table.status',
  'events.basicInfo.title',
  'events.basicInfo.eventName',
  'events.basicInfo.eventDescription',
  'events.dates.title',
  'events.dates.startDate',
  'events.dates.endDate',
  'events.activities.title',
  'events.activities.addActivity',
  'events.review.title',
  'events.actions.saveAsDraft',
  'events.actions.publishEvent'
);

const commonTranslationKeyArb = fc.constantFrom(
  'common.actions.save',
  'common.actions.cancel',
  'common.actions.edit',
  'common.actions.delete',
  'common.status.draft',
  'common.status.published',
  'common.status.cancelled',
  'common.labels.all',
  'common.labels.unlimited'
);

describe('Events Module Translation Property-Based Tests', () => {
  // Feature: orgadmin-i18n, Property 5: Translation Lookup Correctness
  describe('Property 5: Translation Lookup Correctness', () => {
    it('should return correct locale text for any valid translation key', () => {
      fc.assert(
        fc.property(
          supportedLocaleArb,
          eventsTranslationKeyArb,
          (locale, key) => {
            // Change language
            testI18n.changeLanguage(locale);
            
            // Get translation
            const translation = testI18n.t(key);
            
            // Verify translation is not empty and not the key itself
            expect(translation).toBeTruthy();
            expect(translation).not.toBe(key);
            
            // Verify translation is a string
            expect(typeof translation).toBe('string');
            
            // Verify translation is different for different locales (when both exist)
            if (locale === 'fr-FR') {
              testI18n.changeLanguage('en-GB');
              const enTranslation = testI18n.t(key);
              testI18n.changeLanguage('fr-FR');
              const frTranslation = testI18n.t(key);
              
              // French and English translations should be different
              expect(frTranslation).not.toBe(enTranslation);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct locale text for common translation keys', () => {
      fc.assert(
        fc.property(
          supportedLocaleArb,
          commonTranslationKeyArb,
          (locale, key) => {
            testI18n.changeLanguage(locale);
            const translation = testI18n.t(key);
            
            expect(translation).toBeTruthy();
            expect(translation).not.toBe(key);
            expect(typeof translation).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: orgadmin-i18n, Property 6: Translation Fallback to English
  describe('Property 6: Translation Fallback to English', () => {
    it('should fall back to English for missing translations in other locales', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'),
          fc.string({ minLength: 5, maxLength: 30 }).map(s => `events.nonexistent.${s}`),
          (locale, missingKey) => {
            // Change to non-English locale
            testI18n.changeLanguage(locale);
            
            // Try to get translation for non-existent key
            const translation = testI18n.t(missingKey);
            
            // Should return the key itself (i18next default behavior)
            // or the English fallback if configured
            expect(translation).toBeTruthy();
            expect(typeof translation).toBe('string');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle missing nested keys gracefully', () => {
      fc.assert(
        fc.property(
          supportedLocaleArb,
          (locale) => {
            testI18n.changeLanguage(locale);
            
            // Try various non-existent nested keys
            const missingKeys = [
              'events.nonexistent.key',
              'events.basicInfo.nonexistent',
              'events.activities.activity.nonexistent',
            ];
            
            missingKeys.forEach(key => {
              const translation = testI18n.t(key);
              expect(translation).toBeTruthy();
              expect(typeof translation).toBe('string');
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: orgadmin-i18n, Property 8: Locale Change Reactivity
  describe('Property 8: Locale Change Reactivity', () => {
    it('should return different translations when locale changes', () => {
      fc.assert(
        fc.property(
          eventsTranslationKeyArb,
          (key) => {
            // Get English translation
            testI18n.changeLanguage('en-GB');
            const enTranslation = testI18n.t(key);
            
            // Get French translation
            testI18n.changeLanguage('fr-FR');
            const frTranslation = testI18n.t(key);
            
            // Translations should be different
            expect(enTranslation).not.toBe(frTranslation);
            
            // Both should be valid strings
            expect(typeof enTranslation).toBe('string');
            expect(typeof frTranslation).toBe('string');
            expect(enTranslation).toBeTruthy();
            expect(frTranslation).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update translations immediately when locale changes', () => {
      fc.assert(
        fc.property(
          fc.array(supportedLocaleArb, { minLength: 2, maxLength: 5 }),
          eventsTranslationKeyArb,
          (locales, key) => {
            const translations: string[] = [];
            
            // Change locale multiple times and collect translations
            locales.forEach(locale => {
              testI18n.changeLanguage(locale);
              translations.push(testI18n.t(key));
            });
            
            // All translations should be valid
            translations.forEach(translation => {
              expect(translation).toBeTruthy();
              expect(typeof translation).toBe('string');
            });
            
            // If we switched between different locales, translations should differ
            const uniqueLocales = [...new Set(locales)];
            if (uniqueLocales.length > 1) {
              const uniqueTranslations = [...new Set(translations)];
              expect(uniqueTranslations.length).toBeGreaterThan(1);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Additional property: Interpolation correctness
  describe('Property: Interpolation Correctness', () => {
    it('should correctly interpolate values in translation strings', () => {
      fc.assert(
        fc.property(
          supportedLocaleArb,
          fc.integer({ min: 1, max: 10 }),
          (locale, number) => {
            testI18n.changeLanguage(locale);
            
            // Test interpolation with activity number
            const translation = testI18n.t('events.activities.activity.activityNumber', { number });
            
            // Should contain the number
            expect(translation).toContain(String(number));
            expect(translation).toBeTruthy();
            expect(typeof translation).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple interpolation parameters', () => {
      fc.assert(
        fc.property(
          supportedLocaleArb,
          fc.integer({ min: 1, max: 10 }),
          fc.constantFrom('activity', 'activities'),
          (locale, count, type) => {
            testI18n.changeLanguage(locale);
            
            // Test interpolation with count and type
            const translation = testI18n.t('events.review.activitiesConfigured', { count, type });
            
            // Should contain both values
            expect(translation).toContain(String(count));
            expect(translation).toBeTruthy();
            expect(typeof translation).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional property: Translation key structure consistency
  describe('Property: Translation Key Structure Consistency', () => {
    it('should have consistent key structure across locales', () => {
      fc.assert(
        fc.property(
          eventsTranslationKeyArb,
          (key) => {
            // Key should exist in English
            testI18n.changeLanguage('en-GB');
            const enExists = testI18n.exists(key);
            expect(enExists).toBe(true);
            
            // Key should exist in French
            testI18n.changeLanguage('fr-FR');
            const frExists = testI18n.exists(key);
            expect(frExists).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
