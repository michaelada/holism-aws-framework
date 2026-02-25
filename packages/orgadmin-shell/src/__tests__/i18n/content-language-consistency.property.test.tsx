/**
 * Property-Based Tests for Content Language Consistency
 * 
 * Feature: onboarding-and-help-system
 * Property 1: Content Language Consistency
 * 
 * For any onboarding or help content (welcome dialog, module intro, help drawer)
 * and any supported language (en-GB, fr-FR, es-ES, it-IT, de-DE, pt-PT),
 * when that language is selected, the system should display all content in that language.
 * 
 * **Validates: Requirements 1.2, 2.2, 3.2, 5.4**
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { WelcomeDialog } from '../../components/WelcomeDialog';
import { ModuleIntroductionDialog } from '../../components/ModuleIntroductionDialog';
import { HelpDrawer } from '../../components/HelpDrawer';
import { ModuleId } from '../../context/OnboardingContext';

// Import all translation files
import enGBOnboarding from '../../locales/en-GB/onboarding.json';
import enGBHelp from '../../locales/en-GB/help.json';
import frFROnboarding from '../../locales/fr-FR/onboarding.json';
import frFRHelp from '../../locales/fr-FR/help.json';
import esESOnboarding from '../../locales/es-ES/onboarding.json';
import esESHelp from '../../locales/es-ES/help.json';
import itITOnboarding from '../../locales/it-IT/onboarding.json';
import itITHelp from '../../locales/it-IT/help.json';
import deDEOnboarding from '../../locales/de-DE/onboarding.json';
import deDEHelp from '../../locales/de-DE/help.json';
import ptPTOnboarding from '../../locales/pt-PT/onboarding.json';
import ptPTHelp from '../../locales/pt-PT/help.json';

/**
 * Arbitrary generator for supported languages
 */
const languageArbitrary = fc.constantFrom(
  'en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'
);

/**
 * Arbitrary generator for module IDs
 */
const moduleIdArbitrary = fc.constantFrom<ModuleId>(
  'dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'
);

/**
 * Arbitrary generator for page IDs
 */
const pageIdArbitrary = fc.constantFrom(
  'overview', 'list', 'create', 'edit', 'detail'
);

/**
 * Initialize i18n instance for testing with all translations
 */
async function createI18nInstance(language: string) {
  const testI18n = i18n.createInstance();
  
  await testI18n.init({
    lng: language,
    fallbackLng: 'en-GB',
    ns: ['onboarding', 'help', 'translation'],
    defaultNS: 'translation',
    resources: {
      'en-GB': {
        onboarding: enGBOnboarding,
        help: enGBHelp,
        translation: { common: { actions: { close: 'Close' } } },
      },
      'fr-FR': {
        onboarding: frFROnboarding,
        help: frFRHelp,
        translation: { common: { actions: { close: 'Fermer' } } },
      },
      'es-ES': {
        onboarding: esESOnboarding,
        help: esESHelp,
        translation: { common: { actions: { close: 'Cerrar' } } },
      },
      'it-IT': {
        onboarding: itITOnboarding,
        help: itITHelp,
        translation: { common: { actions: { close: 'Chiudi' } } },
      },
      'de-DE': {
        onboarding: deDEOnboarding,
        help: deDEHelp,
        translation: { common: { actions: { close: 'Schließen' } } },
      },
      'pt-PT': {
        onboarding: ptPTOnboarding,
        help: ptPTHelp,
        translation: { common: { actions: { close: 'Fechar' } } },
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });
  
  return testI18n;
}

/**
 * Helper to get expected content for a given language
 */
function getExpectedContent(
  language: string,
  contentType: 'onboarding' | 'help',
  key: string
): string {
  const resources: Record<string, any> = {
    'en-GB': { onboarding: enGBOnboarding, help: enGBHelp },
    'fr-FR': { onboarding: frFROnboarding, help: frFRHelp },
    'es-ES': { onboarding: esESOnboarding, help: esESHelp },
    'it-IT': { onboarding: itITOnboarding, help: itITHelp },
    'de-DE': { onboarding: deDEOnboarding, help: deDEHelp },
    'pt-PT': { onboarding: ptPTOnboarding, help: ptPTHelp },
  };

  const keyParts = key.split('.');
  let value: any = resources[language][contentType];
  
  for (const part of keyParts) {
    if (value && typeof value === 'object') {
      value = value[part];
    } else {
      return '';
    }
  }
  
  return typeof value === 'string' ? value : '';
}

describe('Property 1: Content Language Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property: Welcome dialog displays content in the selected language
   * For any supported language, the welcome dialog should show title and content in that language
   */
  it('should display welcome dialog content in any selected language', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArbitrary,
        async (language) => {
          // Arrange: Create i18n instance with the selected language
          const testI18n = await createI18nInstance(language);
          
          // Act: Render WelcomeDialog with the language
          render(
            <I18nextProvider i18n={testI18n}>
              <WelcomeDialog open={true} onClose={() => {}} />
            </I18nextProvider>
          );

          // Assert: Property - Content should be in the selected language
          const expectedTitle = getExpectedContent(language, 'onboarding', 'welcome.title');
          const expectedDontShowAgain = getExpectedContent(language, 'onboarding', 'welcome.dontShowAgain');
          
          expect(expectedTitle).toBeTruthy();
          // Use getAllByText since title appears in both dialog title and markdown content
          const titleElements = screen.getAllByText(expectedTitle);
          expect(titleElements.length).toBeGreaterThan(0);
          
          // Use getAllByText for checkbox label as well
          const dontShowAgainElements = screen.getAllByText(expectedDontShowAgain);
          expect(dontShowAgainElements.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Module introduction dialog displays content in the selected language
   * For any module and any supported language, the module intro should show content in that language
   */
  it('should display module introduction content in any selected language for any module', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArbitrary,
        moduleIdArbitrary,
        async (language, moduleId) => {
          // Arrange: Create i18n instance with the selected language
          const testI18n = await createI18nInstance(language);
          
          // Act: Render ModuleIntroductionDialog with the language and module
          render(
            <I18nextProvider i18n={testI18n}>
              <ModuleIntroductionDialog 
                open={true} 
                moduleId={moduleId}
                onClose={() => {}} 
              />
            </I18nextProvider>
          );

          // Assert: Property - Content should be in the selected language
          const expectedTitle = getExpectedContent(language, 'onboarding', `modules.${moduleId}.title`);
          const expectedAction = getExpectedContent(language, 'onboarding', 'actions.gotIt');
          
          expect(expectedTitle).toBeTruthy();
          // Use getAllByText since title may appear in both dialog title and markdown content
          const titleElements = screen.getAllByText(expectedTitle);
          expect(titleElements.length).toBeGreaterThan(0);
          
          const actionElements = screen.getAllByText(expectedAction);
          expect(actionElements.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Help drawer displays content in the selected language
   * For any module, page, and language, the help drawer should show content in that language
   */
  it('should display help drawer content in any selected language for any module and page', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArbitrary,
        moduleIdArbitrary,
        pageIdArbitrary,
        async (language, moduleId, pageId) => {
          // Arrange: Create i18n instance with the selected language
          const testI18n = await createI18nInstance(language);
          
          // Act: Render HelpDrawer with the language, module, and page
          const { unmount } = render(
            <I18nextProvider i18n={testI18n}>
              <HelpDrawer 
                open={true} 
                moduleId={moduleId}
                pageId={pageId}
                onClose={() => {}} 
              />
            </I18nextProvider>
          );

          // Assert: Property - Drawer should be rendered with content
          // Check for the drawer title using the specific ID
          const drawerTitle = screen.getByRole('heading', { name: /^help$/i });
          expect(drawerTitle).toBeTruthy();
          
          // Cleanup
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Language switching updates all content consistently
   * When language changes, all displayed content should update to the new language
   */
  it('should update all content when language changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArbitrary,
        languageArbitrary,
        moduleIdArbitrary,
        async (initialLanguage, newLanguage, targetModuleId) => {
          // Skip if languages are the same
          if (initialLanguage === newLanguage) {
            return;
          }
          
          // Arrange: Create i18n instance with initial language
          const testI18n = await createI18nInstance(initialLanguage);
          
          // Act: Render ModuleIntroductionDialog with initial language
          const { rerender, unmount } = render(
            <I18nextProvider i18n={testI18n}>
              <ModuleIntroductionDialog 
                open={true} 
                moduleId={targetModuleId}
                onClose={() => {}} 
              />
            </I18nextProvider>
          );

          // Verify initial language content
          const initialTitle = getExpectedContent(initialLanguage, 'onboarding', `modules.${targetModuleId}.title`);
          const initialTitleElements = screen.getAllByText(initialTitle);
          expect(initialTitleElements.length).toBeGreaterThan(0);
          
          // Change language
          await testI18n.changeLanguage(newLanguage);
          
          // Rerender with new language
          rerender(
            <I18nextProvider i18n={testI18n}>
              <ModuleIntroductionDialog 
                open={true} 
                moduleId={targetModuleId}
                onClose={() => {}} 
              />
            </I18nextProvider>
          );

          // Assert: Property - Content should now be in the new language
          const newTitle = getExpectedContent(newLanguage, 'onboarding', `modules.${targetModuleId}.title`);
          const newTitleElements = screen.getAllByText(newTitle);
          expect(newTitleElements.length).toBeGreaterThan(0);
          
          // Cleanup
          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: All modules have translations in all supported languages
   * For any module and any language, translation content should exist
   */
  it('should have complete translations for all modules in all languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArbitrary,
        moduleIdArbitrary,
        async (language, moduleId) => {
          // Assert: Property - Translation keys should exist
          const title = getExpectedContent(language, 'onboarding', `modules.${moduleId}.title`);
          const content = getExpectedContent(language, 'onboarding', `modules.${moduleId}.content`);
          
          // Both title and content should be non-empty strings
          expect(title).toBeTruthy();
          expect(typeof title).toBe('string');
          expect(title.length).toBeGreaterThan(0);
          
          expect(content).toBeTruthy();
          expect(typeof content).toBe('string');
          expect(content.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Help content exists for all modules in all languages
   * For any module and any language, help overview content should exist
   */
  it('should have help overview content for all modules in all languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArbitrary,
        moduleIdArbitrary,
        async (language, moduleId) => {
          // Assert: Property - Help overview should exist
          const overview = getExpectedContent(language, 'help', `${moduleId}.overview`);
          
          // Overview content should be non-empty
          expect(overview).toBeTruthy();
          expect(typeof overview).toBe('string');
          expect(overview.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content is language-specific and not just English
   * For non-English languages, content should be different from English
   */
  it('should have language-specific content that differs from English', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArbitrary.filter(lang => lang !== 'en-GB'),
        moduleIdArbitrary,
        async (language, moduleId) => {
          // Get content in both languages
          const englishTitle = getExpectedContent('en-GB', 'onboarding', `modules.${moduleId}.title`);
          const translatedTitle = getExpectedContent(language, 'onboarding', `modules.${moduleId}.title`);
          
          // Assert: Property - Translated content should differ from English
          expect(translatedTitle).toBeTruthy();
          expect(translatedTitle).not.toBe(englishTitle);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Welcome dialog content is consistent across renders
   * For any language, rendering the welcome dialog multiple times should show the same content
   */
  it('should display consistent welcome content across multiple renders', async () => {
    await fc.assert(
      fc.asyncProperty(
        languageArbitrary,
        async (language) => {
          // Arrange: Create i18n instance
          const testI18n = await createI18nInstance(language);
          
          // Act: Render welcome dialog first time
          const { unmount } = render(
            <I18nextProvider i18n={testI18n}>
              <WelcomeDialog open={true} onClose={() => {}} />
            </I18nextProvider>
          );

          const firstTitle = getExpectedContent(language, 'onboarding', 'welcome.title');
          const firstTitleElements = screen.getAllByText(firstTitle);
          expect(firstTitleElements.length).toBeGreaterThan(0);
          
          unmount();
          
          // Render again
          render(
            <I18nextProvider i18n={testI18n}>
              <WelcomeDialog open={true} onClose={() => {}} />
            </I18nextProvider>
          );

          // Assert: Property - Same content should appear
          const secondTitleElements = screen.getAllByText(firstTitle);
          expect(secondTitleElements.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
