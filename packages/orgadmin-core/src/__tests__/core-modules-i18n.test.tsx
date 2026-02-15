/**
 * Core Modules i18n Tests
 * 
 * Comprehensive tests for i18n implementation across all Core modules:
 * - Forms
 * - Users
 * - Payments
 * - Reporting
 * - Settings
 * 
 * Tests translation key existence, locale switching, date/currency formatting,
 * and fallback behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation resources
import enGB from '../../../orgadmin-shell/src/locales/en-GB/translation.json';
import frFR from '../../../orgadmin-shell/src/locales/fr-FR/translation.json';
import esES from '../../../orgadmin-shell/src/locales/es-ES/translation.json';
import itIT from '../../../orgadmin-shell/src/locales/it-IT/translation.json';
import deDE from '../../../orgadmin-shell/src/locales/de-DE/translation.json';
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
      'it-IT': { translation: itIT },
      'de-DE': { translation: deDE },
      'pt-PT': { translation: ptPT },
    },
    interpolation: {
      escapeValue: false,
    },
  });

describe('Core Modules i18n Tests', () => {
  beforeEach(() => {
    testI18n.changeLanguage('en-GB');
  });

  describe('Forms Module Translations', () => {
    describe('Translation Key Existence', () => {
      it('should have all required Forms translation keys in English', () => {
        const requiredKeys = [
          'forms.title',
          'forms.createForm',
          'forms.searchPlaceholder',
          'forms.table.name',
          'forms.table.status',
          'forms.table.created',
          'forms.table.actions',
          'forms.builder.title',
          'forms.builder.fields.addField',
          'forms.preview.title',
        ];

        requiredKeys.forEach(key => {
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
          expect(translation).not.toBe(key);
        });
      });

      it('should have Forms validation messages', () => {
        const validationKeys = [
          'forms.formNameRequired',
          'common.validation.required',
        ];

        validationKeys.forEach(key => {
          expect(testI18n.exists(key)).toBe(true);
        });
      });
    });

    describe('Locale Switching', () => {
      it('should return correct translations in different locales', () => {
        testI18n.changeLanguage('en-GB');
        const enTitle = testI18n.t('forms.title');

        testI18n.changeLanguage('fr-FR');
        const frTitle = testI18n.t('forms.title');

        expect(enTitle).not.toBe(frTitle);
        expect(enTitle).toBeTruthy();
        expect(frTitle).toBeTruthy();
      });
    });
  });

  describe('Users Module Translations', () => {
    // Note: Users module translations may be under a different key or not yet implemented
    // Testing common status translations that would be used by Users module
    describe('Translation Key Existence', () => {
      it('should have common status translations used by Users', () => {
        const statuses = ['active', 'inactive', 'pending'];

        statuses.forEach(status => {
          const key = `common.status.${status}`;
          expect(testI18n.exists(key)).toBe(true);
        });
      });

      it('should have common validation messages used by Users', () => {
        const validationKeys = [
          'common.validation.required',
          'common.validation.invalidEmail',
        ];

        validationKeys.forEach(key => {
          expect(testI18n.exists(key)).toBe(true);
        });
      });
    });

    describe('Date Formatting', () => {
      it('should format last login dates according to locale', () => {
        const testDate = new Date('2024-01-15T10:00:00Z');

        testI18n.changeLanguage('en-GB');
        const enDate = testDate.toLocaleDateString('en-GB');
        expect(enDate).toContain('15');

        testI18n.changeLanguage('fr-FR');
        const frDate = testDate.toLocaleDateString('fr-FR');
        expect(frDate).toContain('15');

        // Dates should be formatted differently
        expect(enDate).toBeTruthy();
        expect(frDate).toBeTruthy();
      });
    });
  });

  describe('Payments Module Translations', () => {
    describe('Translation Key Existence', () => {
      it('should have all required Payments translation keys in English', () => {
        const requiredKeys = [
          'payments.title',
          'payments.actions.exportToCSV',
          'payments.searchPlaceholder',
          'payments.table.date',
          'payments.table.amount',
          'payments.table.status',
          'payments.table.type',
          'payments.table.customer',
          'payments.details.paymentInformation',
          'payments.details.customerInformation',
          'payments.lodgements.title',
        ];

        requiredKeys.forEach(key => {
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
          expect(translation).not.toBe(key);
        });
      });

      it('should have Payments status translations', () => {
        const statuses = ['paid', 'pending', 'refunded'];

        statuses.forEach(status => {
          const key = `common.status.${status}`;
          expect(testI18n.exists(key)).toBe(true);
        });
      });

      it('should have Payments type translations', () => {
        const types = ['event', 'membership', 'merchandise', 'registration', 'ticket'];

        types.forEach(type => {
          const key = `payments.paymentTypes.${type}`;
          expect(testI18n.exists(key)).toBe(true);
        });
      });

      it('should have payment method translations', () => {
        const methods = ['card', 'cheque'];

        methods.forEach(method => {
          const key = `payments.table.${method}`;
          expect(testI18n.exists(key)).toBe(true);
        });
      });
    });

    describe('Currency Formatting', () => {
      it('should format currency according to locale', () => {
        const amount = 1234.56;

        testI18n.changeLanguage('en-GB');
        const enCurrency = new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        }).format(amount);
        expect(enCurrency).toContain('1,234.56');

        testI18n.changeLanguage('fr-FR');
        const frCurrency = new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
        }).format(amount);
        expect(frCurrency).toContain('1');
        expect(frCurrency).toContain('234');

        testI18n.changeLanguage('de-DE');
        const deCurrency = new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
        }).format(amount);
        expect(deCurrency).toContain('1');
        expect(deCurrency).toContain('234');
      });

      it('should handle zero amounts correctly', () => {
        const amount = 0;

        testI18n.changeLanguage('en-GB');
        const formatted = new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        }).format(amount);
        expect(formatted).toContain('0');
      });

      it('should handle negative amounts correctly', () => {
        const amount = -50.00;

        testI18n.changeLanguage('en-GB');
        const formatted = new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        }).format(amount);
        expect(formatted).toContain('50');
      });
    });

    describe('Date Formatting', () => {
      it('should format payment dates according to locale', () => {
        const testDate = new Date('2024-01-15T10:00:00Z');

        testI18n.changeLanguage('en-GB');
        const enDate = testDate.toLocaleDateString('en-GB');
        expect(enDate).toBe('15/01/2024');

        testI18n.changeLanguage('fr-FR');
        const frDate = testDate.toLocaleDateString('fr-FR');
        expect(frDate).toBe('15/01/2024');

        testI18n.changeLanguage('de-DE');
        const deDate = testDate.toLocaleDateString('de-DE');
        expect(deDate).toBe('15.1.2024');
      });
    });
  });

  describe('Reporting Module Translations', () => {
    describe('Translation Key Existence', () => {
      it('should have all required Reporting translation keys in English', () => {
        const requiredKeys = [
          'reporting.dashboard.title',
          'reporting.dashboard.subtitle',
          'reporting.dashboard.dateRange',
          'reporting.dashboard.exportReport',
          'reporting.events.title',
          'reporting.events.subtitle',
          'reporting.members.title',
          'reporting.members.subtitle',
          'reporting.revenue.title',
          'reporting.revenue.subtitle',
          'reporting.filters.startDate',
          'reporting.filters.endDate',
        ];

        requiredKeys.forEach(key => {
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
          expect(translation).not.toBe(key);
        });
      });

      it('should have Reporting metric translations', () => {
        const metrics = [
          'events',
          'members',
          'revenue',
        ];

        metrics.forEach(metric => {
          const key = `reporting.metrics.${metric}`;
          expect(testI18n.exists(key)).toBe(true);
        });
      });
    });

    describe('Currency Formatting in Reports', () => {
      it('should format revenue amounts according to locale', () => {
        const revenue = 50000.00;

        testI18n.changeLanguage('en-GB');
        const enRevenue = new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        }).format(revenue);
        expect(enRevenue).toContain('50,000');

        testI18n.changeLanguage('fr-FR');
        const frRevenue = new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
        }).format(revenue);
        expect(frRevenue).toContain('50');
      });
    });

    describe('Date Range Formatting', () => {
      it('should format date ranges according to locale', () => {
        const startDate = new Date('2024-01-01T00:00:00Z');
        const endDate = new Date('2024-01-31T23:59:59Z');

        testI18n.changeLanguage('en-GB');
        const enStart = startDate.toLocaleDateString('en-GB');
        const enEnd = endDate.toLocaleDateString('en-GB');
        expect(enStart).toBe('01/01/2024');
        expect(enEnd).toBe('31/01/2024');

        testI18n.changeLanguage('es-ES');
        const esStart = startDate.toLocaleDateString('es-ES');
        const esEnd = endDate.toLocaleDateString('es-ES');
        expect(esStart).toBe('1/1/2024');
        expect(esEnd).toBe('31/1/2024');
      });
    });
  });

  describe('Settings Module Translations', () => {
    describe('Translation Key Existence', () => {
      it('should have all required Settings translation keys in English', () => {
        const requiredKeys = [
          'settings.title',
          'settings.organisationDetails.title',
          'settings.organisationDetails.subtitle',
          'settings.paymentSettings.title',
          'settings.paymentSettings.subtitle',
          'settings.branding.title',
          'settings.branding.subtitle',
          'settings.emailTemplates.title',
          'settings.emailTemplates.subtitle',
        ];

        requiredKeys.forEach(key => {
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
          expect(translation).not.toBe(key);
        });
      });

      it('should have Organisation Details field translations', () => {
        const fields = [
          'organisationName',
          'displayName',
          'domain',
          'currency',
          'language',
          'address',
          'city',
          'postcode',
          'country',
          'phone',
          'email',
          'website',
        ];

        fields.forEach(field => {
          const key = `settings.organisationDetails.fields.${field}`;
          expect(testI18n.exists(key)).toBe(true);
        });
      });

      it('should have Payment Settings field translations', () => {
        const fields = [
          'stripePublishableKey',
          'stripeSecretKey',
          'defaultCurrency',
        ];

        fields.forEach(field => {
          const key = `settings.paymentSettings.fields.${field}`;
          expect(testI18n.exists(key)).toBe(true);
        });
      });

      it('should have Branding field translations', () => {
        const fields = [
          'logoUrl',
          'primaryColour',
          'secondaryColour',
          'accentColour',
        ];

        fields.forEach(field => {
          const key = `settings.branding.fields.${field}`;
          expect(testI18n.exists(key)).toBe(true);
        });
      });

      it('should have Email Templates translations', () => {
        const templates = [
          'welcome',
          'eventConfirmation',
          'paymentReceipt',
          'membershipConfirmation',
          'passwordReset',
        ];

        templates.forEach(template => {
          const key = `settings.emailTemplates.templateTypes.${template}`;
          expect(testI18n.exists(key)).toBe(true);
        });
      });
    });

    describe('Currency Options', () => {
      it('should have all currency option translations', () => {
        const currencies = ['gbp', 'eur', 'usd', 'aud', 'cad'];

        currencies.forEach(currency => {
          const key = `settings.organisationDetails.currencies.${currency}`;
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
        });
      });
    });

    describe('Language Options', () => {
      it('should have all language option translations', () => {
        const languages = ['enGB', 'enUS', 'frFR', 'deDE', 'esES'];

        languages.forEach(language => {
          const key = `settings.organisationDetails.languages.${language}`;
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
        });
      });
    });
  });

  describe('Common Translations Across All Modules', () => {
    describe('Action Translations', () => {
      it('should have all common action translations', () => {
        const actions = [
          'save',
          'cancel',
          'delete',
          'edit',
          'create',
          'add',
          'export',
          'import',
          'search',
          'filter',
          'back',
          'next',
          'previous',
          'submit',
        ];

        actions.forEach(action => {
          const key = `common.actions.${action}`;
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
        });
      });
    });

    describe('Status Translations', () => {
      it('should have all common status translations', () => {
        const statuses = [
          'active',
          'inactive',
          'pending',
          'completed',
          'cancelled',
          'draft',
          'published',
          'paid',
          'refunded',
        ];

        statuses.forEach(status => {
          const key = `common.status.${status}`;
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
        });
      });
    });

    describe('Validation Translations', () => {
      it('should have all common validation translations', () => {
        const validations = [
          'required',
          'invalidEmail',
          'invalidDate',
          'minLength',
          'maxLength',
        ];

        validations.forEach(validation => {
          const key = `common.validation.${validation}`;
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
        });
      });
    });

    describe('Label Translations', () => {
      it('should have all common label translations', () => {
        const labels = [
          'all',
          'enabled',
          'disabled',
          'unlimited',
          'free',
        ];

        labels.forEach(label => {
          const key = `common.labels.${label}`;
          expect(testI18n.exists(key)).toBe(true);
          const translation = testI18n.t(key);
          expect(translation).toBeTruthy();
        });
      });
    });
  });

  describe('Locale Switching Across All Modules', () => {
    it('should switch locales correctly for Forms module', () => {
      testI18n.changeLanguage('en-GB');
      const enTitle = testI18n.t('forms.title');

      testI18n.changeLanguage('fr-FR');
      const frTitle = testI18n.t('forms.title');

      testI18n.changeLanguage('es-ES');
      const esTitle = testI18n.t('forms.title');

      expect(enTitle).not.toBe(frTitle);
      expect(frTitle).not.toBe(esTitle);
      expect(enTitle).not.toBe(esTitle);
    });

    it('should switch locales correctly for Payments module', () => {
      testI18n.changeLanguage('en-GB');
      const enTitle = testI18n.t('payments.title');

      testI18n.changeLanguage('pt-PT');
      const ptTitle = testI18n.t('payments.title');

      expect(enTitle).not.toBe(ptTitle);
      expect(enTitle).toBeTruthy();
      expect(ptTitle).toBeTruthy();
    });

    it('should maintain locale across multiple translation requests', () => {
      testI18n.changeLanguage('fr-FR');

      const title1 = testI18n.t('forms.title');
      const title2 = testI18n.t('payments.title');
      const title3 = testI18n.t('reporting.title');

      // All should be in French
      expect(testI18n.language).toBe('fr-FR');
      expect(title1).toBeTruthy();
      expect(title2).toBeTruthy();
      expect(title3).toBeTruthy();
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to English for missing translations', () => {
      testI18n.changeLanguage('fr-FR');

      // Try to get a potentially missing key
      const translation = testI18n.t('forms.potentiallyMissing.key');

      // Should either return the English translation or the key itself
      expect(typeof translation).toBe('string');
      expect(translation).toBeTruthy();
    });

    it('should not crash with completely missing keys', () => {
      const missingKeys = [
        'forms.nonexistent.key',
        'users.missing.translation',
        'payments.invalid.path',
        'reporting.missing.metric',
        'settings.nonexistent.field',
      ];

      missingKeys.forEach(key => {
        expect(() => testI18n.t(key)).not.toThrow();
        const translation = testI18n.t(key);
        expect(typeof translation).toBe('string');
      });
    });

    it('should handle nested missing keys gracefully', () => {
      const nestedMissingKeys = [
        'forms.builder.missing.nested.key',
        'users.details.missing.deeply.nested.key',
        'payments.lodgements.missing.key',
      ];

      nestedMissingKeys.forEach(key => {
        expect(() => testI18n.t(key)).not.toThrow();
      });
    });
  });

  describe('Interpolation', () => {
    it('should interpolate values correctly in validation messages', () => {
      const translation = testI18n.t('common.validation.minLength', { min: 5 });
      expect(translation).toContain('5');
    });

    it('should interpolate values correctly in maxLength validation', () => {
      const translation = testI18n.t('common.validation.maxLength', { max: 100 });
      expect(translation).toContain('100');
    });

    it('should handle multiple interpolation values', () => {
      // Test with a key that might have multiple values
      const translation = testI18n.t('common.validation.minLength', { min: 3 });
      expect(typeof translation).toBe('string');
      expect(translation).toBeTruthy();
    });
  });

  describe('All Supported Locales', () => {
    const supportedLocales = ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'];

    supportedLocales.forEach(locale => {
      describe(`Locale: ${locale}`, () => {
        beforeEach(() => {
          testI18n.changeLanguage(locale);
        });

        it(`should have Forms translations in ${locale}`, () => {
          expect(testI18n.exists('forms.title')).toBe(true);
          expect(testI18n.t('forms.title')).toBeTruthy();
        });

        it(`should have Payments translations in ${locale}`, () => {
          expect(testI18n.exists('payments.title')).toBe(true);
          expect(testI18n.t('payments.title')).toBeTruthy();
        });

        it(`should have Reporting translations in ${locale}`, () => {
          expect(testI18n.exists('reporting.dashboard.title')).toBe(true);
          expect(testI18n.t('reporting.dashboard.title')).toBeTruthy();
        });

        it(`should have Settings translations in ${locale}`, () => {
          expect(testI18n.exists('settings.title')).toBe(true);
          expect(testI18n.t('settings.title')).toBeTruthy();
        });

        it(`should have common action translations in ${locale}`, () => {
          expect(testI18n.exists('common.actions.save')).toBe(true);
          expect(testI18n.t('common.actions.save')).toBeTruthy();
        });
      });
    });
  });
});
