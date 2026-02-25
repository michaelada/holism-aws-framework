/**
 * Property-Based Tests for Markdown Rendering in HelpDrawer
 * 
 * Feature: onboarding-and-help-system
 * Property 9: Markdown Rendering
 * 
 * For any help content containing markdown syntax (headings, lists, links, bold, italic),
 * the system should render it as properly formatted HTML in the help drawer.
 * 
 * **Validates: Requirements 8.4, 11.4**
 */

import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpDrawer } from '../HelpDrawer';
import { ModuleId } from '../../context/OnboardingContext';

// Mock translation function
const mockT = vi.fn();
const mockI18n = {
  language: 'en-GB',
};

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
}));

/**
 * Arbitrary generator for module IDs
 */
const moduleIdArbitrary = fc.constantFrom<ModuleId>(
  'dashboard', 'users', 'forms', 'events', 'memberships', 'calendar', 'payments'
);

describe('Property 9: Markdown Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockT.mockClear();
    mockI18n.language = 'en-GB';
  });

  /**
   * Property: For any markdown heading (h1-h6), the system should render it as proper HTML heading
   */
  it('should render markdown headings as proper HTML heading elements', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        fc.constantFrom(1, 2, 3, 4, 5, 6),
        async (moduleId, level) => {
          vi.clearAllMocks();
          mockT.mockClear();

          const markdown = `${'#'.repeat(level)} Test Heading`;

          // Mock translation to return markdown content
          mockT.mockImplementation((key: string) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            if (key === `${moduleId}.overview`) {
              return markdown;
            }
            return '';
          });

          // Act: Render HelpDrawer
          const { unmount } = render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId="overview"
              moduleId={moduleId}
            />
          );

          // Assert: Property - Heading should be rendered as proper HTML element
          // Note: MUI Drawer renders in a portal, we need to find all headings and check for our content
          // The drawer has an h2 title "Help", so we need to find headings that contain "Test Heading"
          const allHeadings = Array.from(document.body.querySelectorAll(`h${level}`));
          const headingElement = allHeadings.find(h => h.textContent?.includes('Test Heading'));
          expect(headingElement).toBeTruthy();
          expect(headingElement?.textContent).toContain('Test Heading');

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any markdown list, the system should render it as proper HTML list
   */
  it('should render markdown lists as proper HTML ul elements', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (moduleId) => {
          vi.clearAllMocks();
          mockT.mockClear();

          const markdown = '- Item 1\n- Item 2\n- Item 3';

          // Mock translation to return markdown content
          mockT.mockImplementation((key: string) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            if (key === `${moduleId}.overview`) {
              return markdown;
            }
            return '';
          });

          // Act: Render HelpDrawer
          const { unmount } = render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId="overview"
              moduleId={moduleId}
            />
          );

          // Assert: Property - List should be rendered as ul with li elements
          const ulElement = document.body.querySelector('ul');
          expect(ulElement).toBeTruthy();
          
          const liElements = document.body.querySelectorAll('li');
          expect(liElements.length).toBe(3);

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any markdown link, the system should render it as proper HTML anchor
   */
  it('should render markdown links as proper HTML anchor elements', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        fc.webUrl().filter(url => !url.includes('(') && !url.includes(')')), // Filter out URLs with parentheses which break markdown
        async (moduleId, url) => {
          vi.clearAllMocks();
          mockT.mockClear();

          const markdown = `[Click here](${url})`;

          // Mock translation to return markdown content
          mockT.mockImplementation((key: string) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            if (key === `${moduleId}.overview`) {
              return markdown;
            }
            return '';
          });

          // Act: Render HelpDrawer
          const { unmount } = render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId="overview"
              moduleId={moduleId}
            />
          );

          // Assert: Property - Link should be rendered as anchor element
          const linkElement = document.body.querySelector('a[href]');
          expect(linkElement).toBeTruthy();
          expect(linkElement?.getAttribute('href')).toBe(url);

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any markdown bold text, the system should render it with strong emphasis
   */
  it('should render markdown bold text as proper HTML strong elements', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (moduleId) => {
          vi.clearAllMocks();
          mockT.mockClear();

          const markdown = 'This is **bold text** in a sentence.';

          // Mock translation to return markdown content
          mockT.mockImplementation((key: string) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            if (key === `${moduleId}.overview`) {
              return markdown;
            }
            return '';
          });

          // Act: Render HelpDrawer
          const { unmount } = render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId="overview"
              moduleId={moduleId}
            />
          );

          // Assert: Property - Bold text should be rendered with strong element
          const strongElement = document.body.querySelector('strong');
          expect(strongElement).toBeTruthy();
          expect(strongElement?.textContent).toBe('bold text');

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any markdown italic text, the system should render it with emphasis
   */
  it('should render markdown italic text as proper HTML em elements', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (moduleId) => {
          vi.clearAllMocks();
          mockT.mockClear();

          const markdown = 'This is *italic text* in a sentence.';

          // Mock translation to return markdown content
          mockT.mockImplementation((key: string) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            if (key === `${moduleId}.overview`) {
              return markdown;
            }
            return '';
          });

          // Act: Render HelpDrawer
          const { unmount } = render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId="overview"
              moduleId={moduleId}
            />
          );

          // Assert: Property - Italic text should be rendered with em element
          const emElement = document.body.querySelector('em');
          expect(emElement).toBeTruthy();
          expect(emElement?.textContent).toBe('italic text');

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any combination of markdown elements, all should be rendered correctly
   */
  it('should render complex markdown with multiple elements correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        async (moduleId) => {
          vi.clearAllMocks();
          mockT.mockClear();

          // Create complex markdown
          const complexMarkdown = `# Main Heading\n\nThis is **bold** and *italic* text.\n\n- List item 1\n- List item 2\n\n[Link text](https://example.com)`;

          // Mock translation to return markdown content
          mockT.mockImplementation((key: string) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            if (key === `${moduleId}.overview`) {
              return complexMarkdown;
            }
            return '';
          });

          // Act: Render HelpDrawer
          const { unmount } = render(
            <HelpDrawer
              open={true}
              onClose={() => {}}
              pageId="overview"
              moduleId={moduleId}
            />
          );

          // Assert: Property - All elements should be rendered correctly
          expect(document.body.querySelector('h1')).toBeTruthy();
          expect(document.body.querySelector('strong')).toBeTruthy();
          expect(document.body.querySelector('em')).toBeTruthy();
          expect(document.body.querySelector('ul')).toBeTruthy();
          expect(document.body.querySelectorAll('li').length).toBe(2);
          expect(document.body.querySelector('a[href]')).toBeTruthy();

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Markdown rendering should be consistent across different modules
   */
  it('should render markdown consistently across all modules', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(moduleIdArbitrary, { minLength: 2, maxLength: 7 }),
        async (moduleIds) => {
          const markdown = '# Test Heading\n\nThis is **bold** text.';
          const results: { hasH1: boolean; hasStrong: boolean }[] = [];

          for (const moduleId of moduleIds) {
            vi.clearAllMocks();
            mockT.mockClear();

            // Mock translation
            mockT.mockImplementation((key: string) => {
              if (key === 'drawer.title') return 'Help';
              if (key === 'drawer.close') return 'Close help';
              if (key === `${moduleId}.overview`) {
                return markdown;
              }
              return '';
            });

            // Act: Render HelpDrawer
            const { unmount } = render(
              <HelpDrawer
                open={true}
                onClose={() => {}}
                pageId="overview"
                moduleId={moduleId}
              />
            );

            // Collect results
            results.push({
              hasH1: !!document.body.querySelector('h1'),
              hasStrong: !!document.body.querySelector('strong'),
            });

            unmount();
          }

          // Property: All modules should render the same markdown consistently
          const allHaveH1 = results.every(r => r.hasH1);
          const allHaveStrong = results.every(r => r.hasStrong);
          expect(allHaveH1).toBe(true);
          expect(allHaveStrong).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Empty or whitespace-only markdown should not cause errors
   */
  it('should handle empty or whitespace-only markdown gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleIdArbitrary,
        fc.constantFrom('', '   ', '\n', '\n\n', '  \n  '),
        async (moduleId, emptyMarkdown) => {
          vi.clearAllMocks();
          mockT.mockClear();

          // Mock translation to return empty/whitespace markdown
          mockT.mockImplementation((key: string) => {
            if (key === 'drawer.title') return 'Help';
            if (key === 'drawer.close') return 'Close help';
            if (key === `${moduleId}.overview`) {
              return emptyMarkdown;
            }
            return '';
          });

          // Act: Render HelpDrawer - should not throw
          expect(() => {
            const { unmount } = render(
              <HelpDrawer
                open={true}
                onClose={() => {}}
                pageId="overview"
                moduleId={moduleId}
              />
            );
            unmount();
          }).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });
});
