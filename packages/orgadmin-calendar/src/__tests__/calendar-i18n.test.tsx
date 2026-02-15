/**
 * Unit Tests for Calendar Module i18n
 * 
 * Tests that Calendar components display translated text correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation resources
import enGB from '../../../orgadmin-shell/src/locales/en-GB/translation.json';
import frFR from '../../../orgadmin-shell/src/locales/fr-FR/translation.json';
import esES from '../../../orgadmin-shell/src/locales/es-ES/translation.json';
import deDE from '../../../orgadmin-shell/src/locales/de-DE/translation.json';
import itIT from '../../../orgadmin-shell/src/locales/it-IT/translation.json';
import ptPT from '../../../orgadmin-shell/src/locales/pt-PT/translation.json';

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
      'es-ES': { translation: esES },
      'de-DE': { translation: deDE },
      'it-IT': { translation: itIT },
      'pt-PT': { translation: ptPT },
    },
    interpolation: {
      escapeValue: false,
    },
  });

describe('Calendar Module i18n Unit Tests', () => {
  beforeEach(() => {
    testI18n.changeLanguage('en-GB');
  });

  describe('Translation Keys Existence', () => {
    it('should have all required Calendar translation keys in English', () => {
      const requiredKeys = [
        'calendar.title',
        'calendar.calendars',
        'calendar.bookings',
        'calendar.createCalendar',
        'calendar.editCalendar',
        'calendar.searchCalendarsPlaceholder',
        'calendar.searchBookingsPlaceholder',
        'calendar.noCalendarsFound',
        'calendar.noBookingsFound',
        'calendar.loadingCalendars',
        'calendar.loadingBookings',
        'calendar.table.name',
        'calendar.table.description',
        'calendar.table.status',
        'calendar.table.actions',
        'calendar.table.bookingReference',
        'calendar.table.calendar',
        'calendar.table.user',
        'calendar.table.date',
        'calendar.table.time',
        'calendar.table.duration',
        'calendar.table.price',
        'calendar.statusOptions.open',
        'calendar.statusOptions.closed',
        'calendar.sections.basicInfo',
        'calendar.sections.automatedSchedule',
        'calendar.sections.bookingWindow',
        'calendar.sections.termsAndConditions',
        'calendar.sections.cancellationPolicy',
        'calendar.sections.emailNotifications',
        'calendar.fields.calendarName',
        'calendar.fields.description',
        'calendar.fields.displayColour',
        'calendar.fields.status',
        'calendar.fields.enableAutomatedSchedule',
        'calendar.fields.minDaysInAdvance',
        'calendar.fields.maxDaysInAdvance',
        'calendar.fields.useTermsAndConditions',
        'calendar.fields.termsAndConditions',
        'calendar.fields.allowCancellations',
        'calendar.fields.cancelDaysInAdvance',
        'calendar.fields.refundPaymentAutomatically',
        'calendar.fields.adminNotificationEmails',
        'calendar.fields.sendReminderEmails',
        'calendar.fields.reminderHoursBefore',
        'calendar.fields.cancellationReason',
        'calendar.fields.processRefund',
        'calendar.cancelBooking.title',
        'calendar.cancelBooking.message',
        'calendar.cancelBooking.confirmButton',
        'calendar.actions.exportToExcel',
        'calendar.duration.minutes',
      ];

      requiredKeys.forEach(key => {
        const translation = testI18n.t(key);
        expect(translation, `Key "${key}" should have a translation`).not.toBe(key);
        expect(translation, `Key "${key}" should not be empty`).toBeTruthy();
      });
    });

    it('should have all required Calendar translation keys in all six languages', () => {
      const locales = ['en-GB', 'fr-FR', 'es-ES', 'de-DE', 'it-IT', 'pt-PT'];
      const keysToTest = [
        'calendar.title',
        'calendar.createCalendar',
        'calendar.table.name',
        'calendar.sections.basicInfo',
        'calendar.cancelBooking.title',
      ];

      locales.forEach(locale => {
        testI18n.changeLanguage(locale);
        keysToTest.forEach(key => {
          const translation = testI18n.t(key);
          expect(translation, `Key "${key}" in locale "${locale}" should have a translation`).not.toBe(key);
          expect(translation, `Key "${key}" in locale "${locale}" should not be empty`).toBeTruthy();
        });
      });
    });
  });

  describe('Translation Content Verification', () => {
    it('should have correct English translations', () => {
      testI18n.changeLanguage('en-GB');
      
      expect(testI18n.t('calendar.title')).toBe('Calendar');
      expect(testI18n.t('calendar.createCalendar')).toBe('Create Calendar');
      expect(testI18n.t('calendar.bookings')).toBe('Bookings');
      expect(testI18n.t('calendar.table.name')).toBe('Name');
      expect(testI18n.t('calendar.statusOptions.open')).toBe('Open');
      expect(testI18n.t('calendar.statusOptions.closed')).toBe('Closed');
    });

    it('should have correct French translations', () => {
      testI18n.changeLanguage('fr-FR');
      
      expect(testI18n.t('calendar.title')).toBe('Calendrier');
      expect(testI18n.t('calendar.createCalendar')).toBe('Créer un calendrier');
      expect(testI18n.t('calendar.bookings')).toBe('Réservations');
      expect(testI18n.t('calendar.table.name')).toBe('Nom');
      expect(testI18n.t('calendar.statusOptions.open')).toBe('Ouvert');
      expect(testI18n.t('calendar.statusOptions.closed')).toBe('Fermé');
    });

    it('should have correct Spanish translations', () => {
      testI18n.changeLanguage('es-ES');
      
      expect(testI18n.t('calendar.title')).toBe('Calendario');
      expect(testI18n.t('calendar.createCalendar')).toBe('Crear calendario');
      expect(testI18n.t('calendar.bookings')).toBe('Reservas');
    });

    it('should have correct German translations', () => {
      testI18n.changeLanguage('de-DE');
      
      expect(testI18n.t('calendar.title')).toBe('Kalender');
      expect(testI18n.t('calendar.createCalendar')).toBe('Kalender erstellen');
      expect(testI18n.t('calendar.bookings')).toBe('Buchungen');
    });

    it('should have correct Italian translations', () => {
      testI18n.changeLanguage('it-IT');
      
      expect(testI18n.t('calendar.title')).toBe('Calendario');
      expect(testI18n.t('calendar.createCalendar')).toBe('Crea calendario');
      expect(testI18n.t('calendar.bookings')).toBe('Prenotazioni');
    });

    it('should have correct Portuguese translations', () => {
      testI18n.changeLanguage('pt-PT');
      
      expect(testI18n.t('calendar.title')).toBe('Calendário');
      expect(testI18n.t('calendar.createCalendar')).toBe('Criar calendário');
      expect(testI18n.t('calendar.bookings')).toBe('Reservas');
    });
  });

  describe('Translation Interpolation', () => {
    it('should correctly interpolate booking reference in cancel message', () => {
      testI18n.changeLanguage('en-GB');
      const message = testI18n.t('calendar.cancelBooking.message', { reference: 'BK-001' });
      expect(message).toContain('BK-001');
      expect(message).toContain('cancel');
    });

    it('should correctly interpolate duration minutes', () => {
      testI18n.changeLanguage('en-GB');
      const duration = testI18n.t('calendar.duration.minutes', { count: 60 });
      expect(duration).toContain('60');
      expect(duration).toContain('min');
    });
  });

  describe('Date and Currency Formatting', () => {
    it('should format dates according to locale', () => {
      const date = new Date('2024-01-15');
      
      const enDate = date.toLocaleDateString('en-GB');
      expect(enDate).toBe('15/01/2024');
      
      const frDate = date.toLocaleDateString('fr-FR');
      expect(frDate).toBe('15/01/2024');
      
      const deDate = date.toLocaleDateString('de-DE');
      expect(deDate).toBe('15.1.2024');
    });

    it('should format currency according to locale', () => {
      const amount = 1234.56;
      
      const enCurrency = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount);
      expect(enCurrency).toContain('1,234.56');
      
      const deCurrency = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount);
      expect(deCurrency).toContain('1.234,56');
      
      const frCurrency = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount);
      // French uses non-breaking space, so just check for the numbers
      expect(frCurrency).toMatch(/1[\s\u202f]234,56/);
    });

    it('should format time according to locale', () => {
      const date = new Date('2024-01-15T14:30:00');
      
      const enTime = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      expect(enTime).toBe('14:30');
      
      const frTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      expect(frTime).toBe('14:30');
    });
  });

  describe('Locale Switching', () => {
    it('should update translations when locale changes', () => {
      testI18n.changeLanguage('en-GB');
      expect(testI18n.t('calendar.title')).toBe('Calendar');
      
      testI18n.changeLanguage('pt-PT');
      expect(testI18n.t('calendar.title')).toBe('Calendário');
      
      testI18n.changeLanguage('it-IT');
      expect(testI18n.t('calendar.title')).toBe('Calendario');
    });

    it('should maintain translation context across locale changes', () => {
      const locales = ['en-GB', 'fr-FR', 'es-ES', 'de-DE', 'it-IT', 'pt-PT'];
      
      locales.forEach(locale => {
        testI18n.changeLanguage(locale);
        const title = testI18n.t('calendar.title');
        const createButton = testI18n.t('calendar.createCalendar');
        
        // Both should be translated (not equal to the key)
        expect(title).not.toBe('calendar.title');
        expect(createButton).not.toBe('calendar.createCalendar');
        
        // Both should have content
        expect(title.length).toBeGreaterThan(0);
        expect(createButton.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to English for missing translations', () => {
      testI18n.changeLanguage('fr-FR');
      
      // Test with a key that exists
      const existingKey = testI18n.t('calendar.title');
      expect(existingKey).not.toBe('calendar.title');
      
      // Test with a non-existent key (should return the key itself)
      const missingKey = testI18n.t('calendar.nonExistentKey');
      expect(missingKey).toBe('calendar.nonExistentKey');
    });
  });
});
