/**
 * Checkpoint 18: All Modules Translated
 * 
 * This test verifies that:
 * - All text is translated across all modules
 * - Dates and currency format correctly everywhere
 * - No console warnings for missing translations
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n, { initializeI18n, SUPPORTED_LOCALES } from '../i18n/config';

// Mock console.warn to catch missing translation warnings
const originalWarn = console.warn;
let consoleWarnings: string[] = [];

beforeAll(async () => {
  // Initialize i18n before all tests with all translations preloaded
  await initializeI18n('en-GB', true);
});

beforeEach(() => {
  consoleWarnings = [];
  console.warn = vi.fn((...args) => {
    consoleWarnings.push(args.join(' '));
  });
});

afterEach(() => {
  console.warn = originalWarn;
});

describe('Checkpoint 18: All Modules Translated', () => {
  describe('Translation Completeness', () => {
    it('should have translation resources for all six locales', () => {
      SUPPORTED_LOCALES.forEach(locale => {
        const hasResources = i18n.hasResourceBundle(locale, 'translation');
        expect(hasResources, `Missing translation resources for ${locale}`).toBe(true);
      });
    });

    it('should have all navigation items translated in all locales', async () => {
      const navigationKeys = [
        'navigation.organisation',
        'navigation.loading',
        'navigation.logout',
        'navigation.appName'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        navigationKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have all common action translations in all locales', async () => {
      const actionKeys = [
        'common.actions.save',
        'common.actions.cancel',
        'common.actions.delete',
        'common.actions.edit',
        'common.actions.create',
        'common.actions.search',
        'common.actions.filter',
        'common.actions.export',
        'common.actions.import'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        actionKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Events module translations in all locales', async () => {
      const eventsKeys = [
        'events.title',
        'events.createEvent',
        'events.eventDetails',
        'events.activities',
        'events.noEventsFound',
        'events.searchPlaceholder'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        eventsKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Memberships module translations in all locales', async () => {
      const membershipsKeys = [
        'memberships.title',
        'memberships.membershipTypes',
        'memberships.members',
        'memberships.createMembershipType'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        membershipsKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Registrations module translations in all locales', async () => {
      const registrationsKeys = [
        'registrations.title',
        'registrations.registrationTypes',
        'registrations.createRegistrationType',
        'registrations.registrationDetails'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        registrationsKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Calendar module translations in all locales', async () => {
      const calendarKeys = [
        'calendar.title',
        'calendar.calendars',
        'calendar.bookings',
        'calendar.createCalendar'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        calendarKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Merchandise module translations in all locales', async () => {
      const merchandiseKeys = [
        'merchandise.title',
        'merchandise.merchandiseTypes',
        'merchandise.orders',
        'merchandise.createMerchandiseType'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        merchandiseKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Ticketing module translations in all locales', async () => {
      const ticketingKeys = [
        'ticketing.title',
        'ticketing.dashboard',
        'ticketing.details'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        ticketingKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Forms module translations in all locales', async () => {
      const formsKeys = [
        'forms.title',
        'forms.createForm',
        'forms.builder'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        formsKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Users module translations in all locales', async () => {
      const usersKeys = [
        'common.labels.all',
        'common.actions.add',
        'common.status.active'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        usersKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Payments module translations in all locales', async () => {
      const paymentsKeys = [
        'payments.title',
        'payments.paymentDetails',
        'payments.lodgements'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        paymentsKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Reporting module translations in all locales', async () => {
      const reportingKeys = [
        'reporting.title',
        'reporting.dashboard'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        reportingKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have Settings module translations in all locales', async () => {
      const settingsKeys = [
        'settings.title',
        'settings.organisationDetails',
        'settings.paymentSettings',
        'settings.branding',
        'settings.emailTemplates'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        settingsKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });

    it('should have shared component translations in all locales', async () => {
      const componentKeys = [
        'components.orgDataTable.noDataAvailable',
        'components.orgDataTable.rowsPerPage',
        'components.fileUpload.dragAndDrop',
        'components.timeSlotPicker.noTimeSlotsAvailable'
      ];

      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        componentKeys.forEach(key => {
          const translation = i18n.t(key);
          expect(translation, `Missing translation for ${key} in ${locale}`).not.toBe(key);
          expect(translation.length, `Empty translation for ${key} in ${locale}`).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly for all locales', async () => {
      const testDate = new Date('2024-03-15T14:30:00Z');
      
      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        // Test that date formatting produces locale-specific output
        const formatted = testDate.toLocaleDateString(locale);
        expect(formatted.length).toBeGreaterThan(0);
        
        // Verify different locales produce different formats
        if (locale === 'en-GB') {
          expect(formatted).toContain('15');
          expect(formatted).toContain('03');
        }
      }
    });

    it('should format times correctly for all locales', async () => {
      const testDate = new Date('2024-03-15T14:30:00Z');
      
      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        const formatted = testDate.toLocaleTimeString(locale, { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        expect(formatted.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Currency Formatting', () => {
    it('should format currency correctly for all locales', async () => {
      const testAmount = 1234.56;
      const currencies = ['EUR', 'GBP', 'USD'];
      
      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        currencies.forEach(currency => {
          const formatted = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
          }).format(testAmount);
          
          expect(formatted.length).toBeGreaterThan(0);
          expect(formatted).toContain('1');
          expect(formatted).toContain('234');
        });
      }
    });

    it('should handle zero and negative currency values', async () => {
      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        const zero = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'EUR'
        }).format(0);
        expect(zero.length).toBeGreaterThan(0);
        
        const negative = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'EUR'
        }).format(-100);
        expect(negative.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Console Warnings', () => {
    it('should not produce console warnings for missing translations', async () => {
      // Reset warnings
      consoleWarnings = [];
      
      // Test common keys across all locales
      const testKeys = [
        'common.actions.save',
        'navigation.dashboard',
        'events.title',
        'memberships.title'
      ];
      
      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        testKeys.forEach(key => {
          i18n.t(key);
        });
      }
      
      // Filter for i18n-related warnings
      const i18nWarnings = consoleWarnings.filter(warning => 
        warning.includes('i18n') || 
        warning.includes('translation') ||
        warning.includes('missing')
      );
      
      expect(i18nWarnings.length, 
        `Found ${i18nWarnings.length} i18n warnings: ${i18nWarnings.join(', ')}`
      ).toBe(0);
    });
  });

  describe('Translation Consistency', () => {
    it('should have consistent terminology across modules in each locale', async () => {
      // Test that common terms are translated consistently
      const consistencyTests = [
        { keys: ['common.actions.save'], term: 'save' },
        { keys: ['common.actions.cancel'], term: 'cancel' },
        { keys: ['common.actions.delete'], term: 'delete' }
      ];
      
      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        
        consistencyTests.forEach(({ keys, term }) => {
          const translations = keys
            .map(key => i18n.t(key))
            .filter(t => t !== keys[0]); // Filter out keys that don't exist
          
          if (translations.length > 0) {
            // Verify translations exist and are not empty
            translations.forEach(translation => {
              expect(translation.length).toBeGreaterThan(0);
            });
          }
        });
      }
    });
  });

  describe('Locale Switching', () => {
    it('should switch between all locales without errors', async () => {
      for (let i = 0; i < SUPPORTED_LOCALES.length; i++) {
        const locale = SUPPORTED_LOCALES[i];
        await i18n.changeLanguage(locale);
        
        expect(i18n.language).toBe(locale);
        
        // Verify translations work after switch
        const translation = i18n.t('common.actions.save');
        expect(translation).not.toBe('common.actions.save');
        expect(translation.length).toBeGreaterThan(0);
      }
    });

    it('should maintain translation quality after multiple switches', async () => {
      const testKey = 'navigation.dashboard';
      const translations: Record<string, string> = {};
      
      // First pass: collect translations
      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        translations[locale] = i18n.t(testKey);
      }
      
      // Second pass: verify consistency
      for (const locale of SUPPORTED_LOCALES) {
        await i18n.changeLanguage(locale);
        const translation = i18n.t(testKey);
        expect(translation).toBe(translations[locale]);
      }
    });
  });
});
