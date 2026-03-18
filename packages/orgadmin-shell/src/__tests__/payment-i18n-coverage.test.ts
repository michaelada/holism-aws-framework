/**
 * Payment Fee Configuration i18n Key Coverage Tests
 *
 * Verifies that all required payment translation keys exist in the
 * shell's locale files, covering Memberships, Registrations, Calendar,
 * Merchandise, and Events modules.
 *
 * Requirements: 9.1, 9.2, 9.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enGB from '../../src/locales/en-GB/translation.json';

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en-GB',
  fallbackLng: 'en-GB',
  resources: {
    'en-GB': { translation: enGB },
  },
  interpolation: {
    escapeValue: false,
  },
});

describe('Payment Fee Configuration i18n Key Coverage', () => {
  beforeEach(() => {
    testI18n.changeLanguage('en-GB');
  });

  describe('Shared payment translation keys', () => {
    const requiredPaymentKeys = [
      'payment.fee',
      'payment.feeHelper',
      'payment.handlingFeeIncluded',
      'payment.handlingFeeIncludedHelper',
    ];

    requiredPaymentKeys.forEach((key) => {
      it(`should have "${key}" translation key`, () => {
        expect(testI18n.exists(key)).toBe(true);
        const translation = testI18n.t(key, { currency: 'EUR' });
        expect(translation).toBeTruthy();
        expect(translation).not.toBe(key);
      });
    });

    it('should interpolate currency in payment.fee', () => {
      const translation = testI18n.t('payment.fee', { currency: 'USD' });
      expect(translation).toContain('USD');
    });
  });

  describe('Events module feeCurrency key', () => {
    it('should have "events.activities.activity.feeCurrency" translation key', () => {
      const key = 'events.activities.activity.feeCurrency';
      expect(testI18n.exists(key)).toBe(true);
      const translation = testI18n.t(key, { currency: 'EUR' });
      expect(translation).toBeTruthy();
      expect(translation).not.toBe(key);
    });

    it('should interpolate currency in events.activities.activity.feeCurrency', () => {
      const translation = testI18n.t('events.activities.activity.feeCurrency', {
        currency: 'GBP',
      });
      expect(translation).toContain('GBP');
    });
  });
});
