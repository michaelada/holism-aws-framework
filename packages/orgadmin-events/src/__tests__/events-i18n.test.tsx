/**
 * Unit Tests for Events Module i18n
 * 
 * Tests that Events components display translated text correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation resources
import enGB from '../../../orgadmin-shell/src/locales/en-GB/translation.json';
import frFR from '../../../orgadmin-shell/src/locales/fr-FR/translation.json';

// Mock the hooks
vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  const actual = await vi.importActual('@aws-web-framework/orgadmin-shell');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: any) => {
        return testI18n.t(key, options);
      },
      i18n: testI18n,
      ready: true,
    }),
    useLocale: () => ({
      locale: testI18n.language,
      setLocale: (locale: string) => testI18n.changeLanguage(locale),
      isLoading: false,
    }),
    formatDate: (date: Date | string, format: string, locale: string) => {
      return new Date(date).toLocaleDateString(locale);
    },
    formatDateTime: (date: Date | string, locale: string) => {
      return new Date(date).toLocaleString(locale);
    },
    formatCurrency: (amount: number, currency: string, locale: string) => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
      }).format(amount);
    },
  };
});

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useApi: () => ({
    execute: vi.fn().mockResolvedValue([]),
  }),
  useOrganisation: () => ({
    organisation: { id: '1', name: 'Test Org' },
  }),
}));

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
const createWrapper = (locale: string = 'en-GB') => {
  testI18n.changeLanguage(locale);
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <I18nextProvider i18n={testI18n}>
        {children}
      </I18nextProvider>
    </BrowserRouter>
  );
};

describe('Events Module i18n Unit Tests', () => {
  beforeEach(() => {
    testI18n.changeLanguage('en-GB');
  });

  describe('Translation Keys Existence', () => {
    it('should have all required Events translation keys in English', () => {
      const requiredKeys = [
        'events.title',
        'events.createEvent',
        'events.searchPlaceholder',
        'events.table.eventName',
        'events.table.dates',
        'events.table.status',
        'events.basicInfo.title',
        'events.basicInfo.eventName',
        'events.dates.title',
        'events.activities.title',
        'events.review.title',
      ];

      requiredKeys.forEach(key => {
        expect(testI18n.exists(key)).toBe(true);
        const translation = testI18n.t(key);
        expect(translation).toBeTruthy();
        expect(translation).not.toBe(key);
      });
    });

    it('should have all required Events translation keys in French', () => {
      testI18n.changeLanguage('fr-FR');
      
      const requiredKeys = [
        'events.title',
        'events.createEvent',
        'events.searchPlaceholder',
        'events.table.eventName',
        'events.basicInfo.title',
      ];

      requiredKeys.forEach(key => {
        expect(testI18n.exists(key)).toBe(true);
        const translation = testI18n.t(key);
        expect(translation).toBeTruthy();
        expect(translation).not.toBe(key);
      });
    });
  });

  describe('Common Translation Keys', () => {
    it('should have all common action translations', () => {
      const actions = ['save', 'cancel', 'edit', 'delete', 'create', 'add'];
      
      actions.forEach(action => {
        const key = `common.actions.${action}`;
        expect(testI18n.exists(key)).toBe(true);
        const translation = testI18n.t(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have all common status translations', () => {
      const statuses = ['draft', 'published', 'cancelled', 'completed', 'paid', 'pending'];
      
      statuses.forEach(status => {
        const key = `common.status.${status}`;
        expect(testI18n.exists(key)).toBe(true);
        const translation = testI18n.t(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have all common label translations', () => {
      const labels = ['all', 'unlimited', 'free', 'enabled', 'disabled'];
      
      labels.forEach(label => {
        const key = `common.labels.${label}`;
        expect(testI18n.exists(key)).toBe(true);
        const translation = testI18n.t(key);
        expect(translation).toBeTruthy();
      });
    });
  });

  describe('Locale Switching', () => {
    it('should return English translations when locale is en-GB', () => {
      testI18n.changeLanguage('en-GB');
      
      expect(testI18n.t('events.title')).toBe('Events');
      expect(testI18n.t('events.createEvent')).toBe('Create Event');
      expect(testI18n.t('common.actions.save')).toBe('Save');
    });

    it('should return French translations when locale is fr-FR', () => {
      testI18n.changeLanguage('fr-FR');
      
      expect(testI18n.t('events.title')).toBe('Événements');
      expect(testI18n.t('events.createEvent')).toBe('Créer un événement');
      expect(testI18n.t('common.actions.save')).toBe('Enregistrer');
    });

    it('should update translations when switching between locales', () => {
      testI18n.changeLanguage('en-GB');
      const enTitle = testI18n.t('events.title');
      
      testI18n.changeLanguage('fr-FR');
      const frTitle = testI18n.t('events.title');
      
      expect(enTitle).not.toBe(frTitle);
      expect(enTitle).toBe('Events');
      expect(frTitle).toBe('Événements');
    });
  });

  describe('Interpolation', () => {
    it('should correctly interpolate activity number', () => {
      testI18n.changeLanguage('en-GB');
      const translation = testI18n.t('events.activities.activity.activityNumber', { number: 5 });
      
      expect(translation).toContain('5');
      expect(translation).toContain('Activity');
    });

    it('should correctly interpolate activity count and type', () => {
      testI18n.changeLanguage('en-GB');
      const translation = testI18n.t('events.review.activitiesConfigured', { 
        count: 3, 
        type: 'activities' 
      });
      
      expect(translation).toContain('3');
      expect(translation).toContain('configured');
    });

    it('should interpolate correctly in French', () => {
      testI18n.changeLanguage('fr-FR');
      const translation = testI18n.t('events.activities.activity.activityNumber', { number: 2 });
      
      expect(translation).toContain('2');
      expect(translation).toContain('Activité');
    });
  });

  describe('Missing Translation Fallback', () => {
    it('should return key for completely missing translations', () => {
      const missingKey = 'events.nonexistent.key';
      const translation = testI18n.t(missingKey);
      
      // i18next returns the key itself when translation is missing
      expect(translation).toBe(missingKey);
    });

    it('should not crash when accessing nested missing keys', () => {
      const missingKeys = [
        'events.missing.nested.key',
        'events.basicInfo.nonexistent',
        'events.activities.missing',
      ];
      
      missingKeys.forEach(key => {
        expect(() => testI18n.t(key)).not.toThrow();
        const translation = testI18n.t(key);
        expect(typeof translation).toBe('string');
      });
    });
  });

  describe('Validation Messages', () => {
    it('should have validation messages for Events', () => {
      expect(testI18n.exists('events.basicInfo.validation.nameRequired')).toBe(true);
      expect(testI18n.exists('events.basicInfo.validation.descriptionRequired')).toBe(true);
      expect(testI18n.exists('events.activities.validation.atLeastOne')).toBe(true);
    });

    it('should have common validation messages', () => {
      expect(testI18n.exists('common.validation.required')).toBe(true);
      expect(testI18n.exists('common.validation.invalidEmail')).toBe(true);
      expect(testI18n.exists('common.validation.invalidDate')).toBe(true);
    });
  });

  describe('Wizard Steps', () => {
    it('should have all wizard step translations', () => {
      const steps = [
        'basicInfo',
        'eventDates',
        'ticketingSettings',
        'activities',
        'reviewConfirm',
      ];
      
      steps.forEach(step => {
        const key = `events.wizard.steps.${step}`;
        expect(testI18n.exists(key)).toBe(true);
        const translation = testI18n.t(key);
        expect(translation).toBeTruthy();
        expect(translation).not.toBe(key);
      });
    });
  });

  describe('Activity Form Translations', () => {
    it('should have all activity form field translations', () => {
      const fields = [
        'name',
        'description',
        'showPublicly',
        'applicationForm',
        'fee',
        'allowedPaymentMethod',
      ];
      
      fields.forEach(field => {
        const key = `events.activities.activity.${field}`;
        expect(testI18n.exists(key)).toBe(true);
      });
    });

    it('should have payment method translations', () => {
      const methods = ['card', 'cheque', 'both'];
      
      methods.forEach(method => {
        const key = `events.activities.activity.paymentMethods.${method}`;
        expect(testI18n.exists(key)).toBe(true);
        const translation = testI18n.t(key);
        expect(translation).toBeTruthy();
      });
    });
  });

  describe('Entry Details Translations', () => {
    it('should have all entry details field translations', () => {
      const fields = [
        'title',
        'firstName',
        'lastName',
        'email',
        'quantity',
        'paymentStatus',
        'paymentMethod',
        'entryDate',
      ];
      
      fields.forEach(field => {
        const key = `events.entryDetails.${field}`;
        expect(testI18n.exists(key)).toBe(true);
      });
    });
  });

  describe('Tooltips and Helper Text', () => {
    it('should have tooltip translations for basic info fields', () => {
      const tooltips = [
        'eventNameTooltip',
        'eventDescriptionTooltip',
        'emailNotificationsTooltip',
        'limitEntriesTooltip',
      ];
      
      tooltips.forEach(tooltip => {
        const key = `events.basicInfo.${tooltip}`;
        expect(testI18n.exists(key)).toBe(true);
        const translation = testI18n.t(key);
        expect(translation).toBeTruthy();
        expect(translation.length).toBeGreaterThan(10); // Tooltips should be descriptive
      });
    });

    it('should have helper text translations', () => {
      const helpers = [
        'eventNameHelper',
        'eventDescriptionHelper',
        'emailNotificationsHelper',
      ];
      
      helpers.forEach(helper => {
        const key = `events.basicInfo.${helper}`;
        expect(testI18n.exists(key)).toBe(true);
      });
    });
  });
});
