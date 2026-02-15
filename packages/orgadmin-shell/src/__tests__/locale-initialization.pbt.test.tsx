/**
 * Property-Based Tests for Locale Initialization
 * 
 * Tests the correctness properties for i18n locale initialization,
 * persistence, and organization switching.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';
import { LocaleProvider, useLocale } from '../context/LocaleContext';
import { OrganisationProvider } from '../context/OrganisationContext';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../i18n/config';
import type { Organisation } from '../context/OrganisationContext';

// Mock i18n - must be defined before the mock
vi.mock('../i18n/config', () => {
  const mockChangeLanguage = vi.fn().mockResolvedValue(undefined);
  const mockPreloadTranslation = vi.fn().mockResolvedValue(undefined);
  return {
    SUPPORTED_LOCALES: ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'],
    DEFAULT_LOCALE: 'en-GB',
    default: {
      language: 'en-GB',
      changeLanguage: mockChangeLanguage,
    },
    initializeI18n: vi.fn(),
    preloadTranslation: mockPreloadTranslation,
  };
});

// Import the mocked i18n after the mock is set up
import i18n from '../i18n/config';

describe('Locale Initialization Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (i18n.changeLanguage as any).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 4: Organization Locale Initialization
   * Feature: orgadmin-i18n, Property 4: Organization Locale Initialization
   * 
   * For any organization with a configured locale, when the frontend loads
   * that organization's data, the active i18n locale should be set to match
   * the organization's default_locale.
   * 
   * Validates: Requirements 3.3, 8.1
   */
  describe('Property 4: Organization Locale Initialization', () => {
    it('should set locale from organization data for any valid locale', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...SUPPORTED_LOCALES),
          async (locale) => {
            // Reset mock before each test
            (i18n.changeLanguage as any).mockClear();
            
            // Render LocaleProvider with organization locale
            const { result, unmount } = renderHook(() => useLocale(), {
              wrapper: ({ children }) => (
                <LocaleProvider organizationLocale={locale}>
                  {children}
                </LocaleProvider>
              ),
            });

            // Wait for locale to be set
            await waitFor(() => {
              expect(result.current.locale).toBe(locale);
            }, { timeout: 1000 });

            // Verify i18n.changeLanguage was called with the correct locale
            // Note: If locale is same as initial (en-GB), changeLanguage may not be called
            if (locale !== 'en-GB') {
              expect(i18n.changeLanguage).toHaveBeenCalledWith(locale);
            }
            
            // Cleanup
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should default to en-GB when organization has no locale', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async (orgData) => {
            // Reset mock
            (i18n.changeLanguage as any).mockClear();
            
            // Render LocaleProvider without organization locale
            const { result, unmount } = renderHook(() => useLocale(), {
              wrapper: ({ children }) => (
                <LocaleProvider organizationLocale={undefined}>
                  {children}
                </LocaleProvider>
              ),
            });

            // Should default to en-GB
            await waitFor(() => {
              expect(result.current.locale).toBe(DEFAULT_LOCALE);
            }, { timeout: 1000 });
            
            // Cleanup
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fallback to en-GB for invalid locale', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).filter(
            (s) => !SUPPORTED_LOCALES.includes(s as any)
          ),
          async (invalidLocale) => {
            // Reset mock
            (i18n.changeLanguage as any).mockClear();
            
            // Render LocaleProvider with invalid locale
            const { result, unmount } = renderHook(() => useLocale(), {
              wrapper: ({ children }) => (
                <LocaleProvider organizationLocale={invalidLocale}>
                  {children}
                </LocaleProvider>
              ),
            });

            // Should fallback to default locale
            await waitFor(() => {
              expect(result.current.locale).toBe(DEFAULT_LOCALE);
            }, { timeout: 1000 });
            
            // Cleanup
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 11: Locale Persistence Across Navigation
   * Feature: orgadmin-i18n, Property 11: Locale Persistence Across Navigation
   * 
   * For any active locale set during a user session, navigating between
   * different pages within the application should maintain the same active
   * locale without reverting to the default.
   * 
   * Validates: Requirements 8.4
   */
  describe('Property 11: Locale Persistence Across Navigation', () => {
    it('should maintain locale across component re-renders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...SUPPORTED_LOCALES),
          fc.integer({ min: 1, max: 10 }),
          async (locale, rerenderCount) => {
            // Reset mock
            (i18n.changeLanguage as any).mockClear();
            
            // Render LocaleProvider with a specific locale
            const { result, rerender, unmount } = renderHook(() => useLocale(), {
              wrapper: ({ children }) => (
                <LocaleProvider organizationLocale={locale}>
                  {children}
                </LocaleProvider>
              ),
            });

            // Wait for initial locale to be set
            await waitFor(() => {
              expect(result.current.locale).toBe(locale);
            }, { timeout: 1000 });

            const initialLocale = result.current.locale;

            // Simulate navigation by re-rendering multiple times
            for (let i = 0; i < rerenderCount; i++) {
              rerender();
              
              // Locale should remain the same
              expect(result.current.locale).toBe(initialLocale);
            }
            
            // Cleanup
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist locale when organization context updates without locale change', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...SUPPORTED_LOCALES),
          fc.record({
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
            status: fc.constantFrom('active', 'inactive', 'blocked'),
          }),
          async (locale, updates) => {
            // Reset mock
            (i18n.changeLanguage as any).mockClear();
            
            let organization: Organisation = {
              id: 'test-org-id',
              organizationTypeId: 'test-type-id',
              keycloakGroupId: 'test-group-id',
              name: 'test-org',
              displayName: 'Test Organization',
              status: 'active',
              enabledCapabilities: [],
              settings: {},
              createdAt: new Date(),
              updatedAt: new Date(),
              organizationType: {
                id: 'test-type-id',
                name: 'test-type',
                displayName: 'Test Type',
                defaultLocale: locale,
              },
            };

            const TestComponent = () => {
              const { locale: currentLocale } = useLocale();
              return <div data-testid="locale">{currentLocale}</div>;
            };

            const { rerender, unmount } = render(
              <LocaleProvider organizationLocale={locale}>
                <OrganisationProvider organisation={organization}>
                  <TestComponent />
                </OrganisationProvider>
              </LocaleProvider>
            );

            // Wait for initial locale
            await waitFor(() => {
              expect(screen.getByTestId('locale').textContent).toBe(locale);
            }, { timeout: 2000 });

            // Update organization (but not locale)
            organization = {
              ...organization,
              ...updates,
            };

            rerender(
              <LocaleProvider organizationLocale={locale}>
                <OrganisationProvider organisation={organization}>
                  <TestComponent />
                </OrganisationProvider>
              </LocaleProvider>
            );

            // Locale should remain the same
            await waitFor(() => {
              expect(screen.getByTestId('locale').textContent).toBe(locale);
            }, { timeout: 2000 });
            
            // Cleanup
            unmount();
          }
        ),
        { numRuns: 50, timeout: 10000 }
      );
    });
  });

  /**
   * Property 12: Organization Switch Updates Locale
   * Feature: orgadmin-i18n, Property 12: Organization Switch Updates Locale
   * 
   * For any two organizations with different configured locales, when a user
   * switches from one organization to the other, the active locale should
   * update to match the new organization's locale.
   * 
   * Validates: Requirements 8.5
   */
  describe('Property 12: Organization Switch Updates Locale', () => {
    it('should update locale when switching between organizations with different locales', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...SUPPORTED_LOCALES),
          fc.constantFrom(...SUPPORTED_LOCALES),
          async (locale1, locale2) => {
            // Skip if locales are the same
            fc.pre(locale1 !== locale2);
            
            // Reset mock
            (i18n.changeLanguage as any).mockClear();

            const TestComponent = () => {
              const { locale } = useLocale();
              return <div data-testid="locale">{locale}</div>;
            };

            // Render with first organization
            const { rerender, unmount } = render(
              <LocaleProvider organizationLocale={locale1}>
                <TestComponent />
              </LocaleProvider>
            );

            // Wait for first locale to be set
            await waitFor(() => {
              expect(screen.getByTestId('locale').textContent).toBe(locale1);
            }, { timeout: 1000 });

            // Switch to second organization
            rerender(
              <LocaleProvider organizationLocale={locale2}>
                <TestComponent />
              </LocaleProvider>
            );

            // Locale should update to second organization's locale
            await waitFor(() => {
              expect(screen.getByTestId('locale').textContent).toBe(locale2);
            }, { timeout: 1000 });

            // Verify i18n.changeLanguage was called at least once
            // (The exact number of calls depends on whether locales match the default)
            expect(i18n.changeLanguage).toHaveBeenCalled();
            
            // Cleanup
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle rapid organization switches correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...SUPPORTED_LOCALES), { minLength: 2, maxLength: 5 }),
          async (locales) => {
            // Reset mock
            (i18n.changeLanguage as any).mockClear();
            
            const TestComponent = () => {
              const { locale } = useLocale();
              return <div data-testid="locale">{locale}</div>;
            };

            const { rerender, unmount } = render(
              <LocaleProvider organizationLocale={locales[0]}>
                <TestComponent />
              </LocaleProvider>
            );

            // Wait for initial locale
            await waitFor(() => {
              const element = screen.getByTestId('locale');
              expect(element.textContent).toBe(locales[0]);
            }, { timeout: 1000 });

            // Rapidly switch through all locales
            for (let i = 1; i < locales.length; i++) {
              rerender(
                <LocaleProvider organizationLocale={locales[i]}>
                  <TestComponent />
                </LocaleProvider>
              );

              // Wait for locale to update
              await waitFor(() => {
                const element = screen.getByTestId('locale');
                expect(element.textContent).toBe(locales[i]);
              }, { timeout: 1000 });
            }

            // Verify final locale is correct
            const finalLocale = locales[locales.length - 1];
            const element = screen.getByTestId('locale');
            expect(element.textContent).toBe(finalLocale);
            
            // Cleanup
            unmount();
          }
        ),
        { numRuns: 50, timeout: 10000 }
      );
    });
  });
});
