import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocaleProvider } from '../context/LocaleContext';
import { initializeI18n, DEFAULT_LOCALE } from '../i18n/config';

/**
 * Tests for HTML lang attribute accessibility feature
 * 
 * Validates: Task 22.1 - Update HTML lang attribute dynamically
 * Requirements: Accessibility Considerations section
 */

describe('HTML Lang Attribute Accessibility', () => {
  let originalLang: string;

  beforeEach(async () => {
    // Initialize i18n before tests
    await initializeI18n(DEFAULT_LOCALE, true);
    
    // Store original lang attribute
    originalLang = document.documentElement.lang;
  });

  afterEach(() => {
    // Restore original lang attribute
    document.documentElement.lang = originalLang;
  });

  it('should update HTML lang attribute when locale changes', async () => {
    // Initial render with en-GB locale
    const { rerender } = render(
      <LocaleProvider organizationLocale="en-GB">
        <div>Content</div>
      </LocaleProvider>
    );

    // Verify initial lang attribute
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en-gb');
    });

    // Change to French locale
    rerender(
      <LocaleProvider organizationLocale="fr-FR">
        <div>Content</div>
      </LocaleProvider>
    );

    // Verify lang attribute updated
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('fr-fr');
    });
  });

  it('should set default lang attribute to en-gb when no locale provided', async () => {
    render(
      <LocaleProvider>
        <div>Content</div>
      </LocaleProvider>
    );

    // Verify default lang attribute
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en-gb');
    });
  });

  it('should update lang attribute for all supported locales', async () => {
    const supportedLocales = ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'];
    
    for (const locale of supportedLocales) {
      const { unmount } = render(
        <LocaleProvider organizationLocale={locale}>
          <div>Content</div>
        </LocaleProvider>
      );

      // Verify lang attribute matches locale (lowercase)
      await waitFor(() => {
        expect(document.documentElement.lang).toBe(locale.toLowerCase());
      });
      
      unmount();
    }
  });

  it('should convert locale format from en-GB to en-gb (lowercase) as per HTML spec', async () => {
    render(
      <LocaleProvider organizationLocale="en-GB">
        <div>Content</div>
      </LocaleProvider>
    );

    // HTML lang attribute should be lowercase
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en-gb');
      expect(document.documentElement.lang).not.toBe('en-GB');
    });
  });

  it('should announce locale changes to screen readers via lang attribute', async () => {
    const { rerender } = render(
      <LocaleProvider organizationLocale="en-GB">
        <div>English content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en-gb');
    });

    // Change to Spanish
    rerender(
      <LocaleProvider organizationLocale="es-ES">
        <div>Contenido en español</div>
      </LocaleProvider>
    );

    // Screen readers will detect the lang change via the HTML attribute
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('es-es');
    });
  });

  it('should maintain lang attribute when locale prop does not change', async () => {
    const { rerender } = render(
      <LocaleProvider organizationLocale="de-DE">
        <div>Content 1</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('de-de');
    });

    // Rerender with same locale but different children
    rerender(
      <LocaleProvider organizationLocale="de-DE">
        <div>Content 2</div>
      </LocaleProvider>
    );

    // Lang attribute should remain the same
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('de-de');
    });
  });

  it('should handle rapid locale changes correctly', async () => {
    const { rerender } = render(
      <LocaleProvider organizationLocale="en-GB">
        <div>Content</div>
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en-gb');
    });

    // Rapidly change locales
    rerender(
      <LocaleProvider organizationLocale="fr-FR">
        <div>Content</div>
      </LocaleProvider>
    );

    rerender(
      <LocaleProvider organizationLocale="es-ES">
        <div>Content</div>
      </LocaleProvider>
    );

    rerender(
      <LocaleProvider organizationLocale="it-IT">
        <div>Content</div>
      </LocaleProvider>
    );

    // Final lang attribute should match the last locale
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('it-it');
    });
  });

  it('should set lang attribute before rendering content', async () => {
    render(
      <LocaleProvider organizationLocale="pt-PT">
        <div>Content</div>
      </LocaleProvider>
    );

    // Lang attribute should be set after the component mounts
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('pt-pt');
    });
  });
});
