/**
 * i18n Test Utilities
 * 
 * Provides utilities for testing components with i18n support
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Minimal translations for testing
const testTranslations = {
  'en-GB': {
    translation: {
      common: {
        actions: {
          save: 'Save',
          cancel: 'Cancel',
          delete: 'Delete',
          edit: 'Edit',
        },
      },
      memberships: {
        membershipTypes: 'Membership Types',
        members: 'Members',
        membersDatabase: 'Members Database',
        createMembershipType: 'Create Membership Type',
        searchPlaceholder: 'Search membership types...',
        searchMembersPlaceholder: 'Search by name or membership number...',
        statusOptions: {
          all: 'All',
          current: 'Current',
          elapsed: 'Elapsed',
        },
        personConfig: {
          selectForm: 'Select a membership form to configure field sharing',
        },
        batch: {
          markProcessed: {
            title: 'Mark as Processed',
            message: 'Mark {{count}} selected member(s) as processed?',
          },
          markUnprocessed: {
            title: 'Mark as Unprocessed',
            message: 'Mark {{count}} selected member(s) as unprocessed?',
          },
          addLabels: {
            title: 'Add Labels',
            message: 'Add labels to {{count}} selected member(s)?',
          },
          removeLabels: {
            title: 'Remove Labels',
            message: 'Remove labels from {{count}} selected member(s)?',
          },
        },
        actions: {
          execute: 'Execute',
          exportToExcel: 'Export to Excel',
        },
        fields: {
          fieldName: 'Field Name',
          fieldType: 'Type',
          required: 'Required',
          configuration: 'Configuration',
          yes: 'Yes',
          no: 'No',
          name: 'Name',
          description: 'Description',
          addLabel: 'Add label',
        },
        fieldConfig: {
          commonToAll: 'Common to all',
          uniqueForEach: 'Unique for each',
        },
        create: {
          single: {
            title: 'Create Single Membership Type',
          },
        },
        filters: {
          status: 'Status',
        },
      },
    },
  },
};

// Create a test i18n instance
export const createTestI18n = (locale: string = 'en-GB') => {
  const testI18n = i18n.createInstance();
  testI18n
    .use(initReactI18next)
    .init({
      lng: locale,
      fallbackLng: 'en-GB',
      resources: testTranslations,
      interpolation: {
        escapeValue: false,
      },
    });
  return testI18n;
};

// Custom render function that includes i18n provider
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: string;
  initialRoute?: string;
}

export function renderWithI18n(
  ui: ReactElement,
  { locale = 'en-GB', initialRoute = '/', ...renderOptions }: CustomRenderOptions = {}
) {
  const testI18n = createTestI18n(locale);
  
  // Set initial route if provided
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }
  
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>;
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    i18n: testI18n,
  };
}

export { screen, waitFor, fireEvent } from '@testing-library/react';
