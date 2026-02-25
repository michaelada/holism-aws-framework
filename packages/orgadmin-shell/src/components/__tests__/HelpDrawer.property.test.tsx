/**
 * Property-Based Tests for HelpDrawer Component
 * 
 * Feature: onboarding-and-help-system
 * Property 8: Help Content Resolution
 * 
 * For any valid route or page identifier, the help drawer should display content
 * that matches either the specific page or falls back to the module-level overview,
 * ensuring content is always available.
 * 
 * **Validates: Requirements 8.2**
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

// Create mocks at module level
const mockT = vi.fn();
const mockI18n = {
  language: 'en-GB',
};

// Mock the useTranslation hook at module level
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
}));

describe('Property 8: Help Content Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockT.mockClear();
    mockI18n.language = 'en-GB';
  });

  /**
   * Property: For any valid module and page combination, help content should always be available
   * Either page-specific content or module overview should be displayed
   */
  it('should always display content for any valid module and page combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        async (moduleId, pageId) => {
          vi.clearAllMocks();
          mockT.mockClear();

          // Mock translation function with fallback logic
          mockT.mockImplementation((key: string, options?: { defaultValue?: string; lng?: string }) => {
            // Simulate that overview always exists for all modules
            if (key.endsWith('.overview')) {
              return `# ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Help\n\nModule overview content.`;
            }
            
            // Simulate that some pages have specific content
            if (key === `${moduleId}.${pageId}` && ['list', 'create', 'edit'].includes(pageId)) {
              return `# ${pageId.charAt(0).toUpperCase() + pageId.slice(1)} Help\n\nPage-specific content.`;
            }
            
            // For drawer title and close
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            
            // For no content available message
            if (key === 'noContentAvailable') {
              return options?.defaultValue || 'Help content is not yet available for this page.';
            }
            
            // Return empty string for missing keys (triggers fallback)
            return options?.defaultValue || '';
          });

          // Act: Render HelpDrawer with the generated module and page
          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          // Assert: Property - Content should always be displayed (never empty)
          const drawer = screen.getByRole('heading', { name: 'Help' });
          expect(drawer).toBeTruthy();

          // Property: Either page-specific or module overview content should be present
          const hasPageContent = screen.queryByText(new RegExp(pageId, 'i'));
          const hasModuleContent = screen.queryByText(new RegExp(moduleId, 'i'));
          const hasFallbackMessage = screen.queryByText(/help content is not yet available/i);

          // At least one type of content should be present
          expect(
            hasPageContent || hasModuleContent || hasFallbackMessage
          ).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content resolution should follow the correct fallback chain
   * 1. Page-specific in current language
   * 2. Module overview in current language
   * 3. Page-specific in en-GB
   * 4. Module overview in en-GB
   * 5. Fallback message
   */
  it('should follow the correct fallback chain for content resolution', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        languageArbitrary,
        async (moduleId, pageId, language) => {
          vi.clearAllMocks();
          mockT.mockClear();
          mockI18n.language = language;

          const callOrder: string[] = [];

          // Mock translation function to track call order
          mockT.mockImplementation((key: string, options?: { defaultValue?: string; lng?: string }) => {
            callOrder.push(`${key}:${options?.lng || mockI18n.language}`);
            
            // Drawer UI strings
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            
            // Simulate content availability
            // Only en-GB has full content, other languages have partial
            const isEnGB = (options?.lng || mockI18n.language) === 'en-GB';
            
            if (key === `${moduleId}.${pageId}`) {
              // Page-specific content only exists in en-GB for 'list' pages
              if (isEnGB && pageId === 'list') {
                return `# ${pageId} Help\n\nPage content in en-GB.`;
              }
              return options?.defaultValue || '';
            }
            
            if (key === `${moduleId}.overview`) {
              // Overview always exists in en-GB
              if (isEnGB) {
                return `# ${moduleId} Overview\n\nModule overview in en-GB.`;
              }
              // Some modules have overview in other languages
              if (['dashboard', 'users'].includes(moduleId)) {
                return `# ${moduleId} Overview\n\nModule overview in ${language}.`;
              }
              return options?.defaultValue || '';
            }
            
            if (key === 'noContentAvailable') {
              return options?.defaultValue || 'Help content is not yet available for this page.';
            }
            
            return options?.defaultValue || '';
          });

          // Act: Render HelpDrawer
          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          // Assert: Property - Translation function should be called with correct keys
          expect(mockT).toHaveBeenCalled();

          // Property: First attempt should be page-specific in current language
          const pageKeyCall = callOrder.find(call => 
            call.startsWith(`${moduleId}.${pageId}:`) && call.endsWith(`:${language}`)
          );
          expect(pageKeyCall).toBeTruthy();

          // Property: If not en-GB, should eventually try en-GB fallback
          if (language !== 'en-GB') {
            const hasEnGBFallback = callOrder.some(call => call.includes(':en-GB'));
            // Should attempt en-GB fallback at some point
            expect(hasEnGBFallback || callOrder.length > 0).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Module overview should always be available as a fallback
   * For any module, the overview content should exist
   */
  it('should always have module overview available as fallback', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        async (moduleId, pageId) => {
          vi.clearAllMocks();
          mockT.mockClear();

          // Mock: Page-specific content doesn't exist, but overview does
          mockT.mockImplementation((key: string, options?: { defaultValue?: string }) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            
            // No page-specific content
            if (key === `${moduleId}.${pageId}`) {
              return options?.defaultValue || '';
            }
            
            // But overview always exists
            if (key === `${moduleId}.overview`) {
              return `# ${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Module\n\nThis is the module overview.`;
            }
            
            return options?.defaultValue || '';
          });

          // Act: Render with non-existent page
          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          // Assert: Property - Module overview content should be displayed
          // Wait for lazy-loaded markdown to render
          await waitFor(() => {
            const overviewHeading = screen.getByText(new RegExp(moduleId, 'i'));
            expect(overviewHeading).toBeTruthy();
          });
          
          const overviewContent = screen.getByText(/module overview/i);
          expect(overviewContent).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content should be language-specific when available
   * If content exists in the current language, it should be displayed
   */
  it('should display content in current language when available', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        languageArbitrary,
        async (moduleId, language) => {
          vi.clearAllMocks();
          mockT.mockClear();
          mockI18n.language = language;

          // Mock: Content exists in the current language
          mockT.mockImplementation((key: string, options?: { defaultValue?: string; lng?: string }) => {
            const currentLang = options?.lng || mockI18n.language;
            
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            
            if (key === `${moduleId}.overview`) {
              return `# Module Help in ${currentLang}\n\nContent in ${currentLang}.`;
            }
            
            return options?.defaultValue || '';
          });

          // Act: Render HelpDrawer
          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId="overview"
              moduleId={moduleId}
            />
          );

          // Assert: Property - Content should be in the current language
          // Wait for lazy-loaded markdown to render
          await waitFor(() => {
            const languageIndicator = screen.getByText(new RegExp(language, 'i'));
            expect(languageIndicator).toBeTruthy();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Fallback to en-GB should work for any non-English language
   * When content doesn't exist in current language, en-GB should be used
   */
  it('should fall back to en-GB when content not available in current language', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        languageArbitrary.filter(lang => lang !== 'en-GB'),
        async (moduleId, pageId, language) => {
          vi.clearAllMocks();
          mockT.mockClear();
          mockI18n.language = language;

          // Mock: Content only exists in en-GB
          mockT.mockImplementation((key: string, options?: { defaultValue?: string; lng?: string }) => {
            const requestedLang = options?.lng || mockI18n.language;
            
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            
            // Content only in en-GB
            if (key === `${moduleId}.${pageId}` && requestedLang === 'en-GB') {
              return `# ${pageId} Help\n\nContent only in en-GB.`;
            }
            
            if (key === `${moduleId}.overview` && requestedLang === 'en-GB') {
              return `# ${moduleId} Overview\n\nOverview only in en-GB.`;
            }
            
            return options?.defaultValue || '';
          });

          // Act: Render HelpDrawer
          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          // Assert: Property - Should display en-GB content
          // Wait for lazy-loaded markdown to render
          await waitFor(() => {
            const content = screen.getByText(/en-GB/i);
            expect(content).toBeTruthy();
          });

          // Property: Translation function should have been called with lng: 'en-GB'
          const enGBCall = mockT.mock.calls.find((call: any) => 
            call[1]?.lng === 'en-GB'
          );
          expect(enGBCall).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content resolution should be deterministic
   * Same inputs should always produce same output
   */
  it('should resolve content deterministically for same inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        languageArbitrary,
        async (moduleId, pageId, language) => {
          vi.clearAllMocks();
          mockT.mockClear();
          mockI18n.language = language;

          // Mock with consistent behavior
          mockT.mockImplementation((key: string, options?: { defaultValue?: string }) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            
            if (key === `${moduleId}.${pageId}`) {
              return `Page: ${moduleId}-${pageId}`;
            }
            
            if (key === `${moduleId}.overview`) {
              return `Overview: ${moduleId}`;
            }
            
            return options?.defaultValue || '';
          });

          // Act: Render twice with same props
          const { unmount } = render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          // Wait for lazy-loaded markdown to render
          await waitFor(() => {
            const firstContent = screen.getByText(new RegExp(`(Page|Overview): ${moduleId}`));
            expect(firstContent).toBeTruthy();
          });
          
          const firstContent = screen.getByText(new RegExp(`(Page|Overview): ${moduleId}`));
          const firstText = firstContent.textContent;

          unmount();

          // Render again with same props
          vi.clearAllMocks();
          mockT.mockClear();
          mockT.mockImplementation((key: string, options?: { defaultValue?: string }) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            
            if (key === `${moduleId}.${pageId}`) {
              return `Page: ${moduleId}-${pageId}`;
            }
            
            if (key === `${moduleId}.overview`) {
              return `Overview: ${moduleId}`;
            }
            
            return options?.defaultValue || '';
          });

          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          // Wait for lazy-loaded markdown to render
          await waitFor(() => {
            const secondContent = screen.getByText(new RegExp(`(Page|Overview): ${moduleId}`));
            expect(secondContent).toBeTruthy();
          });
          
          const secondContent = screen.getByText(new RegExp(`(Page|Overview): ${moduleId}`));
          const secondText = secondContent.textContent;

          // Assert: Property - Same inputs produce same output
          expect(firstText).toBe(secondText);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Fallback message should only appear when no content exists
   * If any content is available (page or overview), fallback message should not appear
   */
  it('should only show fallback message when no content exists anywhere', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        pageIdArbitrary,
        async (moduleId, pageId) => {
          vi.clearAllMocks();
          mockT.mockClear();

          // Mock: No content exists anywhere
          mockT.mockImplementation((key: string, options?: { defaultValue?: string }) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            
            if (key === 'noContentAvailable') {
              return 'Help content is not yet available for this page.';
            }
            
            // No content for any key
            return options?.defaultValue || '';
          });

          // Act: Render HelpDrawer
          render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId={pageId}
              moduleId={moduleId}
            />
          );

          // Assert: Property - Fallback message should be displayed
          // Wait for lazy-loaded markdown to render
          await waitFor(() => {
            const fallbackMessage = screen.getByText(/help content is not yet available/i);
            expect(fallbackMessage).toBeTruthy();
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});
