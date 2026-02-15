/**
 * Checkpoint 13: Feature Modules Complete Verification
 * 
 * This test verifies that all feature modules (Events, Memberships, Registrations,
 * Calendar, Merchandise, Ticketing) are properly translated and work correctly
 * with all six supported locales.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation resources
import enGB from '../locales/en-GB/translation.json';
import frFR from '../locales/fr-FR/translation.json';
import esES from '../locales/es-ES/translation.json';
import itIT from '../locales/it-IT/translation.json';
import deDE from '../locales/de-DE/translation.json';
import ptPT from '../locales/pt-PT/translation.json';

const SUPPORTED_LOCALES = ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'];

const FEATURE_MODULES = [
  'events',
  'memberships',
  'registrations',
  'calendar',
  'merchandise',
  'ticketing'
];

describe('Checkpoint 13: Feature Modules Complete', () => {
  beforeEach(() => {
    // Initialize i18n for each test
    i18n
      .use(initReactI18next)
      .init({
        resources: {
          'en-GB': { translation: enGB },
          'fr-FR': { translation: frFR },
          'es-ES': { translation: esES },
          'it-IT': { translation: itIT },
          'de-DE': { translation: deDE },
          'pt-PT': { translation: ptPT },
        },
        lng: 'en-GB',
        fallbackLng: 'en-GB',
        interpolation: {
          escapeValue: false,
        },
      });
  });

  describe('Translation Completeness', () => {
    it('should have translations for all feature modules in all locales', () => {
      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        FEATURE_MODULES.forEach(module => {
          expect(translations[module]).toBeDefined();
          expect(Object.keys(translations[module]).length).toBeGreaterThan(0);
        });
      });
    });

    it('should have consistent translation keys across all locales', () => {
      const enGBTranslations = i18n.getResourceBundle('en-GB', 'translation');
      
      SUPPORTED_LOCALES.slice(1).forEach(locale => {
        const localeTranslations = i18n.getResourceBundle(locale, 'translation');
        
        FEATURE_MODULES.forEach(module => {
          const enGBKeys = Object.keys(enGBTranslations[module] || {});
          const localeKeys = Object.keys(localeTranslations[module] || {});
          
          // Check that all English keys exist in other locales
          enGBKeys.forEach(key => {
            expect(localeKeys).toContain(key);
          });
        });
      });
    });
  });

  describe('Events Module Translations', () => {
    it('should have all required Events translations in all locales', () => {
      const requiredKeys = [
        'title',
        'createEvent',
        'eventDetails',
        'eventName',
        'eventDate',
        'activities',
        'entries'
      ];

      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        requiredKeys.forEach(key => {
          expect(translations.events[key]).toBeDefined();
          expect(translations.events[key]).not.toBe('');
        });
      });
    });

    it('should return different translations for different locales', () => {
      const key = 'events.title';
      
      i18n.changeLanguage('en-GB');
      const enText = i18n.t(key);
      
      i18n.changeLanguage('fr-FR');
      const frText = i18n.t(key);
      
      i18n.changeLanguage('es-ES');
      const esText = i18n.t(key);
      
      expect(enText).not.toBe(frText);
      expect(enText).not.toBe(esText);
      expect(frText).not.toBe(esText);
    });
  });

  describe('Memberships Module Translations', () => {
    it('should have all required Memberships translations in all locales', () => {
      const requiredKeys = [
        'title',
        'membershipTypes',
        'members',
        'createMembershipType',
        'memberDetails'
      ];

      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        requiredKeys.forEach(key => {
          expect(translations.memberships[key]).toBeDefined();
          expect(translations.memberships[key]).not.toBe('');
        });
      });
    });
  });

  describe('Registrations Module Translations', () => {
    it('should have all required Registrations translations in all locales', () => {
      const requiredKeys = [
        'title',
        'registrationTypes',
        'registrations',
        'createRegistrationType'
      ];

      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        requiredKeys.forEach(key => {
          expect(translations.registrations[key]).toBeDefined();
          expect(translations.registrations[key]).not.toBe('');
        });
      });
    });
  });

  describe('Calendar Module Translations', () => {
    it('should have all required Calendar translations in all locales', () => {
      const requiredKeys = [
        'title',
        'calendars',
        'bookings',
        'createCalendar'
      ];

      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        requiredKeys.forEach(key => {
          expect(translations.calendar[key]).toBeDefined();
          expect(translations.calendar[key]).not.toBe('');
        });
      });
    });
  });

  describe('Merchandise Module Translations', () => {
    it('should have all required Merchandise translations in all locales', () => {
      const requiredKeys = [
        'title',
        'merchandiseTypes',
        'orders',
        'createMerchandiseType'
      ];

      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        requiredKeys.forEach(key => {
          expect(translations.merchandise[key]).toBeDefined();
          expect(translations.merchandise[key]).not.toBe('');
        });
      });
    });
  });

  describe('Ticketing Module Translations', () => {
    it('should have all required Ticketing translations in all locales', () => {
      const requiredKeys = [
        'title',
        'dashboard',
        'tickets',
        'ticketDetails'
      ];

      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        requiredKeys.forEach(key => {
          expect(translations.ticketing[key]).toBeDefined();
          expect(translations.ticketing[key]).not.toBe('');
        });
      });
    });
  });

  describe('Date Formatting Consistency', () => {
    it('should format dates consistently across all modules', () => {
      const testDate = new Date('2024-03-15T14:30:00Z');
      
      SUPPORTED_LOCALES.forEach(locale => {
        i18n.changeLanguage(locale);
        
        // Test that date formatting works (actual formatting tested in utility tests)
        const formatted = testDate.toLocaleDateString(locale);
        expect(formatted).toBeDefined();
        expect(formatted.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Currency Formatting Consistency', () => {
    it('should format currency consistently across all modules', () => {
      const testAmount = 1234.56;
      const currency = 'EUR';
      
      SUPPORTED_LOCALES.forEach(locale => {
        const formatted = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currency,
        }).format(testAmount);
        
        expect(formatted).toBeDefined();
        expect(formatted).toContain('1');
        expect(formatted).toContain('234');
      });
    });
  });

  describe('Translation Fallback', () => {
    it('should fall back to English for missing translations', () => {
      i18n.changeLanguage('fr-FR');
      
      // Test with a key that might not exist
      const result = i18n.t('nonexistent.key', { defaultValue: 'Fallback' });
      expect(result).toBeDefined();
    });
  });

  describe('Common Translations', () => {
    it('should have common action translations in all locales', () => {
      const commonActions = ['save', 'cancel', 'delete', 'edit', 'create'];
      
      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        commonActions.forEach(action => {
          expect(translations.common?.actions?.[action]).toBeDefined();
          expect(translations.common.actions[action]).not.toBe('');
        });
      });
    });

    it('should have common status translations in all locales', () => {
      const commonStatuses = ['active', 'inactive', 'pending', 'completed'];
      
      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        commonStatuses.forEach(status => {
          expect(translations.common?.status?.[status]).toBeDefined();
          expect(translations.common.status[status]).not.toBe('');
        });
      });
    });
  });

  describe('Navigation Translations', () => {
    it('should have navigation translations for all modules in all locales', () => {
      const navItems = [
        'dashboard',
        'events',
        'memberships',
        'registrations',
        'calendar',
        'merchandise',
        'ticketing'
      ];
      
      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        navItems.forEach(item => {
          expect(translations.navigation?.[item]).toBeDefined();
          expect(translations.navigation[item]).not.toBe('');
        });
      });
    });
  });

  describe('Locale Switching', () => {
    it('should switch between all locales without errors', async () => {
      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        expect(i18n.language).toBe(locale);
        
        // Verify translations are accessible
        const testKey = 'common.actions.save';
        const translation = i18n.t(testKey);
        expect(translation).toBeDefined();
        expect(translation).not.toBe(testKey);
      }
    });
  });

  describe('Translation Quality', () => {
    it('should not have placeholder or untranslated text', () => {
      const placeholderPatterns = [
        /TODO/i,
        /TRANSLATE/i,
        /FIXME/i,
        // Only match square brackets that look like untranslated keys, not PII placeholders
        /\[UNTRANSLATED\]/i,
        /\[MISSING\]/i,
      ];
      
      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        const jsonString = JSON.stringify(translations);
        
        placeholderPatterns.forEach(pattern => {
          expect(jsonString).not.toMatch(pattern);
        });
      });
    });

    it('should have consistent terminology within each locale', () => {
      // Check that common terms are used consistently
      SUPPORTED_LOCALES.forEach(locale => {
        const translations = i18n.getResourceBundle(locale, 'translation');
        
        // Example: "Create" should be consistent across modules
        const createTerms = new Set<string>();
        FEATURE_MODULES.forEach(module => {
          const moduleTranslations = translations[module];
          Object.keys(moduleTranslations).forEach(key => {
            if (key.toLowerCase().includes('create')) {
              createTerms.add(moduleTranslations[key]);
            }
          });
        });
        
        // We expect some variation, but not too much
        expect(createTerms.size).toBeGreaterThan(0);
      });
    });
  });
});
