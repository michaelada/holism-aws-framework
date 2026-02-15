import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTime,
  formatDateTime,
  parseDate,
  getDateFnsLocale,
} from '../utils/dateFormatting';

describe('Date Formatting Utilities', () => {
  const testDate = new Date('2024-02-14T15:30:00Z');

  describe('getDateFnsLocale', () => {
    it('should return correct locale for en-GB', () => {
      const locale = getDateFnsLocale('en-GB');
      expect(locale).toBeDefined();
      expect(locale.code).toBe('en-GB');
    });

    it('should return correct locale for fr-FR', () => {
      const locale = getDateFnsLocale('fr-FR');
      expect(locale).toBeDefined();
      expect(locale.code).toBe('fr');
    });

    it('should return correct locale for es-ES', () => {
      const locale = getDateFnsLocale('es-ES');
      expect(locale).toBeDefined();
      expect(locale.code).toBe('es');
    });

    it('should return correct locale for it-IT', () => {
      const locale = getDateFnsLocale('it-IT');
      expect(locale).toBeDefined();
      expect(locale.code).toBe('it');
    });

    it('should return correct locale for de-DE', () => {
      const locale = getDateFnsLocale('de-DE');
      expect(locale).toBeDefined();
      expect(locale.code).toBe('de');
    });

    it('should return correct locale for pt-PT', () => {
      const locale = getDateFnsLocale('pt-PT');
      expect(locale).toBeDefined();
      expect(locale.code).toBe('pt');
    });

    it('should fall back to en-GB for unsupported locale', () => {
      const locale = getDateFnsLocale('invalid-locale');
      expect(locale).toBeDefined();
      expect(locale.code).toBe('en-GB');
    });
  });

  describe('formatDate', () => {
    it('should format date with en-GB locale', () => {
      const formatted = formatDate(testDate, 'dd/MM/yyyy', 'en-GB');
      expect(formatted).toBe('14/02/2024');
    });

    it('should format date with fr-FR locale', () => {
      const formatted = formatDate(testDate, 'dd/MM/yyyy', 'fr-FR');
      expect(formatted).toBe('14/02/2024');
    });

    it('should format date with different format string', () => {
      const formatted = formatDate(testDate, 'PP', 'en-GB');
      expect(formatted).toContain('Feb');
      expect(formatted).toContain('2024');
    });

    it('should handle string date input', () => {
      const formatted = formatDate('2024-02-14', 'dd/MM/yyyy', 'en-GB');
      expect(formatted).toBe('14/02/2024');
    });

    it('should handle timestamp input', () => {
      const formatted = formatDate(testDate.getTime(), 'dd/MM/yyyy', 'en-GB');
      expect(formatted).toBe('14/02/2024');
    });

    it('should handle invalid date gracefully', () => {
      const formatted = formatDate('invalid-date', 'dd/MM/yyyy', 'en-GB');
      expect(formatted).toBe('invalid-date');
    });
  });

  describe('formatTime', () => {
    it('should format time with en-GB locale', () => {
      const formatted = formatTime(testDate, 'en-GB');
      expect(formatted).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should format time with fr-FR locale', () => {
      const formatted = formatTime(testDate, 'fr-FR');
      expect(formatted).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should handle string date input', () => {
      const formatted = formatTime('2024-02-14T15:30:00', 'en-GB');
      expect(formatted).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should handle invalid date gracefully', () => {
      const formatted = formatTime('invalid-date', 'en-GB');
      expect(formatted).toBe('invalid-date');
    });
  });

  describe('formatDateTime', () => {
    it('should format datetime with en-GB locale', () => {
      const formatted = formatDateTime(testDate, 'en-GB');
      expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });

    it('should format datetime with fr-FR locale', () => {
      const formatted = formatDateTime(testDate, 'fr-FR');
      expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });

    it('should handle string date input', () => {
      const formatted = formatDateTime('2024-02-14T15:30:00', 'en-GB');
      expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });

    it('should handle invalid date gracefully', () => {
      const formatted = formatDateTime('invalid-date', 'en-GB');
      expect(formatted).toBe('invalid-date');
    });
  });

  describe('parseDate', () => {
    it('should parse date with en-GB locale', () => {
      const parsed = parseDate('14/02/2024', 'dd/MM/yyyy', 'en-GB');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getDate()).toBe(14);
      expect(parsed.getMonth()).toBe(1); // February is month 1 (0-indexed)
      expect(parsed.getFullYear()).toBe(2024);
    });

    it('should parse date with fr-FR locale', () => {
      const parsed = parseDate('14/02/2024', 'dd/MM/yyyy', 'fr-FR');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getDate()).toBe(14);
      expect(parsed.getMonth()).toBe(1);
      expect(parsed.getFullYear()).toBe(2024);
    });

    it('should round-trip date formatting and parsing', () => {
      const original = new Date('2024-02-14');
      const formatted = formatDate(original, 'dd/MM/yyyy', 'en-GB');
      const parsed = parseDate(formatted, 'dd/MM/yyyy', 'en-GB');
      
      expect(parsed.getDate()).toBe(original.getDate());
      expect(parsed.getMonth()).toBe(original.getMonth());
      expect(parsed.getFullYear()).toBe(original.getFullYear());
    });
  });

  describe('Locale-specific formatting differences', () => {
    it('should produce different month names for different locales', () => {
      const enFormatted = formatDate(testDate, 'MMMM', 'en-GB');
      const frFormatted = formatDate(testDate, 'MMMM', 'fr-FR');
      const esFormatted = formatDate(testDate, 'MMMM', 'es-ES');

      expect(enFormatted).toBe('February');
      expect(frFormatted).toBe('février');
      expect(esFormatted).toBe('febrero');
    });

    it('should produce different day names for different locales', () => {
      const enFormatted = formatDate(testDate, 'EEEE', 'en-GB');
      const frFormatted = formatDate(testDate, 'EEEE', 'fr-FR');
      const deFormatted = formatDate(testDate, 'EEEE', 'de-DE');

      expect(enFormatted).toBe('Wednesday');
      expect(frFormatted).toBe('mercredi');
      expect(deFormatted).toBe('Mittwoch');
    });
  });
});
