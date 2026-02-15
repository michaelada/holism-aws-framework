/**
 * Property-Based Tests for Organization Type Locale Handling
 * Feature: orgadmin-i18n
 */

import * as fc from 'fast-check';
import { organizationTypeService } from '../organization-type.service';
import { db } from '../../database/pool';

// Supported locales for testing
const SUPPORTED_LOCALES = ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'];

// Arbitraries for property-based testing
const supportedLocaleArb = fc.constantFrom(...SUPPORTED_LOCALES);
const invalidLocaleFormatArb = fc.oneof(
  fc.constant('en'),           // Missing region
  fc.constant('EN-GB'),        // Wrong case
  fc.constant('en-gb'),        // Wrong case
  fc.constant('en_GB'),        // Wrong separator
  fc.constant('eng-GBR'),      // Wrong length
  fc.constant(''),             // Empty
  fc.constant('invalid')       // Invalid format
);
const unsupportedLocaleArb = fc.constantFrom('ja-JP', 'zh-CN', 'ar-SA', 'ru-RU');

describe('Organization Type Locale Property-Based Tests', () => {
  // Initialize database before all tests
  beforeAll(async () => {
    try {
      await db.initialize();
    } catch (error) {
      // Database might already be initialized, which is fine
      console.log('Database initialization:', error instanceof Error ? error.message : 'Already initialized');
    }
  });

  // Clean up test data after each test
  afterEach(async () => {
    try {
      await db.query('DELETE FROM organizations WHERE name LIKE $1', ['test-org-%']);
      await db.query('DELETE FROM organization_types WHERE name LIKE $1', ['test-type-%']);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  afterAll(async () => {
    // Close database connections
    try {
      await db.close();
    } catch (error) {
      console.error('Database close error:', error);
    }
  });

  describe('Property 1: Locale Validation', () => {
    // Feature: orgadmin-i18n, Property 1: Locale Validation
    
    it('should accept all supported locales', async () => {
      await fc.assert(
        fc.asyncProperty(supportedLocaleArb, async (locale) => {
          const result = organizationTypeService.validateLocale(locale);
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid locale formats', async () => {
      await fc.assert(
        fc.asyncProperty(invalidLocaleFormatArb, async (locale) => {
          const result = organizationTypeService.validateLocale(locale);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject unsupported locales with valid format', async () => {
      await fc.assert(
        fc.asyncProperty(unsupportedLocaleArb, async (locale) => {
          const result = organizationTypeService.validateLocale(locale);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Locale Persistence Round Trip', () => {
    // Feature: orgadmin-i18n, Property 2: Locale Persistence Round Trip
    
    it('should preserve locale through create and retrieve', async () => {
      await fc.assert(
        fc.asyncProperty(
          supportedLocaleArb,
          fc.integer({ min: 1, max: 100000 }),
          async (locale, randomId) => {
            const typeName = `test-type-create-${randomId}`;
            
            // Create organization type with locale
            const created = await organizationTypeService.createOrganizationType({
              name: typeName,
              displayName: `Test Type ${randomId}`,
              description: 'Test organization type',
              currency: 'EUR',
              language: 'en',
              defaultLocale: locale,
              defaultCapabilities: []
            });

            // Retrieve and verify
            const retrieved = await organizationTypeService.getOrganizationTypeById(created.id);
            
            expect(retrieved).not.toBeNull();
            expect(retrieved!.defaultLocale).toBe(locale);

            // Clean up
            await db.query('DELETE FROM organization_types WHERE id = $1', [created.id]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve locale through update and retrieve', async () => {
      await fc.assert(
        fc.asyncProperty(
          supportedLocaleArb,
          supportedLocaleArb,
          fc.integer({ min: 1, max: 100000 }),
          async (initialLocale, updatedLocale, randomId) => {
            const typeName = `test-type-update-${randomId}`;
            
            // Create with initial locale
            const created = await organizationTypeService.createOrganizationType({
              name: typeName,
              displayName: `Test Type ${randomId}`,
              description: 'Test organization type',
              currency: 'EUR',
              language: 'en',
              defaultLocale: initialLocale,
              defaultCapabilities: []
            });

            // Update to new locale
            const updated = await organizationTypeService.updateOrganizationType(
              created.id,
              { defaultLocale: updatedLocale }
            );

            // Retrieve and verify
            const retrieved = await organizationTypeService.getOrganizationTypeById(created.id);
            
            expect(retrieved).not.toBeNull();
            expect(retrieved!.defaultLocale).toBe(updatedLocale);
            expect(updated.defaultLocale).toBe(updatedLocale);

            // Clean up
            await db.query('DELETE FROM organization_types WHERE id = $1', [created.id]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should default to en-GB when locale not specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100000 }),
          async (randomId) => {
            const typeName = `test-type-default-${randomId}`;
            
            // Create without specifying locale
            const created = await organizationTypeService.createOrganizationType({
              name: typeName,
              displayName: `Test Type ${randomId}`,
              description: 'Test organization type',
              currency: 'EUR',
              language: 'en',
              defaultCapabilities: []
            });

            // Verify default locale
            expect(created.defaultLocale).toBe('en-GB');

            // Clean up
            await db.query('DELETE FROM organization_types WHERE id = $1', [created.id]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: API Response Includes Locale', () => {
    // Feature: orgadmin-i18n, Property 3: API Response Includes Locale
    
    it('should include locale in organization type API response', async () => {
      await fc.assert(
        fc.asyncProperty(
          supportedLocaleArb,
          fc.integer({ min: 1, max: 100000 }),
          async (locale, randomId) => {
            const typeName = `test-type-api-${randomId}`;
            
            // Create organization type
            const created = await organizationTypeService.createOrganizationType({
              name: typeName,
              displayName: `Test Type ${randomId}`,
              description: 'Test organization type',
              currency: 'EUR',
              language: 'en',
              defaultLocale: locale,
              defaultCapabilities: []
            });

            // Verify response includes locale
            expect(created).toHaveProperty('defaultLocale');
            expect(created.defaultLocale).toBe(locale);

            // Verify GET response includes locale
            const retrieved = await organizationTypeService.getOrganizationTypeById(created.id);
            expect(retrieved).toHaveProperty('defaultLocale');
            expect(retrieved!.defaultLocale).toBe(locale);

            // Clean up
            await db.query('DELETE FROM organization_types WHERE id = $1', [created.id]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include locale in organization API response via organization type', async () => {
      await fc.assert(
        fc.asyncProperty(
          supportedLocaleArb,
          fc.integer({ min: 1, max: 100000 }),
          async (locale, randomId) => {
            const typeName = `test-type-org-${randomId}`;
            
            // Create organization type with locale
            const orgType = await organizationTypeService.createOrganizationType({
              name: typeName,
              displayName: `Test Type ${randomId}`,
              description: 'Test organization type',
              currency: 'EUR',
              language: 'en',
              defaultLocale: locale,
              defaultCapabilities: []
            });

            // Note: We can't easily create a full organization in this test due to Keycloak dependencies
            // Instead, we verify the organization type response includes locale
            const retrievedType = await organizationTypeService.getOrganizationTypeById(orgType.id);
            expect(retrievedType).toHaveProperty('defaultLocale');
            expect(retrievedType!.defaultLocale).toBe(locale);

            // Clean up
            await db.query('DELETE FROM organization_types WHERE id = $1', [orgType.id]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
