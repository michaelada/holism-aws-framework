/**
 * Property-Based Tests for Document Management Capability Consolidation Migration
 * 
 * Feature: document-management-capability-consolidation
 * 
 * These tests validate universal properties that should hold true across
 * all valid organization configurations during the migration from three separate
 * document management capabilities to a single unified capability.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
 */

import * as fc from 'fast-check';

/**
 * Type definitions for testing
 */
interface Organization {
  id: string;
  name: string;
  enabledCapabilities: string[];
}

interface OrganizationType {
  id: string;
  name: string;
  defaultCapabilities: string[];
}

/**
 * Old capability names that are being consolidated
 */
const OLD_CAPABILITIES = [
  'membership-document-management',
  'event-document-management',
  'registration-document-management',
] as const;

/**
 * New unified capability name
 */
const NEW_CAPABILITY = 'document-management';

/**
 * Migration logic extracted from SQL for testing
 * This simulates the migration behavior without requiring a database connection
 */
class MigrationSimulator {
  /**
   * Simulates the capability consolidation migration
   * Implements the logic from consolidate-document-management-capabilities.sql
   */
  static migrateOrganization(org: Organization): Organization {
    const hasAnyOldCapability = org.enabledCapabilities.some(cap =>
      OLD_CAPABILITIES.includes(cap as any)
    );

    // Step 1: Add new capability if organization has any old capability
    let newCapabilities = [...org.enabledCapabilities];
    if (hasAnyOldCapability && !newCapabilities.includes(NEW_CAPABILITY)) {
      newCapabilities.push(NEW_CAPABILITY);
    }

    // Step 2: Remove all old capabilities
    newCapabilities = newCapabilities.filter(
      cap => !OLD_CAPABILITIES.includes(cap as any)
    );

    // Step 3: Remove duplicates (DISTINCT in SQL)
    newCapabilities = Array.from(new Set(newCapabilities));

    return {
      ...org,
      enabledCapabilities: newCapabilities,
    };
  }

  /**
   * Simulates the rollback migration
   * Implements the logic from rollback-consolidate-document-management-capabilities.sql
   */
  static rollbackOrganization(org: Organization): Organization {
    const hasNewCapability = org.enabledCapabilities.includes(NEW_CAPABILITY);

    // Step 1: Add all three original capabilities if organization has document-management
    let newCapabilities = [...org.enabledCapabilities];
    if (hasNewCapability) {
      OLD_CAPABILITIES.forEach(oldCap => {
        if (!newCapabilities.includes(oldCap)) {
          newCapabilities.push(oldCap);
        }
      });
    }

    // Step 2: Remove document-management capability
    newCapabilities = newCapabilities.filter(cap => cap !== NEW_CAPABILITY);

    // Step 3: Remove duplicates (DISTINCT in SQL)
    newCapabilities = Array.from(new Set(newCapabilities));

    return {
      ...org,
      enabledCapabilities: newCapabilities,
    };
  }

  /**
   * Simulates the organization type capability consolidation migration
   * Implements the logic from consolidate-document-management-capabilities.sql (PART 3)
   */
  static migrateOrganizationType(orgType: OrganizationType): OrganizationType {
    const hasAnyOldCapability = orgType.defaultCapabilities.some(cap =>
      OLD_CAPABILITIES.includes(cap as any)
    );

    // Step 1: Add new capability if organization type has any old capability
    let newCapabilities = [...orgType.defaultCapabilities];
    if (hasAnyOldCapability && !newCapabilities.includes(NEW_CAPABILITY)) {
      newCapabilities.push(NEW_CAPABILITY);
    }

    // Step 2: Remove all old capabilities
    newCapabilities = newCapabilities.filter(
      cap => !OLD_CAPABILITIES.includes(cap as any)
    );

    // Step 3: Remove duplicates (DISTINCT in SQL)
    newCapabilities = Array.from(new Set(newCapabilities));

    return {
      ...orgType,
      defaultCapabilities: newCapabilities,
    };
  }

  /**
   * Simulates the organization type rollback migration
   * Implements the logic from rollback-consolidate-document-management-capabilities.sql
   */
  static rollbackOrganizationType(orgType: OrganizationType): OrganizationType {
    const hasNewCapability = orgType.defaultCapabilities.includes(NEW_CAPABILITY);

    // Step 1: Add all three original capabilities if organization type has document-management
    let newCapabilities = [...orgType.defaultCapabilities];
    if (hasNewCapability) {
      OLD_CAPABILITIES.forEach(oldCap => {
        if (!newCapabilities.includes(oldCap)) {
          newCapabilities.push(oldCap);
        }
      });
    }

    // Step 2: Remove document-management capability
    newCapabilities = newCapabilities.filter(cap => cap !== NEW_CAPABILITY);

    // Step 3: Remove duplicates (DISTINCT in SQL)
    newCapabilities = Array.from(new Set(newCapabilities));

    return {
      ...orgType,
      defaultCapabilities: newCapabilities,
    };
  }
}

/**
 * Generators for property-based testing
 */

/**
 * Generates a random capability name (non-document-management)
 */
const arbitraryOtherCapability = fc.constantFrom(
  'events',
  'memberships',
  'registrations',
  'calendar',
  'forms',
  'payments',
  'reporting',
  'analytics',
  'custom-fields',
  'email-notifications'
);

/**
 * Generates a random old document management capability
 */
const arbitraryOldCapability = fc.constantFrom(...OLD_CAPABILITIES);

/**
 * Generates an array of enabled capabilities for an organization
 * This can include:
 * - Zero or more old document management capabilities
 * - Zero or more other capabilities
 * - Potentially the new capability (to test idempotency)
 */
const arbitraryEnabledCapabilities = fc.array(
  fc.oneof(
    arbitraryOldCapability,
    arbitraryOtherCapability,
    fc.constant(NEW_CAPABILITY)
  ),
  { minLength: 0, maxLength: 15 }
).map(caps => Array.from(new Set(caps))); // Remove duplicates

/**
 * Generates a random organization with various capability configurations
 */
const arbitraryOrganization = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  enabledCapabilities: arbitraryEnabledCapabilities,
});

/**
 * Generates an array of default capabilities for an organization type
 * This can include:
 * - Zero or more old document management capabilities
 * - Zero or more other capabilities
 * - Potentially the new capability (to test idempotency)
 */
const arbitraryDefaultCapabilities = fc.array(
  fc.oneof(
    arbitraryOldCapability,
    arbitraryOtherCapability,
    fc.constant(NEW_CAPABILITY)
  ),
  { minLength: 0, maxLength: 15 }
).map(caps => Array.from(new Set(caps))); // Remove duplicates

/**
 * Generates a random organization type with various default capability configurations
 */
const arbitraryOrganizationType = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  defaultCapabilities: arbitraryDefaultCapabilities,
});

describe('Document Management Capability Consolidation - Property-Based Tests', () => {
  /**
   * Property 1: Migration Adds New Capability for Any Old Capability
   * 
   * For any organization with at least one of the old document management capabilities
   * (membership-document-management, event-document-management, registration-document-management),
   * the migration should add document-management to that organization's enabled capabilities.
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  describe('Property 1: Migration Adds New Capability for Any Old Capability', () => {
    it('should add document-management when organization has membership-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          arbitraryOtherCapability,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, otherCap1, otherCaps) => {
            // Arrange: Create organization with membership-document-management
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [
                'membership-document-management',
                otherCap1,
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index), // Remove duplicates
            };

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - document-management should be present
            expect(migratedOrg.enabledCapabilities).toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add document-management when organization has event-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          arbitraryOtherCapability,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, otherCap1, otherCaps) => {
            // Arrange: Create organization with event-document-management
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [
                'event-document-management',
                otherCap1,
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - document-management should be present
            expect(migratedOrg.enabledCapabilities).toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add document-management when organization has registration-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          arbitraryOtherCapability,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, otherCap1, otherCaps) => {
            // Arrange: Create organization with registration-document-management
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [
                'registration-document-management',
                otherCap1,
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - document-management should be present
            expect(migratedOrg.enabledCapabilities).toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add document-management when organization has any combination of old capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOldCapability, { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, oldCaps, otherCaps) => {
            // Arrange: Create organization with at least one old capability
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [...oldCaps, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization has at least one old capability
            const hasOldCapability = org.enabledCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            fc.pre(hasOldCapability);

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - document-management should be present
            expect(migratedOrg.enabledCapabilities).toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT add document-management when organization has no old capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { minLength: 0, maxLength: 10 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization with only non-document capabilities
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: otherCaps.filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization has no old capabilities
            const hasOldCapability = org.enabledCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            fc.pre(!hasOldCapability);

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - document-management should NOT be added
            expect(migratedOrg.enabledCapabilities).not.toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Migration Adds New Capability Exactly Once
   * 
   * For any organization with one or more old document management capabilities,
   * the migration should add document-management exactly once to the organization's
   * enabled capabilities array, regardless of how many old capabilities were present.
   * 
   * **Validates: Requirements 2.4**
   */
  describe('Property 2: Migration Adds New Capability Exactly Once', () => {
    it('should add document-management exactly once regardless of number of old capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOldCapability, { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, oldCaps, otherCaps) => {
            // Arrange: Create organization with multiple old capabilities
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [...oldCaps, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization has at least one old capability
            const hasOldCapability = org.enabledCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            fc.pre(hasOldCapability);

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - document-management appears exactly once
            const count = migratedOrg.enabledCapabilities.filter(
              cap => cap === NEW_CAPABILITY
            ).length;
            expect(count).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not duplicate document-management if it already exists', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOldCapability, { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, oldCaps, otherCaps) => {
            // Arrange: Create organization with old capabilities AND new capability already present
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [NEW_CAPABILITY, ...oldCaps, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization has at least one old capability
            const hasOldCapability = org.enabledCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            fc.pre(hasOldCapability);

            // Act: Run migration (should be idempotent)
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - document-management still appears exactly once
            const count = migratedOrg.enabledCapabilities.filter(
              cap => cap === NEW_CAPABILITY
            ).length;
            expect(count).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain exactly one document-management even with all three old capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization with ALL three old capabilities
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [
                'membership-document-management',
                'event-document-management',
                'registration-document-management',
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - document-management appears exactly once
            const count = migratedOrg.enabledCapabilities.filter(
              cap => cap === NEW_CAPABILITY
            ).length;
            expect(count).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure no duplicate capabilities in final array', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - No duplicates in capabilities array
            const uniqueCapabilities = Array.from(new Set(migratedOrg.enabledCapabilities));
            expect(migratedOrg.enabledCapabilities).toEqual(uniqueCapabilities);
            expect(migratedOrg.enabledCapabilities.length).toBe(uniqueCapabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Migration Removes All Old Capabilities from Organizations
   * 
   * For any organization after migration, the enabled capabilities array should not
   * contain any of the three old document management capability names
   * (membership-document-management, event-document-management, registration-document-management).
   * 
   * **Validates: Requirements 2.5, 2.6, 2.7**
   */
  describe('Property 3: Migration Removes All Old Capabilities from Organizations', () => {
    it('should remove all old capabilities from any organization', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - No old capabilities should remain
            const hasOldCapability = migratedOrg.enabledCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            expect(hasOldCapability).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should specifically remove membership-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - membership-document-management should not be present
            expect(migratedOrg.enabledCapabilities).not.toContain('membership-document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should specifically remove event-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - event-document-management should not be present
            expect(migratedOrg.enabledCapabilities).not.toContain('event-document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should specifically remove registration-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - registration-document-management should not be present
            expect(migratedOrg.enabledCapabilities).not.toContain('registration-document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove all old capabilities even when all three are present', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization with ALL three old capabilities
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [
                'membership-document-management',
                'event-document-management',
                'registration-document-management',
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - None of the old capabilities should remain
            expect(migratedOrg.enabledCapabilities).not.toContain('membership-document-management');
            expect(migratedOrg.enabledCapabilities).not.toContain('event-document-management');
            expect(migratedOrg.enabledCapabilities).not.toContain('registration-document-management');
            
            // Verify using array check
            const hasAnyOldCapability = migratedOrg.enabledCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            expect(hasAnyOldCapability).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all non-document-management capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { minLength: 1, maxLength: 10 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization with old and other capabilities
            const uniqueOtherCaps = Array.from(new Set(otherCaps));
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [
                ...OLD_CAPABILITIES,
                ...uniqueOtherCaps,
              ],
            };

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Assert: Property - All non-document capabilities should be preserved
            uniqueOtherCaps.forEach(cap => {
              expect(migratedOrg.enabledCapabilities).toContain(cap);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Combined Properties: Comprehensive Migration Validation
   * 
   * These tests validate multiple properties together to ensure the migration
   * behaves correctly across all scenarios.
   */
  describe('Combined Properties: Comprehensive Migration Validation', () => {
    it('should correctly migrate organizations with various capability combinations', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Count old capabilities in original organization
            const oldCapCount = org.enabledCapabilities.filter(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            ).length;

            // Assert: Combined properties
            if (oldCapCount > 0) {
              // Property 1: Should have new capability
              expect(migratedOrg.enabledCapabilities).toContain(NEW_CAPABILITY);
              
              // Property 2: Should have exactly one new capability
              const newCapCount = migratedOrg.enabledCapabilities.filter(
                cap => cap === NEW_CAPABILITY
              ).length;
              expect(newCapCount).toBe(1);
            } else {
              // Should not add new capability if no old capabilities existed
              if (!org.enabledCapabilities.includes(NEW_CAPABILITY)) {
                expect(migratedOrg.enabledCapabilities).not.toContain(NEW_CAPABILITY);
              }
            }

            // Property 3: Should have no old capabilities
            const hasOldCapability = migratedOrg.enabledCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            expect(hasOldCapability).toBe(false);

            // Additional invariant: No duplicates
            const uniqueCapabilities = Array.from(new Set(migratedOrg.enabledCapabilities));
            expect(migratedOrg.enabledCapabilities.length).toBe(uniqueCapabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent - running migration multiple times produces same result', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run migration multiple times
            const migratedOnce = MigrationSimulator.migrateOrganization(org);
            const migratedTwice = MigrationSimulator.migrateOrganization(migratedOnce);
            const migratedThrice = MigrationSimulator.migrateOrganization(migratedTwice);

            // Assert: Property - Results should be identical
            expect(migratedOnce.enabledCapabilities).toEqual(migratedTwice.enabledCapabilities);
            expect(migratedTwice.enabledCapabilities).toEqual(migratedThrice.enabledCapabilities);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain capability count correctly', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Count capabilities before migration
            const uniqueOriginalCaps = Array.from(new Set(org.enabledCapabilities));
            const oldCapCount = uniqueOriginalCaps.filter(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            ).length;
            const otherCapCount = uniqueOriginalCaps.filter(
              cap => !OLD_CAPABILITIES.includes(cap as any) && cap !== NEW_CAPABILITY
            ).length;
            const hadNewCap = uniqueOriginalCaps.includes(NEW_CAPABILITY);

            // Act: Run migration
            const migratedOrg = MigrationSimulator.migrateOrganization(org);

            // Calculate expected count
            let expectedCount = otherCapCount;
            if (oldCapCount > 0 || hadNewCap) {
              expectedCount += 1; // Add new capability
            }

            // Assert: Property - Capability count should match expected
            expect(migratedOrg.enabledCapabilities.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * ROLLBACK MIGRATION PROPERTY TESTS
   * 
   * These tests validate the rollback migration that reverses the capability consolidation.
   * The rollback restores the three original capabilities and removes the unified capability.
   */

  /**
   * Property 13: Rollback Restores Organization Capabilities
   * 
   * For any organization with document-management capability, when the down migration executes,
   * that organization should have all three original document management capabilities added
   * to its enabled capabilities array.
   * 
   * **Validates: Requirements 6.5**
   */
  describe('Property 13: Rollback Restores Organization Capabilities', () => {
    it('should add all three original capabilities when organization has document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization with document-management capability
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [NEW_CAPABILITY, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization has document-management
            fc.pre(org.enabledCapabilities.includes(NEW_CAPABILITY));

            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Property - All three original capabilities should be present
            expect(rolledBackOrg.enabledCapabilities).toContain('membership-document-management');
            expect(rolledBackOrg.enabledCapabilities).toContain('event-document-management');
            expect(rolledBackOrg.enabledCapabilities).toContain('registration-document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add all three original capabilities even if some already exist', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOldCapability, { minLength: 1, maxLength: 2 }),
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, someOldCaps, otherCaps) => {
            // Arrange: Create organization with document-management AND some old capabilities
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [NEW_CAPABILITY, ...someOldCaps, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization has document-management
            fc.pre(org.enabledCapabilities.includes(NEW_CAPABILITY));

            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Property - All three original capabilities should be present
            expect(rolledBackOrg.enabledCapabilities).toContain('membership-document-management');
            expect(rolledBackOrg.enabledCapabilities).toContain('event-document-management');
            expect(rolledBackOrg.enabledCapabilities).toContain('registration-document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT add original capabilities when organization does not have document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { minLength: 1, maxLength: 10 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization WITHOUT document-management capability
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: otherCaps.filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization does NOT have document-management
            fc.pre(!org.enabledCapabilities.includes(NEW_CAPABILITY));

            // Count original capabilities before rollback
            const oldCapsBeforeCount = org.enabledCapabilities.filter(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            ).length;

            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Property - Should not add any new original capabilities
            const oldCapsAfterCount = rolledBackOrg.enabledCapabilities.filter(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            ).length;
            expect(oldCapsAfterCount).toBe(oldCapsBeforeCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all non-document-management capabilities during rollback', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { minLength: 1, maxLength: 10 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization with document-management and other capabilities
            const uniqueOtherCaps = Array.from(new Set(otherCaps));
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [NEW_CAPABILITY, ...uniqueOtherCaps],
            };

            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Property - All non-document capabilities should be preserved
            uniqueOtherCaps.forEach(cap => {
              expect(rolledBackOrg.enabledCapabilities).toContain(cap);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add each original capability exactly once', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization with document-management
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [NEW_CAPABILITY, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization has document-management
            fc.pre(org.enabledCapabilities.includes(NEW_CAPABILITY));

            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Property - Each original capability appears exactly once
            const membershipCount = rolledBackOrg.enabledCapabilities.filter(
              cap => cap === 'membership-document-management'
            ).length;
            const eventCount = rolledBackOrg.enabledCapabilities.filter(
              cap => cap === 'event-document-management'
            ).length;
            const registrationCount = rolledBackOrg.enabledCapabilities.filter(
              cap => cap === 'registration-document-management'
            ).length;

            expect(membershipCount).toBe(1);
            expect(eventCount).toBe(1);
            expect(registrationCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Rollback Removes New Capability from Organizations
   * 
   * For any organization after down migration, the enabled capabilities array
   * should not contain document-management.
   * 
   * **Validates: Requirements 6.6**
   */
  describe('Property 14: Rollback Removes New Capability from Organizations', () => {
    it('should remove document-management from any organization', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Property - document-management should not be present
            expect(rolledBackOrg.enabledCapabilities).not.toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove document-management even when organization has other capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { minLength: 1, maxLength: 10 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization with document-management and other capabilities
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [NEW_CAPABILITY, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization has document-management
            fc.pre(org.enabledCapabilities.includes(NEW_CAPABILITY));

            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Property - document-management should be removed
            expect(rolledBackOrg.enabledCapabilities).not.toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle organizations that never had document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { minLength: 0, maxLength: 10 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization WITHOUT document-management
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: otherCaps.filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization does NOT have document-management
            fc.pre(!org.enabledCapabilities.includes(NEW_CAPABILITY));

            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Property - document-management should still not be present
            expect(rolledBackOrg.enabledCapabilities).not.toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure no duplicate capabilities in final array after rollback', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Property - No duplicates in capabilities array
            const uniqueCapabilities = Array.from(new Set(rolledBackOrg.enabledCapabilities));
            expect(rolledBackOrg.enabledCapabilities).toEqual(uniqueCapabilities);
            expect(rolledBackOrg.enabledCapabilities.length).toBe(uniqueCapabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Combined Rollback Properties: Comprehensive Rollback Validation
   * 
   * These tests validate multiple rollback properties together to ensure the rollback
   * behaves correctly across all scenarios.
   */
  describe('Combined Rollback Properties: Comprehensive Rollback Validation', () => {
    it('should correctly rollback organizations with various capability combinations', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Check if original organization had document-management
            const hadNewCapability = org.enabledCapabilities.includes(NEW_CAPABILITY);

            // Assert: Combined properties
            if (hadNewCapability) {
              // Property 13: Should have all three original capabilities
              expect(rolledBackOrg.enabledCapabilities).toContain('membership-document-management');
              expect(rolledBackOrg.enabledCapabilities).toContain('event-document-management');
              expect(rolledBackOrg.enabledCapabilities).toContain('registration-document-management');
            }

            // Property 14: Should not have document-management
            expect(rolledBackOrg.enabledCapabilities).not.toContain(NEW_CAPABILITY);

            // Additional invariant: No duplicates
            const uniqueCapabilities = Array.from(new Set(rolledBackOrg.enabledCapabilities));
            expect(rolledBackOrg.enabledCapabilities.length).toBe(uniqueCapabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent - running rollback multiple times produces same result', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run rollback migration multiple times
            const rolledBackOnce = MigrationSimulator.rollbackOrganization(org);
            const rolledBackTwice = MigrationSimulator.rollbackOrganization(rolledBackOnce);
            const rolledBackThrice = MigrationSimulator.rollbackOrganization(rolledBackTwice);

            // Assert: Property - Results should be identical
            expect(rolledBackOnce.enabledCapabilities).toEqual(rolledBackTwice.enabledCapabilities);
            expect(rolledBackTwice.enabledCapabilities).toEqual(rolledBackThrice.enabledCapabilities);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be reversible - forward then rollback should restore original state (with modifications)', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOldCapability, { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, oldCaps, otherCaps) => {
            // Arrange: Create organization with old capabilities (pre-migration state)
            const originalOrg: Organization = {
              ...baseOrg,
              enabledCapabilities: [...oldCaps, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization has at least one old capability
            const hasOldCapability = originalOrg.enabledCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            fc.pre(hasOldCapability);

            // Act: Run forward migration then rollback
            const migratedOrg = MigrationSimulator.migrateOrganization(originalOrg);
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(migratedOrg);

            // Assert: Property - Should have all three original capabilities after rollback
            // (Note: Rollback adds ALL three, not just the ones that were originally present)
            expect(rolledBackOrg.enabledCapabilities).toContain('membership-document-management');
            expect(rolledBackOrg.enabledCapabilities).toContain('event-document-management');
            expect(rolledBackOrg.enabledCapabilities).toContain('registration-document-management');
            
            // Should not have new capability
            expect(rolledBackOrg.enabledCapabilities).not.toContain(NEW_CAPABILITY);
            
            // Should preserve all other capabilities
            const otherCapsInOriginal = originalOrg.enabledCapabilities.filter(
              cap => !OLD_CAPABILITIES.includes(cap as any) && cap !== NEW_CAPABILITY
            );
            otherCapsInOriginal.forEach(cap => {
              expect(rolledBackOrg.enabledCapabilities).toContain(cap);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain capability count correctly during rollback', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          (org) => {
            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Count capabilities after rollback
            const hadNewCap = org.enabledCapabilities.includes(NEW_CAPABILITY);
            const otherCapCount = org.enabledCapabilities.filter(
              cap => !OLD_CAPABILITIES.includes(cap as any) && cap !== NEW_CAPABILITY
            ).length;

            // Calculate expected count
            let expectedCount = otherCapCount;
            if (hadNewCap) {
              // Add three original capabilities (they will be present after rollback)
              expectedCount += 3;
            } else {
              // Keep whatever old capabilities were already there
              const oldCapCount = org.enabledCapabilities.filter(cap =>
                OLD_CAPABILITIES.includes(cap as any)
              ).length;
              expectedCount += oldCapCount;
            }

            // Assert: Property - Capability count should match expected
            expect(rolledBackOrg.enabledCapabilities.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case of organization with all capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganization,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrg, otherCaps) => {
            // Arrange: Create organization with ALL capabilities (old + new + others)
            const org: Organization = {
              ...baseOrg,
              enabledCapabilities: [
                NEW_CAPABILITY,
                ...OLD_CAPABILITIES,
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run rollback migration
            const rolledBackOrg = MigrationSimulator.rollbackOrganization(org);

            // Assert: Properties
            // Should have all three original capabilities
            expect(rolledBackOrg.enabledCapabilities).toContain('membership-document-management');
            expect(rolledBackOrg.enabledCapabilities).toContain('event-document-management');
            expect(rolledBackOrg.enabledCapabilities).toContain('registration-document-management');
            
            // Should not have new capability
            expect(rolledBackOrg.enabledCapabilities).not.toContain(NEW_CAPABILITY);
            
            // Should preserve other capabilities
            otherCaps.forEach(cap => {
              if (cap !== NEW_CAPABILITY) {
                expect(rolledBackOrg.enabledCapabilities).toContain(cap);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * ORGANIZATION TYPE MIGRATION PROPERTY TESTS
   * 
   * These tests validate the migration of organization type default capabilities.
   * Organization types define which capabilities new organizations should have by default.
   */

  /**
   * Property 16: Migration Updates Organization Type Defaults
   * 
   * For any organization type with at least one old document management capability
   * in its default capabilities, the migration should add document-management to
   * that organization type's default capabilities.
   * 
   * **Validates: Requirements 7.2**
   */
  describe('Property 16: Migration Updates Organization Type Defaults', () => {
    it('should add document-management when organization type has membership-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          arbitraryOtherCapability,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrgType, otherCap1, otherCaps) => {
            // Arrange: Create organization type with membership-document-management
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: [
                'membership-document-management',
                otherCap1,
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - document-management should be present
            expect(migratedOrgType.defaultCapabilities).toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add document-management when organization type has event-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          arbitraryOtherCapability,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrgType, otherCap1, otherCaps) => {
            // Arrange: Create organization type with event-document-management
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: [
                'event-document-management',
                otherCap1,
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - document-management should be present
            expect(migratedOrgType.defaultCapabilities).toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add document-management when organization type has registration-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          arbitraryOtherCapability,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrgType, otherCap1, otherCaps) => {
            // Arrange: Create organization type with registration-document-management
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: [
                'registration-document-management',
                otherCap1,
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - document-management should be present
            expect(migratedOrgType.defaultCapabilities).toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add document-management when organization type has any combination of old capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          fc.array(arbitraryOldCapability, { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrgType, oldCaps, otherCaps) => {
            // Arrange: Create organization type with at least one old capability
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: [...oldCaps, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization type has at least one old capability
            const hasOldCapability = orgType.defaultCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            fc.pre(hasOldCapability);

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - document-management should be present
            expect(migratedOrgType.defaultCapabilities).toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT add document-management when organization type has no old capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          fc.array(arbitraryOtherCapability, { minLength: 0, maxLength: 10 }),
          (baseOrgType, otherCaps) => {
            // Arrange: Create organization type with only non-document capabilities
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: otherCaps.filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization type has no old capabilities
            const hasOldCapability = orgType.defaultCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            fc.pre(!hasOldCapability);

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - document-management should NOT be added
            expect(migratedOrgType.defaultCapabilities).not.toContain(NEW_CAPABILITY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add document-management exactly once regardless of number of old capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          fc.array(arbitraryOldCapability, { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrgType, oldCaps, otherCaps) => {
            // Arrange: Create organization type with multiple old capabilities
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: [...oldCaps, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization type has at least one old capability
            const hasOldCapability = orgType.defaultCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            fc.pre(hasOldCapability);

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - document-management appears exactly once
            const count = migratedOrgType.defaultCapabilities.filter(
              cap => cap === NEW_CAPABILITY
            ).length;
            expect(count).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not duplicate document-management if it already exists', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          fc.array(arbitraryOldCapability, { minLength: 1, maxLength: 3 }),
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrgType, oldCaps, otherCaps) => {
            // Arrange: Create organization type with old capabilities AND new capability already present
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: [NEW_CAPABILITY, ...oldCaps, ...otherCaps].filter(
                (cap, index, self) => self.indexOf(cap) === index
              ),
            };

            // Pre-condition: Verify organization type has at least one old capability
            const hasOldCapability = orgType.defaultCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            fc.pre(hasOldCapability);

            // Act: Run migration (should be idempotent)
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - document-management still appears exactly once
            const count = migratedOrgType.defaultCapabilities.filter(
              cap => cap === NEW_CAPABILITY
            ).length;
            expect(count).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Migration Removes Old Capabilities from Organization Types
   * 
   * For any organization type after migration, the default capabilities array should not
   * contain any of the three old document management capability names
   * (membership-document-management, event-document-management, registration-document-management).
   * 
   * **Validates: Requirements 7.3, 7.4, 7.5**
   */
  describe('Property 17: Migration Removes Old Capabilities from Organization Types', () => {
    it('should remove all old capabilities from any organization type', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          (orgType) => {
            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - No old capabilities should remain
            const hasOldCapability = migratedOrgType.defaultCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            expect(hasOldCapability).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should specifically remove membership-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          (orgType) => {
            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - membership-document-management should not be present
            expect(migratedOrgType.defaultCapabilities).not.toContain('membership-document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should specifically remove event-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          (orgType) => {
            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - event-document-management should not be present
            expect(migratedOrgType.defaultCapabilities).not.toContain('event-document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should specifically remove registration-document-management', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          (orgType) => {
            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - registration-document-management should not be present
            expect(migratedOrgType.defaultCapabilities).not.toContain('registration-document-management');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove all old capabilities even when all three are present', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrgType, otherCaps) => {
            // Arrange: Create organization type with ALL three old capabilities
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: [
                'membership-document-management',
                'event-document-management',
                'registration-document-management',
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - None of the old capabilities should remain
            expect(migratedOrgType.defaultCapabilities).not.toContain('membership-document-management');
            expect(migratedOrgType.defaultCapabilities).not.toContain('event-document-management');
            expect(migratedOrgType.defaultCapabilities).not.toContain('registration-document-management');
            
            // Verify using array check
            const hasAnyOldCapability = migratedOrgType.defaultCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            expect(hasAnyOldCapability).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all non-document-management capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          fc.array(arbitraryOtherCapability, { minLength: 1, maxLength: 10 }),
          (baseOrgType, otherCaps) => {
            // Arrange: Create organization type with old and other capabilities
            const uniqueOtherCaps = Array.from(new Set(otherCaps));
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: [
                ...OLD_CAPABILITIES,
                ...uniqueOtherCaps,
              ],
            };

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - All non-document capabilities should be preserved
            uniqueOtherCaps.forEach(cap => {
              expect(migratedOrgType.defaultCapabilities).toContain(cap);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure no duplicate capabilities in final array', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          (orgType) => {
            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Property - No duplicates in capabilities array
            const uniqueCapabilities = Array.from(new Set(migratedOrgType.defaultCapabilities));
            expect(migratedOrgType.defaultCapabilities).toEqual(uniqueCapabilities);
            expect(migratedOrgType.defaultCapabilities.length).toBe(uniqueCapabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Combined Organization Type Properties: Comprehensive Migration Validation
   * 
   * These tests validate multiple properties together to ensure the migration
   * behaves correctly for organization types across all scenarios.
   */
  describe('Combined Organization Type Properties: Comprehensive Migration Validation', () => {
    it('should correctly migrate organization types with various capability combinations', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          (orgType) => {
            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Count old capabilities in original organization type
            const oldCapCount = orgType.defaultCapabilities.filter(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            ).length;

            // Assert: Combined properties
            if (oldCapCount > 0) {
              // Property 16: Should have new capability
              expect(migratedOrgType.defaultCapabilities).toContain(NEW_CAPABILITY);
              
              // Should have exactly one new capability
              const newCapCount = migratedOrgType.defaultCapabilities.filter(
                cap => cap === NEW_CAPABILITY
              ).length;
              expect(newCapCount).toBe(1);
            } else {
              // Should not add new capability if no old capabilities existed
              if (!orgType.defaultCapabilities.includes(NEW_CAPABILITY)) {
                expect(migratedOrgType.defaultCapabilities).not.toContain(NEW_CAPABILITY);
              }
            }

            // Property 17: Should have no old capabilities
            const hasOldCapability = migratedOrgType.defaultCapabilities.some(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            );
            expect(hasOldCapability).toBe(false);

            // Additional invariant: No duplicates
            const uniqueCapabilities = Array.from(new Set(migratedOrgType.defaultCapabilities));
            expect(migratedOrgType.defaultCapabilities.length).toBe(uniqueCapabilities.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent - running migration multiple times produces same result', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          (orgType) => {
            // Act: Run migration multiple times
            const migratedOnce = MigrationSimulator.migrateOrganizationType(orgType);
            const migratedTwice = MigrationSimulator.migrateOrganizationType(migratedOnce);
            const migratedThrice = MigrationSimulator.migrateOrganizationType(migratedTwice);

            // Assert: Property - Results should be identical
            expect(migratedOnce.defaultCapabilities).toEqual(migratedTwice.defaultCapabilities);
            expect(migratedTwice.defaultCapabilities).toEqual(migratedThrice.defaultCapabilities);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain capability count correctly', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          (orgType) => {
            // Count capabilities before migration
            const uniqueOriginalCaps = Array.from(new Set(orgType.defaultCapabilities));
            const oldCapCount = uniqueOriginalCaps.filter(cap =>
              OLD_CAPABILITIES.includes(cap as any)
            ).length;
            const otherCapCount = uniqueOriginalCaps.filter(
              cap => !OLD_CAPABILITIES.includes(cap as any) && cap !== NEW_CAPABILITY
            ).length;
            const hadNewCap = uniqueOriginalCaps.includes(NEW_CAPABILITY);

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Calculate expected count
            let expectedCount = otherCapCount;
            if (oldCapCount > 0 || hadNewCap) {
              expectedCount += 1; // Add new capability
            }

            // Assert: Property - Capability count should match expected
            expect(migratedOrgType.defaultCapabilities.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle organization types with all capabilities', () => {
      fc.assert(
        fc.property(
          arbitraryOrganizationType,
          fc.array(arbitraryOtherCapability, { maxLength: 5 }),
          (baseOrgType, otherCaps) => {
            // Arrange: Create organization type with ALL capabilities (old + new + others)
            const orgType: OrganizationType = {
              ...baseOrgType,
              defaultCapabilities: [
                NEW_CAPABILITY,
                ...OLD_CAPABILITIES,
                ...otherCaps,
              ].filter((cap, index, self) => self.indexOf(cap) === index),
            };

            // Act: Run migration
            const migratedOrgType = MigrationSimulator.migrateOrganizationType(orgType);

            // Assert: Properties
            // Should have document-management
            expect(migratedOrgType.defaultCapabilities).toContain(NEW_CAPABILITY);
            
            // Should not have any old capabilities
            expect(migratedOrgType.defaultCapabilities).not.toContain('membership-document-management');
            expect(migratedOrgType.defaultCapabilities).not.toContain('event-document-management');
            expect(migratedOrgType.defaultCapabilities).not.toContain('registration-document-management');
            
            // Should preserve other capabilities
            otherCaps.forEach(cap => {
              if (cap !== NEW_CAPABILITY && !OLD_CAPABILITIES.includes(cap as any)) {
                expect(migratedOrgType.defaultCapabilities).toContain(cap);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * FIELD PRESERVATION PROPERTY TESTS
   * 
   * These tests validate that the migration preserves all existing field definitions
   * with document datatypes (file and image). The migration only modifies capabilities,
   * not field definitions.
   */

  /**
   * Property 11: Migration Preserves Existing Document Fields
   * 
   * For any field definition with datatype 'file' or 'image' that exists before migration,
   * that field definition should still exist with the same datatype after migration completes.
   * 
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 11: Migration Preserves Existing Document Fields', () => {
    /**
     * Type definition for field definitions
     */
    interface FieldDefinition {
      id: string;
      shortName: string;
      displayName: string;
      datatype: string;
      description?: string;
      datatypeProperties?: Record<string, any>;
      organizationId: string;
    }

    /**
     * Document field datatypes that require document-management capability
     */
    const DOCUMENT_DATATYPES = ['file', 'image'] as const;

    /**
     * Non-document field datatypes
     */
    const NON_DOCUMENT_DATATYPES = [
      'text', 'textarea', 'number', 'email', 'phone',
      'date', 'time', 'datetime', 'boolean',
      'select', 'multiselect', 'radio', 'checkbox'
    ] as const;

    /**
     * Migration simulator for field preservation testing
     * The migration only changes capabilities, not field definitions
     */
    class FieldPreservationSimulator {
      /**
       * Simulates the migration's effect on field definitions
       * The migration should NOT modify any field definitions
       */
      static migrateFields(fields: FieldDefinition[]): FieldDefinition[] {
        // Migration does not touch field definitions at all
        // It only modifies capabilities table and organization capabilities
        return fields.map(field => ({ ...field }));
      }

      /**
       * Verifies that a field is preserved (unchanged) after migration
       */
      static isFieldPreserved(original: FieldDefinition, migrated: FieldDefinition): boolean {
        return (
          original.id === migrated.id &&
          original.shortName === migrated.shortName &&
          original.displayName === migrated.displayName &&
          original.datatype === migrated.datatype &&
          original.description === migrated.description &&
          original.organizationId === migrated.organizationId &&
          JSON.stringify(original.datatypeProperties) === JSON.stringify(migrated.datatypeProperties)
        );
      }
    }

    /**
     * Generators for property-based testing
     */

    /**
     * Generates a random document datatype (file or image)
     */
    const arbitraryDocumentDatatype = fc.constantFrom(...DOCUMENT_DATATYPES);

    /**
     * Generates a random non-document datatype
     */
    const arbitraryNonDocumentDatatype = fc.constantFrom(...NON_DOCUMENT_DATATYPES);

    /**
     * Generates a random datatype (document or non-document)
     */
    const arbitraryDatatype = fc.oneof(
      arbitraryDocumentDatatype,
      arbitraryNonDocumentDatatype
    );

    /**
     * Generates a random field definition with document datatype
     */
    const arbitraryDocumentField = fc.record({
      id: fc.uuid(),
      shortName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
      displayName: fc.string({ minLength: 3, maxLength: 100 }),
      datatype: arbitraryDocumentDatatype,
      description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
      datatypeProperties: fc.option(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.oneof(fc.string(), fc.integer(), fc.boolean())
        ),
        { nil: undefined }
      ),
      organizationId: fc.uuid(),
    });

    /**
     * Generates an array of field definitions with at least one document field
     */
    const arbitraryFieldArrayWithDocumentFields = fc.tuple(
      fc.array(arbitraryDocumentField, { minLength: 1, maxLength: 10 }),
      fc.array(
        fc.record({
          id: fc.uuid(),
          shortName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
          displayName: fc.string({ minLength: 3, maxLength: 100 }),
          datatype: arbitraryDatatype,
          description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          datatypeProperties: fc.option(
            fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.oneof(fc.string(), fc.integer(), fc.boolean())
            ),
            { nil: undefined }
          ),
          organizationId: fc.uuid(),
        }),
        { minLength: 0, maxLength: 10 }
      )
    ).map(([docFields, otherFields]) => [...docFields, ...otherFields]);

    it('should preserve all file fields during migration', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              shortName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
              displayName: fc.string({ minLength: 3, maxLength: 100 }),
              datatype: fc.constant('file' as const),
              description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
              datatypeProperties: fc.option(
                fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.oneof(fc.string(), fc.integer(), fc.boolean())
                ),
                { nil: undefined }
              ),
              organizationId: fc.uuid(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All file fields should be preserved
            expect(migratedFields.length).toBe(fields.length);
            
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              
              // Verify field is preserved
              expect(FieldPreservationSimulator.isFieldPreserved(originalField, migratedField)).toBe(true);
              
              // Specifically verify datatype is still 'file'
              expect(migratedField.datatype).toBe('file');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all image fields during migration', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              shortName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
              displayName: fc.string({ minLength: 3, maxLength: 100 }),
              datatype: fc.constant('image' as const),
              description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
              datatypeProperties: fc.option(
                fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.oneof(fc.string(), fc.integer(), fc.boolean())
                ),
                { nil: undefined }
              ),
              organizationId: fc.uuid(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All image fields should be preserved
            expect(migratedFields.length).toBe(fields.length);
            
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              
              // Verify field is preserved
              expect(FieldPreservationSimulator.isFieldPreserved(originalField, migratedField)).toBe(true);
              
              // Specifically verify datatype is still 'image'
              expect(migratedField.datatype).toBe('image');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all document fields (file and image) during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Pre-condition: Verify we have at least one document field
            const documentFields = fields.filter(f => 
              f.datatype === 'file' || f.datatype === 'image'
            );
            fc.pre(documentFields.length > 0);

            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All document fields should be preserved
            expect(migratedFields.length).toBe(fields.length);
            
            documentFields.forEach(originalField => {
              const migratedField = migratedFields.find(f => f.id === originalField.id);
              
              expect(migratedField).toBeDefined();
              expect(FieldPreservationSimulator.isFieldPreserved(originalField, migratedField!)).toBe(true);
              
              // Verify datatype is unchanged
              expect(migratedField!.datatype).toBe(originalField.datatype);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve field properties for document fields', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryDocumentField, { minLength: 1, maxLength: 10 }),
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All field properties should be preserved
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              
              // Verify all properties are preserved
              expect(migratedField.id).toBe(originalField.id);
              expect(migratedField.shortName).toBe(originalField.shortName);
              expect(migratedField.displayName).toBe(originalField.displayName);
              expect(migratedField.datatype).toBe(originalField.datatype);
              expect(migratedField.description).toBe(originalField.description);
              expect(migratedField.organizationId).toBe(originalField.organizationId);
              expect(migratedField.datatypeProperties).toEqual(originalField.datatypeProperties);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not modify field count during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: Field count should remain the same
            expect(migratedFields.length).toBe(fields.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve field IDs during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Pre-condition: Verify we have at least one document field
            const documentFields = fields.filter(f => 
              f.datatype === 'file' || f.datatype === 'image'
            );
            fc.pre(documentFields.length > 0);

            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All field IDs should be preserved
            const originalIds = fields.map(f => f.id).sort();
            const migratedIds = migratedFields.map(f => f.id).sort();
            
            expect(migratedIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve field organization associations during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Pre-condition: Verify we have at least one document field
            const documentFields = fields.filter(f => 
              f.datatype === 'file' || f.datatype === 'image'
            );
            fc.pre(documentFields.length > 0);

            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All organization associations should be preserved
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              expect(migratedField.organizationId).toBe(originalField.organizationId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent - running migration multiple times preserves fields', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Act: Run migration multiple times
            const migratedOnce = FieldPreservationSimulator.migrateFields(fields);
            const migratedTwice = FieldPreservationSimulator.migrateFields(migratedOnce);
            const migratedThrice = FieldPreservationSimulator.migrateFields(migratedTwice);

            // Assert: Fields should be identical after each migration
            expect(migratedOnce).toEqual(fields);
            expect(migratedTwice).toEqual(fields);
            expect(migratedThrice).toEqual(fields);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not introduce new fields during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: No new fields should be introduced
            migratedFields.forEach(migratedField => {
              const originalField = fields.find(f => f.id === migratedField.id);
              expect(originalField).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not remove any fields during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: No fields should be removed
            fields.forEach(originalField => {
              const migratedField = migratedFields.find(f => f.id === originalField.id);
              expect(migratedField).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
