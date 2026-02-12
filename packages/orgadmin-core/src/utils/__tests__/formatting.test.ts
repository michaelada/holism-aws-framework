import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatFileSize,
  formatPhone,
  truncate,
  capitalize,
  titleCase,
  camelToReadable,
  formatStatus,
  formatList,
} from '../formatting';

describe('formatting utilities', () => {
  describe('formatDate', () => {
    it('should format date to default format', () => {
      const date = new Date('2024-01-15');
      const formatted = formatDate(date);
      expect(formatted).toBe('15/01/2024');
    });

    it('should format date with custom format', () => {
      const date = new Date('2024-01-15');
      const formatted = formatDate(date, 'yyyy-MM-dd');
      expect(formatted).toBe('2024-01-15');
    });

    it('should handle empty date', () => {
      expect(formatDate('')).toBe('');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with default settings', () => {
      const formatted = formatCurrency(1234.56);
      expect(formatted).toContain('1,234.56');
    });

    it('should format currency with custom currency', () => {
      const formatted = formatCurrency(1234.56, 'USD');
      expect(formatted).toContain('1,234.56');
    });

    it('should handle null/undefined', () => {
      expect(formatCurrency(null as any)).toBe('');
      expect(formatCurrency(undefined as any)).toBe('');
    });
  });

  describe('formatNumber', () => {
    it('should format number with thousand separators', () => {
      const formatted = formatNumber(1234567);
      expect(formatted).toContain('1,234,567');
    });

    it('should format number with decimals', () => {
      const formatted = formatNumber(1234.5678, 2);
      expect(formatted).toContain('1,234.57');
    });
  });

  describe('formatPercentage', () => {
    it('should format decimal percentage', () => {
      expect(formatPercentage(0.75, 0, true)).toBe('75%');
    });

    it('should format percentage value', () => {
      expect(formatPercentage(75, 0, false)).toBe('75%');
    });

    it('should format with decimals', () => {
      expect(formatPercentage(0.7567, 2, true)).toBe('75.67%');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('formatPhone', () => {
    it('should format 10-digit phone number', () => {
      expect(formatPhone('1234567890')).toBe('(123) 456-7890');
    });

    it('should format 11-digit phone number', () => {
      expect(formatPhone('11234567890')).toBe('1 (123) 456-7890');
    });

    it('should handle already formatted numbers', () => {
      const formatted = formatPhone('(123) 456-7890');
      expect(formatted).toBe('(123) 456-7890');
    });
  });

  describe('truncate', () => {
    it('should truncate long text', () => {
      expect(truncate('This is a long text', 10)).toBe('This is...');
    });

    it('should not truncate short text', () => {
      expect(truncate('Short', 10)).toBe('Short');
    });

    it('should use custom suffix', () => {
      expect(truncate('This is a long text', 10, '…')).toBe('This is a…');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('titleCase', () => {
    it('should convert to title case', () => {
      expect(titleCase('hello world')).toBe('Hello World');
      expect(titleCase('HELLO WORLD')).toBe('Hello World');
    });
  });

  describe('camelToReadable', () => {
    it('should convert camelCase to readable text', () => {
      expect(camelToReadable('firstName')).toBe('First Name');
      expect(camelToReadable('eventStartDate')).toBe('Event Start Date');
    });
  });

  describe('formatStatus', () => {
    it('should format status string', () => {
      expect(formatStatus('active')).toBe('Active');
      expect(formatStatus('pending_approval')).toBe('Pending Approval');
      expect(formatStatus('COMPLETED')).toBe('Completed');
    });
  });

  describe('formatList', () => {
    it('should format array as comma-separated list', () => {
      expect(formatList(['apple', 'banana', 'orange'])).toBe('apple, banana, orange');
    });

    it('should limit items and show remaining count', () => {
      expect(formatList(['apple', 'banana', 'orange', 'grape'], 2)).toBe(
        'apple, banana and 2 more'
      );
    });

    it('should handle empty array', () => {
      expect(formatList([])).toBe('');
    });
  });
});
