/**
 * Property-Based Tests for HelpDrawer Component
 *
 * Feature: onboarding-and-help-system
 * Property 8: Help Content Resolution
 *
 * For any valid route or page identifier, the help drawer should display content
 * that matches either the specific page or falls back to the module-level
 * overview, ensuring content is always available.
 *
 * Help content is markdown loaded by `getHelpContent`, which owns the
 * page → module-overview → en-GB chain; that chain is checked against the real
 * bundled files in `locales/__tests__/helpLoader.test.ts`. What these
 * properties hold the drawer to is the other half of the promise: for any
 * module and page, whatever was resolved is what the reader sees, and when
 * nothing was, they are told so rather than shown an empty drawer.
 *
 * **Validates: Requirements 8.2**
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpDrawer } from '../HelpDrawer';
import { ModuleId } from '../../context/OnboardingContext';

/**
 * Arbitrary generator for module IDs
 */
const moduleIdArbitrary = fc.constantFrom<ModuleId>(
  'dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'
);

/**
 * Arbitrary generator for page IDs
 * Includes common page types and some arbitrary strings
 */
const pageIdArbitrary = fc.oneof(
  fc.constantFrom('overview', 'list', 'create', 'edit', 'detail', 'settings'),
  fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z-]+$/.test(s))
);

/**
 * Arbitrary generator for language codes
 */
const languageArbitrary = fc.constantFrom(
  'en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'
);

const mockT = vi.fn((key: string, options?: { defaultValue?: string }) => {
  if (key === 'drawer.title') return 'Help';
  if (key === 'drawer.close') return 'Close help';
  if (key === 'drawer.contentLabel') return 'Help content';
  if (key === 'noContentAvailable') {
    return options?.defaultValue || 'Help content is not yet available for this page.';
  }
  return options?.defaultValue || key;
});

const mockI18n = {
  language: 'en-GB',
};

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
}));

/**
 * Stands in for the markdown files. Each property fills it with the content it
 * wants resolved; the loader's own fallback chain is not re-implemented here,
 * because the drawer never sees it — it sees one answer.
 */
let resolved: string | null = null;

/** What the loader was asked for, so the properties can hold it to the request. */
let lastRequest: { locale: string; moduleId: string; pageId: string } | null = null;

vi.mock('../../locales/helpLoader', () => ({
  getHelpContent: (locale: string, moduleId: string, pageId: string) => {
    lastRequest = { locale, moduleId, pageId };
    return resolved;
  },
}));

describe('Property 8: Help Content Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockI18n.language = 'en-GB';
    resolved = null;
    lastRequest = null;
  });

  /**
   * Property: For any valid module and page combination, the drawer shows
   * something — the resolved content, or the message saying there is none.
   */
  it('should always display content for any valid module and page combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        fc.boolean(),
        async (moduleId, pageId, hasContent) => {
          cleanup();
          resolved = hasContent
            ? `# ${moduleId} Help\n\nContent for ${pageId}.`
            : null;

          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          expect(screen.getByRole('heading', { name: 'Help' })).toBeTruthy();

          // Never an empty drawer: content, or the reason there is none.
          await waitFor(() => {
            const shown = hasContent
              ? screen.queryByText(new RegExp(`Content for ${pageId}`, 'i'))
              : screen.queryByText(/help content is not yet available/i);
            expect(shown).toBeTruthy();
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: The drawer asks for the page the user is on, in the language they
   * are reading — everything after that is the loader's decision.
   */
  it('should ask the loader for the current module, page and language', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        languageArbitrary,
        async (moduleId, pageId, language) => {
          cleanup();
          mockI18n.language = language;
          resolved = `# ${moduleId} Help\n\nSomething.`;

          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          expect(lastRequest).toEqual({ locale: language, moduleId, pageId });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: A module overview resolved in place of a missing page is shown as
   * the page's help — the reader is never left wondering which they got.
   */
  it('should display module overview content when that is what resolved', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        async (moduleId, pageId) => {
          cleanup();
          resolved = `# ${moduleId} Module\n\nThis is the module overview.`;

          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          await waitFor(() => {
            expect(screen.getByText(new RegExp(`${moduleId} Module`, 'i'))).toBeTruthy();
          });
          expect(screen.getByText(/module overview/i)).toBeTruthy();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Content in the reader's language is shown as-is, including when
   * the loader fell back to English — the drawer does not second-guess it.
   */
  it('should display content in whatever language resolved', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        languageArbitrary,
        async (moduleId, language) => {
          cleanup();
          mockI18n.language = language;
          resolved = `# Module Help in ${language}`;

          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId="overview"
              moduleId={moduleId}
            />
          );

          await waitFor(() => {
            expect(screen.getByText(`Module Help in ${language}`)).toBeTruthy();
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Resolution is deterministic — the same module, page and language
   * produce the same drawer, however many times it is opened.
   */
  it('should resolve content deterministically for same inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        languageArbitrary,
        async (moduleId, pageId, language) => {
          cleanup();
          mockI18n.language = language;
          resolved = `# ${moduleId}\n\nPage: ${moduleId}-${pageId}`;

          const first = render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );
          await waitFor(() =>
            expect(screen.getByText(`Page: ${moduleId}-${pageId}`)).toBeTruthy()
          );
          // The drawer's own markup, not the whole body: MUI's transition
          // leaves a closing paper behind for a frame after the unmount.
          const firstHtml = screen.getByRole('presentation').innerHTML;
          first.unmount();

          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );
          await waitFor(() =>
            expect(screen.getByText(`Page: ${moduleId}-${pageId}`)).toBeTruthy()
          );

          expect(screen.getByRole('presentation').innerHTML).toBe(firstHtml);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: A closed drawer shows nothing at all, for any module and page.
   */
  it('should show nothing while closed', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        async (moduleId, pageId) => {
          cleanup();
          resolved = `# ${moduleId} Help\n\nContent for ${pageId}.`;

          render(
            <HelpDrawer
              open={false}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          expect(screen.queryByRole('heading', { name: 'Help' })).toBeNull();
        }
      ),
      { numRuns: 30 }
    );
  });
});
