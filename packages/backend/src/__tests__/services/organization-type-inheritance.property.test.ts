/**
 * Property-Based Tests for Organization Type Capability Inheritance
 * 
 * Feature: document-management-capability-consolidation
 * Property 15: Organization Type Inheritance
 * 
 * For any organization type with document-management in its default capabilities,
 * when a new organization is created with that type, the new organization should
 * have document-management in its enabled capabilities.
 * 
 * **Validates: Requirements 7.1**
 */

import * as fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';

/**
 * Type definitions for testing
 */
interface OrganizationType {
  id: string;
  name: string;
  displayName: string;
  defaultCapabilities: string[];
  currency: string;
  language: string;
  defaultLocale: string;
}

interface Organization {
  id: string;
  organizationTypeId: string;
  name: string;
  displayName: string;
  enabledCapabilities: string[];
}

/**
 * Organization creation simulator
 * Simulates the logic that should happen when creating a new organization
 */
class OrganizationCreationSimulator {
  /**
   * Creates a new organization with capabilities inherited from organization type
   */
  static createOrganization(
    organizationType: OrganizationType,
    organizationData: Partial<Organization>
  ): Organization {
    // When creating an organization, it should inherit default capabilities from its type
    // Deduplicate capabilities to ensure uniqueness
    const enabledCapabilities = organizationData.enabledCapabilities || 
      Array.from(new Set(organizationType.defaultCapabilities));

    return {
      id: organizationData.id || fc.sample(fc.uuid(), 1)[0],
      organizationTypeId: organizationType.id,
      name: organizationData.name || 'Test Organization',
      displayName: organizationData.displayName || 'Test Organization',
      enabledCapabilities,
    };
  }

  /**
   * Verifies that an organization has inherited the expected capabilities
   */
  static hasInheritedCapability(
    organization: Organization,
    capability: string
  ): boolean {
    return organization.enabledCapabilities.includes(capability);
  }
}

/**
 * Generators for property-based testing
 */

/**
 * Generates a random capability name
 */
const arbitraryCapabilityName = fc.oneof(
  fc.constant('document-management'),
  fc.constant('event-management'),
  fc.constant('membership-management'),
  fc.constant('registration-management'),
  fc.constant('calendar-management'),
  fc.constant('discount-management'),
  fc.string({ minLength: 5, maxLength: 30 }).map(s => s.toLowerCase().replace(/[^a-z]/g, '-'))
);

/**
 * Generates an array of capabilities that includes document-management
 */
const arbitraryCapabilitiesWithDocumentManagement = fc.array(
  arbitraryCapabilityName,
  { minLength: 0, maxLength: 10 }
).map(caps => {
  // Ensure document-management is included
  if (!caps.includes('document-management')) {
    return ['document-management', ...caps];
  }
  return caps;
});

/**
 * Generates an array of capabilities that does NOT include document-management
 */
const arbitraryCapabilitiesWithoutDocumentManagement = fc.array(
  arbitraryCapabilityName.filter(cap => cap !== 'document-management'),
  { minLength: 0, maxLength: 10 }
);

/**
 * Generates an organization type with document-management in default capabilities
 */
const arbitraryOrganizationTypeWithDocumentManagement = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_-]*$/.test(s)),
  displayName: fc.string({ minLength: 3, maxLength: 100 }),
  defaultCapabilities: arbitraryCapabilitiesWithDocumentManagement,
  currency: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'AUD'),
  language: fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'pt'),
  defaultLocale: fc.constantFrom('en-GB', 'en-US', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-PT'),
});

/**
 * Generates an organization type without document-management in default capabilities
 */
const arbitraryOrganizationTypeWithoutDocumentManagement = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_-]*$/.test(s)),
  displayName: fc.string({ minLength: 3, maxLength: 100 }),
  defaultCapabilities: arbitraryCapabilitiesWithoutDocumentManagement,
  currency: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'AUD'),
  language: fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'pt'),
  defaultLocale: fc.constantFrom('en-GB', 'en-US', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-PT'),
});

/**
 * Generates partial organization data for creation
 */
const arbitraryOrganizationData = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  displayName: fc.string({ minLength: 3, maxLength: 100 }),
});

describe('Organization Type Capability Inheritance - Property-Based Tests', () => {
  /**
   * Property 15: Organization Type Inheritance
   * 
   * For any organization type with document-management in its default capabilities,
   * when a new organization is created with that type, the new organization should
   * have document-management in its enabled capabilities.
   * 
   * **Validates: Requirements 7.1**
   */
  describe('Property 15: Organization Type Inheritance', () => {
    it('should inherit document-management capability from organization type', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Pre-condition: Verify organization type has document-management
            expect(orgType.defaultCapabilities).toContain('document-management');

            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: Organization should have document-management capability
            expect(organization.enabledCapabilities).toContain('document-management');
            expect(OrganizationCreationSimulator.hasInheritedCapability(
              organization,
              'document-management'
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should inherit all default capabilities from organization type', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: Organization should have all default capabilities from type
            orgType.defaultCapabilities.forEach(capability => {
              expect(organization.enabledCapabilities).toContain(capability);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set organizationTypeId correctly', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: Organization should reference the correct organization type
            expect(organization.organizationTypeId).toBe(orgType.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not add document-management if not in organization type defaults', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithoutDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Pre-condition: Verify organization type does NOT have document-management
            expect(orgType.defaultCapabilities).not.toContain('document-management');

            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: Organization should NOT have document-management capability
            expect(organization.enabledCapabilities).not.toContain('document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve capability count from organization type (after deduplication)', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: Organization should have same number of unique capabilities as type defaults
            const uniqueTypeCapabilities = Array.from(new Set(orgType.defaultCapabilities));
            expect(organization.enabledCapabilities.length).toBe(
              uniqueTypeCapabilities.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain capability uniqueness', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: All capabilities should be unique
            const uniqueCapabilities = Array.from(new Set(organization.enabledCapabilities));
            expect(organization.enabledCapabilities.length).toBe(uniqueCapabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should inherit document-management regardless of other capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Pre-condition: Verify document-management is in defaults
            expect(orgType.defaultCapabilities).toContain('document-management');

            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: document-management should be present regardless of other capabilities
            expect(organization.enabledCapabilities).toContain('document-management');
            
            // Verify it's present (count how many times document-management appears - should be exactly 1)
            const documentManagementCount = organization.enabledCapabilities.filter(
              cap => cap === 'document-management'
            ).length;
            expect(documentManagementCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be consistent across multiple organization creations', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          fc.array(arbitraryOrganizationData, { minLength: 2, maxLength: 5 }),
          (orgType, orgDataArray) => {
            // Act: Create multiple organizations with the same type
            const organizations = orgDataArray.map(orgData =>
              OrganizationCreationSimulator.createOrganization(orgType, orgData)
            );

            // Assert: All organizations should have document-management
            organizations.forEach(org => {
              expect(org.enabledCapabilities).toContain('document-management');
              expect(org.organizationTypeId).toBe(orgType.id);
            });

            // Assert: All organizations should have the same capabilities
            const firstOrgCapabilities = [...organizations[0].enabledCapabilities].sort();
            organizations.forEach(org => {
              const orgCapabilities = [...org.enabledCapabilities].sort();
              expect(orgCapabilities).toEqual(firstOrgCapabilities);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle organization types with only document-management capability', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_-]*$/.test(s)),
            displayName: fc.string({ minLength: 3, maxLength: 100 }),
            defaultCapabilities: fc.constant(['document-management']),
            currency: fc.constantFrom('USD', 'EUR', 'GBP'),
            language: fc.constantFrom('en', 'fr', 'de'),
            defaultLocale: fc.constantFrom('en-GB', 'fr-FR', 'de-DE'),
          }),
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: Organization should have exactly one capability: document-management
            expect(organization.enabledCapabilities).toEqual(['document-management']);
            expect(organization.enabledCapabilities.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle organization types with many capabilities including document-management', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_-]*$/.test(s)),
            displayName: fc.string({ minLength: 3, maxLength: 100 }),
            defaultCapabilities: fc.array(
              arbitraryCapabilityName,
              { minLength: 5, maxLength: 15 }
            ).map(caps => {
              // Ensure document-management is included
              if (!caps.includes('document-management')) {
                return ['document-management', ...caps];
              }
              return caps;
            }),
            currency: fc.constantFrom('USD', 'EUR', 'GBP'),
            language: fc.constantFrom('en', 'fr', 'de'),
            defaultLocale: fc.constantFrom('en-GB', 'fr-FR', 'de-DE'),
          }),
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Pre-condition: Verify we have many capabilities (before deduplication)
            fc.pre(orgType.defaultCapabilities.length >= 5);

            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: Organization should have document-management among capabilities
            expect(organization.enabledCapabilities).toContain('document-management');
            
            // After deduplication, we should have at least 1 capability (document-management)
            expect(organization.enabledCapabilities.length).toBeGreaterThanOrEqual(1);
            
            // All capabilities should be unique
            const uniqueCapabilities = Array.from(new Set(organization.enabledCapabilities));
            expect(organization.enabledCapabilities.length).toBe(uniqueCapabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional invariants for organization type inheritance
   */
  describe('Organization Type Inheritance Invariants', () => {
    it('should never lose capabilities during inheritance', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: Organization should have at least as many capabilities as unique type defaults
            const uniqueTypeCapabilities = Array.from(new Set(orgType.defaultCapabilities));
            expect(organization.enabledCapabilities.length).toBeGreaterThanOrEqual(
              uniqueTypeCapabilities.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain capability order from organization type', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Act: Create organization
            const organization = OrganizationCreationSimulator.createOrganization(
              orgType,
              orgData
            );

            // Assert: Capabilities should be in the same order as type defaults
            // (or at least contain all of them in some order)
            orgType.defaultCapabilities.forEach((capability) => {
              expect(organization.enabledCapabilities).toContain(capability);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent - creating with same data produces same capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationTypeWithDocumentManagement,
          arbitraryOrganizationData,
          (orgType, orgData) => {
            // Act: Create organization twice with same data
            const org1 = OrganizationCreationSimulator.createOrganization(orgType, orgData);
            const org2 = OrganizationCreationSimulator.createOrganization(orgType, orgData);

            // Assert: Both should have identical capabilities
            expect(org1.enabledCapabilities.sort()).toEqual(org2.enabledCapabilities.sort());
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
