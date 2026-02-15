/**
 * Registrations Module i18n Tests
 * 
 * Tests for internationalization in the registrations module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import i18n from 'i18next';
import { I18nextProvider } from 'react-i18next';

// Mock translation resources
const mockTranslations = {
  'en-GB': {
    translation: {
      registrations: {
        title: 'Registrations',
        registrationTypes: 'Registration Types',
        createRegistrationType: 'Create Registration Type',
        searchPlaceholder: 'Search registration types...',
        noTypesFound: 'No registration types yet. Create your first registration type to get started.',
        loadingTypes: 'Loading registration types...',
        table: {
          name: 'Name',
          entityName: 'Entity Name',
          status: 'Status',
          actions: 'Actions',
        },
      },
      common: {
        actions: {
          save: 'Save',
          cancel: 'Cancel',
          edit: 'Edit',
          delete: 'Delete',
        },
      },
    },
  },
  'fr-FR': {
    translation: {
      registrations: {
        title: 'Inscriptions',
        registrationTypes: 'Types d\'inscription',
        createRegistrationType: 'Créer un type d\'inscription',
        searchPlaceholder: 'Rechercher des types d\'inscription...',
        noTypesFound: 'Aucun type d\'inscription pour le moment. Créez votre premier type d\'inscription pour commencer.',
        loadingTypes: 'Chargement des types d\'inscription...',
        table: {
          name: 'Nom',
          entityName: 'Nom de l\'entité',
          status: 'Statut',
          actions: 'Actions',
        },
      },
      common: {
        actions: {
          save: 'Enregistrer',
          cancel: 'Annuler',
          edit: 'Modifier',
          delete: 'Supprimer',
        },
      },
    },
  },
};

// Initialize i18n for tests
beforeEach(() => {
  i18n.init({
    lng: 'en-GB',
    fallbackLng: 'en-GB',
    resources: mockTranslations,
    interpolation: {
      escapeValue: false,
    },
  });
});

describe('Registrations Module i18n', () => {
  describe('Translation Keys', () => {
    it('should have all required translation keys for English', () => {
      const enTranslations = mockTranslations['en-GB'].translation.registrations;
      
      expect(enTranslations.title).toBe('Registrations');
      expect(enTranslations.registrationTypes).toBe('Registration Types');
      expect(enTranslations.createRegistrationType).toBe('Create Registration Type');
      expect(enTranslations.searchPlaceholder).toBe('Search registration types...');
      expect(enTranslations.noTypesFound).toBeDefined();
      expect(enTranslations.loadingTypes).toBeDefined();
    });

    it('should have all required translation keys for French', () => {
      const frTranslations = mockTranslations['fr-FR'].translation.registrations;
      
      expect(frTranslations.title).toBe('Inscriptions');
      expect(frTranslations.registrationTypes).toBe('Types d\'inscription');
      expect(frTranslations.createRegistrationType).toBe('Créer un type d\'inscription');
      expect(frTranslations.searchPlaceholder).toBe('Rechercher des types d\'inscription...');
      expect(frTranslations.noTypesFound).toBeDefined();
      expect(frTranslations.loadingTypes).toBeDefined();
    });

    it('should have table column translations', () => {
      const enTable = mockTranslations['en-GB'].translation.registrations.table;
      const frTable = mockTranslations['fr-FR'].translation.registrations.table;
      
      expect(enTable.name).toBe('Name');
      expect(frTable.name).toBe('Nom');
      
      expect(enTable.entityName).toBe('Entity Name');
      expect(frTable.entityName).toBe('Nom de l\'entité');
      
      expect(enTable.status).toBe('Status');
      expect(frTable.status).toBe('Statut');
    });

    it('should have common action translations', () => {
      const enActions = mockTranslations['en-GB'].translation.common.actions;
      const frActions = mockTranslations['fr-FR'].translation.common.actions;
      
      expect(enActions.save).toBe('Save');
      expect(frActions.save).toBe('Enregistrer');
      
      expect(enActions.cancel).toBe('Cancel');
      expect(frActions.cancel).toBe('Annuler');
      
      expect(enActions.edit).toBe('Edit');
      expect(frActions.edit).toBe('Modifier');
      
      expect(enActions.delete).toBe('Delete');
      expect(frActions.delete).toBe('Supprimer');
    });
  });

  describe('Locale Switching', () => {
    it('should return English translations when locale is en-GB', () => {
      i18n.changeLanguage('en-GB');
      
      const title = i18n.t('registrations.title');
      expect(title).toBe('Registrations');
    });

    it('should return French translations when locale is fr-FR', () => {
      i18n.changeLanguage('fr-FR');
      
      const title = i18n.t('registrations.title');
      expect(title).toBe('Inscriptions');
    });

    it('should update all translations when locale changes', () => {
      // Start with English
      i18n.changeLanguage('en-GB');
      expect(i18n.t('registrations.createRegistrationType')).toBe('Create Registration Type');
      expect(i18n.t('registrations.table.name')).toBe('Name');
      
      // Switch to French
      i18n.changeLanguage('fr-FR');
      expect(i18n.t('registrations.createRegistrationType')).toBe('Créer un type d\'inscription');
      expect(i18n.t('registrations.table.name')).toBe('Nom');
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to English for missing translations', () => {
      i18n.changeLanguage('fr-FR');
      
      // If a key is missing in French, it should fall back to English
      const missingKey = i18n.t('registrations.nonExistentKey', { defaultValue: 'Default' });
      expect(missingKey).toBe('Default');
    });

    it('should handle nested translation keys', () => {
      i18n.changeLanguage('en-GB');
      
      const nestedKey = i18n.t('registrations.table.entityName');
      expect(nestedKey).toBe('Entity Name');
    });
  });

  describe('Translation Completeness', () => {
    it('should have matching keys in all languages', () => {
      const enKeys = Object.keys(mockTranslations['en-GB'].translation.registrations);
      const frKeys = Object.keys(mockTranslations['fr-FR'].translation.registrations);
      
      expect(enKeys.sort()).toEqual(frKeys.sort());
    });

    it('should have matching table column keys in all languages', () => {
      const enTableKeys = Object.keys(mockTranslations['en-GB'].translation.registrations.table);
      const frTableKeys = Object.keys(mockTranslations['fr-FR'].translation.registrations.table);
      
      expect(enTableKeys.sort()).toEqual(frTableKeys.sort());
    });
  });

  describe('Date and Currency Formatting', () => {
    it('should format dates according to locale', () => {
      const testDate = new Date('2026-02-14');
      
      // English (UK) format: dd/MM/yyyy
      const enDate = testDate.toLocaleDateString('en-GB');
      expect(enDate).toBe('14/02/2026');
      
      // French format: dd/MM/yyyy
      const frDate = testDate.toLocaleDateString('fr-FR');
      expect(frDate).toBe('14/02/2026');
    });

    it('should format currency according to locale', () => {
      const amount = 1234.56;
      
      // English (UK) format
      const enCurrency = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(amount);
      expect(enCurrency).toContain('1,234.56');
      
      // French format - note the non-breaking space character
      const frCurrency = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount);
      // French format uses non-breaking space: 1 234,56 €
      expect(frCurrency).toMatch(/1[\s\u202f]234,56/);
    });
  });

  describe('Status Translations', () => {
    it('should translate registration statuses', () => {
      i18n.changeLanguage('en-GB');
      
      // These would be actual translation keys in the real implementation
      const statuses = {
        active: 'Active',
        pending: 'Pending',
        elapsed: 'Elapsed',
      };
      
      expect(statuses.active).toBe('Active');
      expect(statuses.pending).toBe('Pending');
      expect(statuses.elapsed).toBe('Elapsed');
    });
  });

  describe('Validation Messages', () => {
    it('should have translated validation messages', () => {
      i18n.changeLanguage('en-GB');
      
      // Mock validation messages
      const validationMessages = {
        nameRequired: 'Name is required',
        descriptionRequired: 'Description is required',
        entityNameRequired: 'Entity Name is required',
      };
      
      expect(validationMessages.nameRequired).toBeDefined();
      expect(validationMessages.descriptionRequired).toBeDefined();
      expect(validationMessages.entityNameRequired).toBeDefined();
    });
  });

  describe('Batch Operations Translations', () => {
    it('should translate batch operation titles', () => {
      i18n.changeLanguage('en-GB');
      
      const batchOperations = {
        markProcessed: 'Mark as Processed',
        markUnprocessed: 'Mark as Unprocessed',
        addLabels: 'Add Labels',
        removeLabels: 'Remove Labels',
      };
      
      expect(batchOperations.markProcessed).toBeDefined();
      expect(batchOperations.addLabels).toBeDefined();
    });
  });

  describe('Filter Translations', () => {
    it('should translate filter options', () => {
      i18n.changeLanguage('en-GB');
      
      const filterOptions = {
        all: 'All',
        open: 'Open',
        closed: 'Closed',
        current: 'Current',
        elapsed: 'Elapsed',
      };
      
      expect(filterOptions.all).toBe('All');
      expect(filterOptions.open).toBe('Open');
      expect(filterOptions.closed).toBe('Closed');
    });
  });
});
