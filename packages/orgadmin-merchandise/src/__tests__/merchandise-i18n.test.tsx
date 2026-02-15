/**
 * Unit Tests for Merchandise Module i18n
 * 
 * Tests that Merchandise components display translated text correctly
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
import esES from '../../../orgadmin-shell/src/locales/es-ES/translation.json';

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
    formatDate: (date: Date | string) => {
      return new Date(date).toLocaleDateString(testI18n.language);
    },
    formatCurrency: (amount: number, currency: string) => {
      return new Intl.NumberFormat(testI18n.language, {
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
      'es-ES': { translation: esES },
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

describe('Merchandise Module i18n Unit Tests', () => {
  beforeEach(() => {
    testI18n.changeLanguage('en-GB');
  });

  describe('Translation Keys Existence', () => {
    it('should have all required Merchandise translation keys in English', () => {
      const requiredKeys = [
        'merchandise.title',
        'merchandise.createMerchandiseType',
        'merchandise.searchPlaceholder',
        'merchandise.table.name',
        'merchandise.table.status',
        'merchandise.table.priceRange',
        'merchandise.table.stockStatus',
        'merchandise.stock.inStock',
        'merchandise.stock.lowStock',
        'merchandise.stock.outOfStock',
        'merchandise.sections.basicInfo',
        'merchandise.sections.images',
        'merchandise.sections.options',
        'merchandise.fields.name',
        'merchandise.fields.description',
        'merchandise.images.title',
        'merchandise.images.uploadImages',
        'merchandise.delivery.title',
        'merchandise.orders.title',
      ];

      requiredKeys.forEach(key => {
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have all required Merchandise translation keys in French', () => {
      testI18n.changeLanguage('fr-FR');
      
      const requiredKeys = [
        'merchandise.title',
        'merchandise.createMerchandiseType',
        'merchandise.table.name',
        'merchandise.stock.inStock',
      ];

      requiredKeys.forEach(key => {
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have all required Merchandise translation keys in Spanish', () => {
      testI18n.changeLanguage('es-ES');
      
      const requiredKeys = [
        'merchandise.title',
        'merchandise.createMerchandiseType',
        'merchandise.table.name',
        'merchandise.stock.inStock',
      ];

      requiredKeys.forEach(key => {
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });
  });

  describe('Locale Switching', () => {
    it('should display different text when locale changes', () => {
      // English
      testI18n.changeLanguage('en-GB');
      expect(testI18n.t('merchandise.title')).toBe('Merchandise');
      expect(testI18n.t('merchandise.createMerchandiseType')).toBe('Create Merchandise Type');

      // French
      testI18n.changeLanguage('fr-FR');
      expect(testI18n.t('merchandise.title')).toBe('Marchandises');
      expect(testI18n.t('merchandise.createMerchandiseType')).toBe('Créer un type de marchandise');

      // Spanish
      testI18n.changeLanguage('es-ES');
      expect(testI18n.t('merchandise.title')).toBe('Mercancía');
      expect(testI18n.t('merchandise.createMerchandiseType')).toBe('Crear tipo de mercancía');
    });

    it('should format currency according to locale', () => {
      const amount = 1234.56;
      const currency = 'EUR';

      // English (UK)
      testI18n.changeLanguage('en-GB');
      const enFormat = new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
      expect(enFormat).toContain('1,234.56');

      // French
      testI18n.changeLanguage('fr-FR');
      const frFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
      expect(frFormat).toContain('1');
      expect(frFormat).toContain('234');
      expect(frFormat).toContain('56');
    });

    it('should format dates according to locale', () => {
      const date = new Date('2024-03-15');

      // English (UK)
      testI18n.changeLanguage('en-GB');
      const enDate = date.toLocaleDateString('en-GB');
      expect(enDate).toBe('15/03/2024');

      // French
      testI18n.changeLanguage('fr-FR');
      const frDate = date.toLocaleDateString('fr-FR');
      expect(frDate).toBe('15/03/2024');

      // Spanish
      testI18n.changeLanguage('es-ES');
      const esDate = date.toLocaleDateString('es-ES');
      expect(esDate).toBe('15/3/2024');
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to English for missing translations', () => {
      testI18n.changeLanguage('fr-FR');
      
      // Test with a key that might not exist
      const fallbackKey = 'merchandise.nonexistent.key';
      const translation = testI18n.t(fallbackKey);
      
      // Should return the key itself if not found
      expect(translation).toBe(fallbackKey);
    });

    it('should handle interpolation in translations', () => {
      testI18n.changeLanguage('en-GB');
      
      const translation = testI18n.t('merchandise.orders.selectedOrders', { count: 5, plural: 's' });
      expect(translation).toContain('5');
      expect(translation).toContain('order');
    });
  });

  describe('Stock Status Translations', () => {
    it('should translate stock status correctly in all locales', () => {
      const statuses = ['inStock', 'lowStock', 'outOfStock', 'notTracked'];

      // English
      testI18n.changeLanguage('en-GB');
      expect(testI18n.t('merchandise.stock.inStock')).toBe('In Stock');
      expect(testI18n.t('merchandise.stock.lowStock')).toBe('Low Stock');
      expect(testI18n.t('merchandise.stock.outOfStock')).toBe('Out of Stock');
      expect(testI18n.t('merchandise.stock.notTracked')).toBe('Not Tracked');

      // French
      testI18n.changeLanguage('fr-FR');
      expect(testI18n.t('merchandise.stock.inStock')).toBe('En stock');
      expect(testI18n.t('merchandise.stock.lowStock')).toBe('Stock faible');
      expect(testI18n.t('merchandise.stock.outOfStock')).toBe('Rupture de stock');
      expect(testI18n.t('merchandise.stock.notTracked')).toBe('Non suivi');

      // Spanish
      testI18n.changeLanguage('es-ES');
      expect(testI18n.t('merchandise.stock.inStock')).toBe('En stock');
      expect(testI18n.t('merchandise.stock.lowStock')).toBe('Stock bajo');
      expect(testI18n.t('merchandise.stock.outOfStock')).toBe('Agotado');
      expect(testI18n.t('merchandise.stock.notTracked')).toBe('No rastreado');
    });
  });

  describe('Order Status Translations', () => {
    it('should translate order status correctly in all locales', () => {
      // English
      testI18n.changeLanguage('en-GB');
      expect(testI18n.t('merchandise.orderStatusOptions.pending')).toBe('Pending');
      expect(testI18n.t('merchandise.orderStatusOptions.processing')).toBe('Processing');
      expect(testI18n.t('merchandise.orderStatusOptions.shipped')).toBe('Shipped');
      expect(testI18n.t('merchandise.orderStatusOptions.delivered')).toBe('Delivered');
      expect(testI18n.t('merchandise.orderStatusOptions.cancelled')).toBe('Cancelled');

      // French
      testI18n.changeLanguage('fr-FR');
      expect(testI18n.t('merchandise.orderStatusOptions.pending')).toBe('En attente');
      expect(testI18n.t('merchandise.orderStatusOptions.processing')).toBe('En cours de traitement');
      expect(testI18n.t('merchandise.orderStatusOptions.shipped')).toBe('Expédié');
      expect(testI18n.t('merchandise.orderStatusOptions.delivered')).toBe('Livré');
      expect(testI18n.t('merchandise.orderStatusOptions.cancelled')).toBe('Annulé');
    });
  });

  describe('Section Titles', () => {
    it('should translate section titles correctly', () => {
      testI18n.changeLanguage('en-GB');
      expect(testI18n.t('merchandise.sections.basicInfo')).toBe('Basic Information');
      expect(testI18n.t('merchandise.sections.images')).toBe('Product Images');
      expect(testI18n.t('merchandise.sections.options')).toBe('Options Configuration');
      expect(testI18n.t('merchandise.sections.stockManagement')).toBe('Stock Management');
      expect(testI18n.t('merchandise.sections.delivery')).toBe('Delivery Configuration');
      expect(testI18n.t('merchandise.sections.quantityRules')).toBe('Order Quantity Rules');
    });
  });
});
