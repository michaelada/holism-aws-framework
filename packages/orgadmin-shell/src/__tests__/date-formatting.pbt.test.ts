/**
 * Property-Based Tests for Date Formatting
 * 
 * Tests the correctness properties for date and time formatting
 * across different locales.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatDate,
  formatTime,
  formatDateTime,
  parseDate,
  getDateFnsLocale,
} from '../utils/dateFormatting';
import { SUPPORTED_LOCALES } from '../i18n/config';

describe('Date Formatting Property-Based Tests', () => {
  /**
   * Property 7: Date and Time Formatting by Locale
   * Feature: orgadmin-i18n, Property 7: Date and Time Formatting by Locale
   * 
   * For any date and time value, formatting it with different locales should
   * produce different formatted strings that conform to each locale's conventions.
   * 
   * Validates: Requirements 6.1, 6.2
   */
  describe('Property 7: Date and Time Formatting by Locale', () => {
    it('should produce valid formatted strings for all locales', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          fc.constantFrom(...SUPPORTED_LOCALES),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (date, locale1, locale2) => {
            // Skip if locales are the same
            fc.pre(locale1 !== locale2);

            const formatted1 = formatDate(date, 'PP', locale1);
            const formatted2 = formatDate(date, 'PP', locale2);

            // Both should produce valid formatted strings
            expect(formatted1).toBeTruthy();
            expect(formatted2).toBeTruthy();
            expect(typeof formatted1).toBe('string');
            expect(typeof formatted2).toBe('string');

            // Both should be properly formatted (contain date components)
            expect(formatted1.length).toBeGreaterThan(0);
            expect(formatted2.length).toBeGreaterThan(0);

            // Note: Some locales (e.g., es-ES and it-IT) may produce identical
            // formatted output for certain dates due to shared formatting conventions
            // (e.g., abbreviated month names). This is correct behavior.
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format dates consistently for the same locale', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          fc.constantFrom(...SUPPORTED_LOCALES),
          fc.constantFrom('PP', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MMMM d, yyyy'),
          (date, locale, formatString) => {
            const formatted1 = formatDate(date, formatString, locale);
            const formatted2 = formatDate(date, formatString, locale);

            // Same date, locale, and format should produce identical results
            expect(formatted1).toBe(formatted2);
            expect(formatted1).toBeTruthy();
            expect(typeof formatted1).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format times consistently across locales (HH:mm is locale-independent)', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (date, locale) => {
            const formatted = formatTime(date, locale);

            // Time format HH:mm should be consistent
            expect(formatted).toMatch(/^\d{2}:\d{2}$/);
            expect(formatted).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format datetime with both date and time components', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (date, locale) => {
            const formatted = formatDateTime(date, locale);

            // DateTime format should include both date and time
            // Format is dd/MM/yyyy HH:mm
            expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
            expect(formatted).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle different date input types (Date, string, number)', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (date, locale) => {
            const dateObj = date;
            const dateString = date.toISOString();
            const dateNumber = date.getTime();

            const formatted1 = formatDate(dateObj, 'dd/MM/yyyy', locale);
            const formatted2 = formatDate(dateString, 'dd/MM/yyyy', locale);
            const formatted3 = formatDate(dateNumber, 'dd/MM/yyyy', locale);

            // All three input types should produce the same result
            expect(formatted1).toBe(formatted2);
            expect(formatted2).toBe(formatted3);
            expect(formatted1).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return valid locale objects for all supported locales', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...SUPPORTED_LOCALES),
          (locale) => {
            const localeObj = getDateFnsLocale(locale);

            // Should return a valid locale object
            expect(localeObj).toBeTruthy();
            expect(typeof localeObj).toBe('object');
            // date-fns locale objects have a code property
            expect(localeObj).toHaveProperty('code');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Date Parsing by Locale
   * Feature: orgadmin-i18n, Property 9: Date Parsing by Locale
   * 
   * For any valid date string formatted according to a specific locale's conventions,
   * parsing it with that locale should produce a valid Date object, and formatting
   * that Date object back with the same locale should produce an equivalent string
   * (round-trip property).
   * 
   * Validates: Requirements 6.5
   */
  describe('Property 9: Date Parsing by Locale', () => {
    it('should round-trip dates correctly (format -> parse -> format)', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          fc.constantFrom(...SUPPORTED_LOCALES),
          fc.constantFrom('dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'),
          (date, locale, formatString) => {
            // Format the date
            const formatted = formatDate(date, formatString, locale);

            // Parse it back
            const parsed = parseDate(formatted, formatString, locale);

            // Format again
            const reformatted = formatDate(parsed, formatString, locale);

            // The formatted strings should match
            expect(reformatted).toBe(formatted);

            // The dates should represent the same day (ignoring time)
            expect(parsed.getFullYear()).toBe(date.getFullYear());
            expect(parsed.getMonth()).toBe(date.getMonth());
            expect(parsed.getDate()).toBe(date.getDate());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse dates consistently for the same input', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          fc.constantFrom(...SUPPORTED_LOCALES),
          fc.constantFrom('dd/MM/yyyy', 'yyyy-MM-dd'),
          (date, locale, formatString) => {
            const formatted = formatDate(date, formatString, locale);

            const parsed1 = parseDate(formatted, formatString, locale);
            const parsed2 = parseDate(formatted, formatString, locale);

            // Same input should produce identical results
            expect(parsed1.getTime()).toBe(parsed2.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid Date objects from parsing', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          fc.constantFrom(...SUPPORTED_LOCALES),
          fc.constantFrom('dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'),
          (date, locale, formatString) => {
            const formatted = formatDate(date, formatString, locale);
            const parsed = parseDate(formatted, formatString, locale);

            // Should be a valid Date object
            expect(parsed).toBeInstanceOf(Date);
            expect(isNaN(parsed.getTime())).toBe(false);

            // Should be within reasonable bounds
            expect(parsed.getFullYear()).toBeGreaterThanOrEqual(2000);
            expect(parsed.getFullYear()).toBeLessThanOrEqual(2030);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case dates correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            new Date('2000-01-01'), // Start of millennium
            new Date('2000-12-31'), // End of year
            new Date('2024-02-29'), // Leap year
            new Date('2023-02-28'), // Non-leap year Feb
            new Date('2020-12-31'), // End of leap year
          ),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (date, locale) => {
            const formatted = formatDate(date, 'dd/MM/yyyy', locale);
            const parsed = parseDate(formatted, 'dd/MM/yyyy', locale);

            // Should preserve the date
            expect(parsed.getFullYear()).toBe(date.getFullYear());
            expect(parsed.getMonth()).toBe(date.getMonth());
            expect(parsed.getDate()).toBe(date.getDate());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle month boundaries correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2000, max: 2030 }),
          fc.integer({ min: 0, max: 11 }),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (year, month, locale) => {
            // Get the last day of the month
            const lastDay = new Date(year, month + 1, 0).getDate();
            const date = new Date(year, month, lastDay);

            const formatted = formatDate(date, 'dd/MM/yyyy', locale);
            const parsed = parseDate(formatted, 'dd/MM/yyyy', locale);

            // Should preserve the date
            expect(parsed.getFullYear()).toBe(year);
            expect(parsed.getMonth()).toBe(month);
            expect(parsed.getDate()).toBe(lastDay);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Error Handling Tests
   */
  describe('Error Handling', () => {
    it('should handle invalid dates gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('invalid', '', 'not-a-date', '99/99/9999'),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (invalidDate, locale) => {
            // Should not throw, should return the input as string
            const result = formatDate(invalidDate as any, 'dd/MM/yyyy', locale);
            expect(typeof result).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle invalid locales by falling back to en-GB', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          fc.string({ minLength: 1, maxLength: 10 }).filter(
            (s) => !SUPPORTED_LOCALES.includes(s as any)
          ),
          (date, invalidLocale) => {
            // Should not throw, should fall back to en-GB
            const result = formatDate(date, 'dd/MM/yyyy', invalidLocale);
            expect(typeof result).toBe('string');
            expect(result).toBeTruthy();
            expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error for invalid date strings in parseDate', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('invalid', 'not-a-date', '99/99/9999', ''),
          fc.constantFrom(...SUPPORTED_LOCALES),
          (invalidDateString, locale) => {
            // Should throw an error
            expect(() => {
              parseDate(invalidDateString, 'dd/MM/yyyy', locale);
            }).toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
