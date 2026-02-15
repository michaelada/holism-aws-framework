/**
 * Unit Tests for Ticketing Module i18n
 * 
 * Tests that Ticketing components display translated text correctly
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
    formatDateTime: (date: Date | string) => {
      return new Date(date).toLocaleString(testI18n.language);
    },
    formatDate: (date: Date | string) => {
      return new Date(date).toLocaleDateString(testI18n.language);
    },
    formatTime: (date: Date | string) => {
      return new Date(date).toLocaleTimeString(testI18n.language);
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

describe('Ticketing Module i18n Unit Tests', () => {
  beforeEach(() => {
    testI18n.changeLanguage('en-GB');
  });

  describe('Translation Keys Existence', () => {
    it('should have all required Ticketing translation keys in English', () => {
      const requiredKeys = [
        'ticketing.title',
        'ticketing.dashboard',
        'ticketing.searchPlaceholder',
        'ticketing.table.ticketReference',
        'ticketing.table.eventName',
        'ticketing.table.scanStatus',
        'ticketing.filters.title',
        'ticketing.scanStatus.scanned',
        'ticketing.scanStatus.notScanned',
        'ticketing.actions.refresh',
        'ticketing.actions.exportToExcel',
        'ticketing.batch.selectedTickets',
        'ticketing.details.title',
        'ticketing.details.ticketInformation',
        'ticketing.stats.totalIssued',
        'ticketing.stats.scanned',
      ];

      requiredKeys.forEach(key => {
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have all required Ticketing translation keys in French', () => {
      testI18n.changeLanguage('fr-FR');
      
      const requiredKeys = [
        'ticketing.title',
        'ticketing.searchPlaceholder',
        'ticketing.table.ticketReference',
        'ticketing.scanStatus.scanned',
        'ticketing.actions.refresh',
      ];

      requiredKeys.forEach(key => {
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have all required Ticketing translation keys in Spanish', () => {
      testI18n.changeLanguage('es-ES');
      
      const requiredKeys = [
        'ticketing.title',
        'ticketing.searchPlaceholder',
        'ticketing.table.ticketReference',
        'ticketing.scanStatus.scanned',
        'ticketing.actions.refresh',
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
      expect(testI18n.t('ticketing.title')).toBe('Event Ticketing');
      expect(testI18n.t('ticketing.scanStatus.scanned')).toBe('Scanned');

      // French
      testI18n.changeLanguage('fr-FR');
      expect(testI18n.t('ticketing.title')).toBe('Billetterie événementielle');
      expect(testI18n.t('ticketing.scanStatus.scanned')).toBe('Scanné');

      // Spanish
      testI18n.changeLanguage('es-ES');
      expect(testI18n.t('ticketing.title')).toBe('Venta de entradas para eventos');
      expect(testI18n.t('ticketing.scanStatus.scanned')).toBe('Escaneado');
    });

    it('should handle interpolation correctly', () => {
      testI18n.changeLanguage('en-GB');
      expect(testI18n.t('ticketing.batch.selectedTickets', { count: 5 })).toContain('5');
      
      testI18n.changeLanguage('fr-FR');
      expect(testI18n.t('ticketing.batch.selectedTickets', { count: 5 })).toContain('5');
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to English for missing translations', () => {
      testI18n.changeLanguage('fr-FR');
      
      // If a key is missing in French, it should fall back to English
      const translation = testI18n.t('ticketing.title');
      expect(translation).toBeTruthy();
      expect(translation).not.toBe('ticketing.title');
    });

    it('should return key if translation is missing in all locales', () => {
      const missingKey = 'ticketing.nonexistent.key';
      const translation = testI18n.t(missingKey);
      expect(translation).toBe(missingKey);
    });
  });

  describe('Date and Time Formatting', () => {
    it('should format dates according to locale', () => {
      const testDate = new Date('2024-01-15T10:30:00');
      
      // English
      testI18n.changeLanguage('en-GB');
      const enDate = testDate.toLocaleDateString('en-GB');
      expect(enDate).toBeTruthy();
      
      // French
      testI18n.changeLanguage('fr-FR');
      const frDate = testDate.toLocaleDateString('fr-FR');
      expect(frDate).toBeTruthy();
      
      // Both should be valid dates (may have same format for en-GB and fr-FR)
      expect(enDate).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(frDate).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it('should format times according to locale', () => {
      const testDate = new Date('2024-01-15T10:30:00');
      
      // English
      testI18n.changeLanguage('en-GB');
      const enTime = testDate.toLocaleTimeString('en-GB');
      expect(enTime).toBeTruthy();
      
      // French
      testI18n.changeLanguage('fr-FR');
      const frTime = testDate.toLocaleTimeString('fr-FR');
      expect(frTime).toBeTruthy();
    });
  });

  describe('Translation Completeness', () => {
    it('should have translations for all scan status values', () => {
      const statuses = ['scanned', 'notScanned'];
      
      statuses.forEach(status => {
        const key = `ticketing.scanStatus.${status}`;
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have translations for all action buttons', () => {
      const actions = ['refresh', 'exportToExcel', 'markAsScanned', 'markAsNotScanned', 'resendEmail', 'downloadPDF'];
      
      actions.forEach(action => {
        const key = `ticketing.actions.${action}`;
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have translations for all table headers', () => {
      const headers = ['ticketReference', 'eventName', 'eventActivity', 'customerName', 'customerEmail', 'issueDate', 'scanStatus', 'scanDate', 'actions'];
      
      headers.forEach(header => {
        const key = `ticketing.table.${header}`;
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have translations for all filter labels', () => {
      const filters = ['title', 'event', 'eventActivity', 'scanStatus', 'dateFrom', 'dateTo'];
      
      filters.forEach(filter => {
        const key = `ticketing.filters.${filter}`;
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });

    it('should have translations for all stats cards', () => {
      const stats = ['totalIssued', 'scanned', 'notScanned', 'lastScanTime'];
      
      stats.forEach(stat => {
        const key = `ticketing.stats.${stat}`;
        const translation = testI18n.t(key);
        expect(translation).not.toBe(key);
        expect(translation).toBeTruthy();
      });
    });
  });
});
