/**
 * Unit Tests for Organization Type Locale Edge Cases
 * Feature: orgadmin-i18n
 */

import { OrganizationTypeService } from '../organization-type.service';
import { capabilityService } from '../capability.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../capability.service');

describe('OrganizationTypeService Locale Edge Cases', () => {
  let service: OrganizationTypeService;
  const mockDb = db as jest.Mocked<typeof db>;
  const mockCapabilityService = capabilityService as jest.Mocked<typeof capabilityService>;

  beforeEach(() => {
    service = new OrganizationTypeService();
    jest.clearAllMocks();
  });

  describe('Default locale is en-GB when not specified', () => {
    it('should use en-GB as default locale when not provided', async () => {
      mockCapabilityService.validateCapabilities.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({
        rows: [{
          id: '1',
          name: 'test-type',
          display_name: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          default_locale: 'en-GB',
          default_capabilities: [],
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        }]
      } as any);

      const result = await service.createOrganizationType({
        name: 'test-type',
        displayName: 'Test Type',
        description: 'Test',
        currency: 'EUR',
        language: 'en',
        defaultCapabilities: []
        // Note: defaultLocale not provided
      });

      expect(result.defaultLocale).toBe('en-GB');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['en-GB'])
      );
    });
  });

  describe('Invalid locale format returns 400 error', () => {
    it('should reject locale with invalid format - missing region', async () => {
      await expect(
        service.createOrganizationType({
          name: 'test-type',
          displayName: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          defaultLocale: 'en', // Invalid: missing region
          defaultCapabilities: []
        })
      ).rejects.toThrow('Invalid or unsupported locale: en');
    });

    it('should reject locale with invalid format - wrong case', async () => {
      await expect(
        service.createOrganizationType({
          name: 'test-type',
          displayName: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          defaultLocale: 'EN-GB', // Invalid: wrong case
          defaultCapabilities: []
        })
      ).rejects.toThrow('Invalid or unsupported locale: EN-GB');
    });

    it('should reject locale with invalid format - wrong separator', async () => {
      await expect(
        service.createOrganizationType({
          name: 'test-type',
          displayName: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          defaultLocale: 'en_GB', // Invalid: wrong separator
          defaultCapabilities: []
        })
      ).rejects.toThrow('Invalid or unsupported locale: en_GB');
    });

    it('should use default locale for empty string', async () => {
      mockCapabilityService.validateCapabilities.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({
        rows: [{
          id: '1',
          name: 'test-type',
          display_name: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          default_locale: 'en-GB',
          default_capabilities: [],
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        }]
      } as any);

      // Empty string should be treated as not provided and use default
      const result = await service.createOrganizationType({
        name: 'test-type',
        displayName: 'Test Type',
        description: 'Test',
        currency: 'EUR',
        language: 'en',
        defaultLocale: '', // Empty string
        defaultCapabilities: []
      });

      // Should fall back to default since empty is invalid
      expect(result.defaultLocale).toBe('en-GB');
    });
  });

  describe('Unsupported locale returns 400 error', () => {
    it('should reject unsupported locale - Japanese', async () => {
      await expect(
        service.createOrganizationType({
          name: 'test-type',
          displayName: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          defaultLocale: 'ja-JP', // Valid format but unsupported
          defaultCapabilities: []
        })
      ).rejects.toThrow('Invalid or unsupported locale: ja-JP');
    });

    it('should reject unsupported locale - Chinese', async () => {
      await expect(
        service.createOrganizationType({
          name: 'test-type',
          displayName: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          defaultLocale: 'zh-CN', // Valid format but unsupported
          defaultCapabilities: []
        })
      ).rejects.toThrow('Invalid or unsupported locale: zh-CN');
    });

    it('should reject unsupported locale on update', async () => {
      await expect(
        service.updateOrganizationType('1', {
          defaultLocale: 'ru-RU' // Valid format but unsupported
        })
      ).rejects.toThrow('Invalid or unsupported locale: ru-RU');
    });
  });

  describe('Fallback to en-GB for corrupted data', () => {
    it('should fall back to en-GB when database returns null locale', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: '1',
          name: 'test-type',
          display_name: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          default_locale: null, // Corrupted: null
          default_capabilities: [],
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        }]
      } as any);

      const result = await service.getOrganizationTypeById('1');

      expect(result).not.toBeNull();
      expect(result!.defaultLocale).toBe('en-GB');
    });

    it('should fall back to en-GB when database returns invalid locale', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: '1',
          name: 'test-type',
          display_name: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          default_locale: 'invalid', // Corrupted: invalid format
          default_capabilities: [],
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        }]
      } as any);

      const result = await service.getOrganizationTypeById('1');

      expect(result).not.toBeNull();
      expect(result!.defaultLocale).toBe('en-GB');
    });

    it('should fall back to en-GB when database returns unsupported locale', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: '1',
          name: 'test-type',
          display_name: 'Test Type',
          description: 'Test',
          currency: 'EUR',
          language: 'en',
          default_locale: 'ja-JP', // Corrupted: unsupported locale
          default_capabilities: [],
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        }]
      } as any);

      const result = await service.getOrganizationTypeById('1');

      expect(result).not.toBeNull();
      expect(result!.defaultLocale).toBe('en-GB');
    });
  });

  describe('Locale validation method', () => {
    it('should validate all supported locales', () => {
      const supportedLocales = ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'];
      
      supportedLocales.forEach(locale => {
        expect(service.validateLocale(locale)).toBe(true);
      });
    });

    it('should reject invalid formats', () => {
      const invalidFormats = ['en', 'EN-GB', 'en-gb', 'en_GB', '', 'invalid', 'eng-GBR'];
      
      invalidFormats.forEach(locale => {
        expect(service.validateLocale(locale)).toBe(false);
      });
    });

    it('should reject unsupported locales', () => {
      const unsupportedLocales = ['ja-JP', 'zh-CN', 'ar-SA', 'ru-RU', 'ko-KR'];
      
      unsupportedLocales.forEach(locale => {
        expect(service.validateLocale(locale)).toBe(false);
      });
    });
  });
});
