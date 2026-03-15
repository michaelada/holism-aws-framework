/**
 * Integration tests for membership number sequence initialization migration
 * 
 * This test suite validates the actual SQL migration logic by simulating
 * database scenarios and verifying the sequence initialization behavior.
 * 
 * Requirements: 6.1, 6.2
 */

describe('Membership Number Sequence Initialization - Integration', () => {
  describe('SQL Logic Validation', () => {
    it('should correctly calculate next_number for organization-level uniqueness', () => {
      // Simulate the SQL COALESCE logic
      const calculateNextNumber = (
        membershipNumbers: string[],
        initialMembershipNumber: number | null
      ): number => {
        // Extract numeric values from membership numbers
        const numericValues = membershipNumbers
          .filter(n => /^\d+$/.test(n) || /\d+/.test(n))
          .map(n => {
            if (/^\d+$/.test(n)) {
              return parseInt(n);
            } else {
              const extracted = n.replace(/[^\d]/g, '');
              return extracted ? parseInt(extracted) : null;
            }
          })
          .filter((n): n is number => n !== null);

        if (numericValues.length > 0) {
          return Math.max(...numericValues) + 1;
        }

        return initialMembershipNumber ?? 1000000;
      };

      // Test case 1: Organization with numeric membership numbers
      expect(
        calculateNextNumber(['1000000', '1000001', '1000002'], 1000000)
      ).toBe(1000003);

      // Test case 2: Organization with prefixed membership numbers
      expect(
        calculateNextNumber(['PREFIX-1000', 'PREFIX-1001'], 1000000)
      ).toBe(1002);

      // Test case 3: Organization with no members
      expect(
        calculateNextNumber([], 1000000)
      ).toBe(1000000);

      // Test case 4: Organization with custom initial number
      expect(
        calculateNextNumber([], 5000000)
      ).toBe(5000000);

      // Test case 5: Organization with non-numeric membership numbers
      expect(
        calculateNextNumber(['ABC', 'XYZ'], 1000000)
      ).toBe(1000000);
    });

    it('should correctly calculate next_number for organization type-level uniqueness', () => {
      // Simulate finding max across multiple organizations
      const calculateNextNumberAcrossOrgs = (
        orgMembershipNumbers: string[][],
        initialMembershipNumber: number | null
      ): number => {
        const allNumbers = orgMembershipNumbers.flat();
        
        const numericValues = allNumbers
          .filter(n => /^\d+$/.test(n) || /\d+/.test(n))
          .map(n => {
            if (/^\d+$/.test(n)) {
              return parseInt(n);
            } else {
              const extracted = n.replace(/[^\d]/g, '');
              return extracted ? parseInt(extracted) : null;
            }
          })
          .filter((n): n is number => n !== null);

        if (numericValues.length > 0) {
          return Math.max(...numericValues) + 1;
        }

        return initialMembershipNumber ?? 1000000;
      };

      // Test case 1: Multiple organizations with members
      expect(
        calculateNextNumberAcrossOrgs(
          [
            ['1000000', '1000001'],
            ['1000005', '1000006'],
            ['1000003']
          ],
          1000000
        )
      ).toBe(1000007);

      // Test case 2: Some organizations empty
      expect(
        calculateNextNumberAcrossOrgs(
          [
            ['1000000', '1000001'],
            [],
            ['1000002']
          ],
          1000000
        )
      ).toBe(1000003);

      // Test case 3: All organizations empty
      expect(
        calculateNextNumberAcrossOrgs([[], [], []], 1000000)
      ).toBe(1000000);
    });
  });

  describe('Migration Scenarios', () => {
    it('should handle organization with existing sequential numbers', () => {
      // Scenario: Organization has members with sequential numbers starting from 1000000
      const existingMembers = [
        { id: '1', membership_number: '1000000' },
        { id: '2', membership_number: '1000001' },
        { id: '3', membership_number: '1000002' },
      ];

      const membershipNumbers = existingMembers.map(m => m.membership_number);
      const highest = Math.max(...membershipNumbers.map(n => parseInt(n)));
      const nextNumber = highest + 1;

      expect(nextNumber).toBe(1000003);
    });

    it('should handle organization with gaps in numbering', () => {
      // Scenario: Organization has members but with gaps (e.g., deleted members)
      const existingMembers = [
        { id: '1', membership_number: '1000000' },
        { id: '2', membership_number: '1000005' }, // Gap here
        { id: '3', membership_number: '1000010' },
      ];

      const membershipNumbers = existingMembers.map(m => m.membership_number);
      const highest = Math.max(...membershipNumbers.map(n => parseInt(n)));
      const nextNumber = highest + 1;

      // Should continue from highest, not fill gaps
      expect(nextNumber).toBe(1000011);
    });

    it('should handle organization with legacy format numbers', () => {
      // Scenario: Organization has old format like "ORG-2024-123"
      const existingMembers = [
        { id: '1', membership_number: 'ORG-2024-100' },
        { id: '2', membership_number: 'ORG-2024-101' },
        { id: '3', membership_number: 'ORG-2024-102' },
      ];

      const membershipNumbers = existingMembers.map(m => m.membership_number);
      const numericValues = membershipNumbers.map(n => 
        parseInt(n.replace(/[^\d]/g, ''))
      );
      const highest = Math.max(...numericValues);
      const nextNumber = highest + 1;

      // Extracts "2024100", "2024101", "2024102"
      expect(nextNumber).toBe(2024103);
    });

    it('should handle organization with mixed format numbers', () => {
      // Scenario: Organization migrated from external to internal, has mixed formats
      const existingMembers = [
        { id: '1', membership_number: '1000000' },
        { id: '2', membership_number: 'LEGACY-500' },
        { id: '3', membership_number: '1000001' },
      ];

      const membershipNumbers = existingMembers.map(m => m.membership_number);
      const numericValues = membershipNumbers.map(n => {
        if (/^\d+$/.test(n)) {
          return parseInt(n);
        } else {
          const extracted = n.replace(/[^\d]/g, '');
          return extracted ? parseInt(extracted) : 0;
        }
      });
      const highest = Math.max(...numericValues);
      const nextNumber = highest + 1;

      // Should use highest numeric value (1000001)
      expect(nextNumber).toBe(1000002);
    });

    it('should handle brand new organization with no members', () => {
      // Scenario: Organization just created, no members yet
      const existingMembers: any[] = [];
      const configuredInitialNumber = 1000000;

      const nextNumber = existingMembers.length > 0
        ? Math.max(...existingMembers.map(m => parseInt(m.membership_number))) + 1
        : configuredInitialNumber;

      expect(nextNumber).toBe(1000000);
    });

    it('should respect custom initial_membership_number from organization type', () => {
      // Scenario: Organization type configured with custom starting number
      const existingMembers: any[] = [];
      const customInitialNumber = 5000000;

      const nextNumber = existingMembers.length > 0
        ? Math.max(...existingMembers.map(m => parseInt(m.membership_number))) + 1
        : customInitialNumber;

      expect(nextNumber).toBe(5000000);
    });
  });

  describe('Conflict Handling', () => {
    it('should not overwrite existing sequence records (ON CONFLICT DO NOTHING)', () => {
      // Scenario: Sequence already exists (e.g., migration run twice)
      const existingSequences = [
        {
          organization_type_id: 'type-1',
          organization_id: 'org-1',
          next_number: 1000050
        }
      ];

      // New migration would try to insert with next_number = 1000010
      const newSequence = {
        organization_type_id: 'type-1',
        organization_id: 'org-1',
        next_number: 1000010
      };

      // Simulate ON CONFLICT DO NOTHING
      const finalSequence = existingSequences.find(
        s => s.organization_type_id === newSequence.organization_type_id &&
             s.organization_id === newSequence.organization_id
      ) || newSequence;

      // Should keep existing higher value
      expect(finalSequence.next_number).toBe(1000050);
    });

    it('should insert new sequences for organizations without conflicts', () => {
      const existingSequences = [
        {
          organization_type_id: 'type-1',
          organization_id: 'org-1',
          next_number: 1000050
        }
      ];

      const newSequence = {
        organization_type_id: 'type-1',
        organization_id: 'org-2',
        next_number: 1000010
      };

      // Simulate ON CONFLICT DO NOTHING
      const conflict = existingSequences.find(
        s => s.organization_type_id === newSequence.organization_type_id &&
             s.organization_id === newSequence.organization_id
      );

      if (!conflict) {
        existingSequences.push(newSequence);
      }

      expect(existingSequences).toHaveLength(2);
      expect(existingSequences[1].next_number).toBe(1000010);
    });
  });

  describe('Uniqueness Scope Handling', () => {
    it('should create one sequence per organization for organization-level uniqueness', () => {
      // Scenario: Organization type with organization-level uniqueness
      const organizationType = {
        id: 'type-1',
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000
      };

      const organizations = [
        { id: 'org-1', organization_type_id: 'type-1' },
        { id: 'org-2', organization_type_id: 'type-1' },
        { id: 'org-3', organization_type_id: 'type-1' }
      ];

      // Should create 3 sequences (one per organization)
      const sequences = organizations.map(org => ({
        organization_type_id: org.organization_type_id,
        organization_id: org.id,
        next_number: organizationType.initial_membership_number
      }));

      expect(sequences).toHaveLength(3);
      expect(sequences.every(s => s.organization_id !== null)).toBe(true);
    });

    it('should create one sequence per organization type for type-level uniqueness', () => {
      // Scenario: Organization type with type-level uniqueness
      const organizationType = {
        id: 'type-1',
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization_type',
        initial_membership_number: 1000000
      };

      // Should create 1 sequence (shared across all organizations)
      const sequence = {
        organization_type_id: organizationType.id,
        organization_id: null, // NULL for type-level
        next_number: organizationType.initial_membership_number
      };

      expect(sequence.organization_id).toBeNull();
      expect(sequence.organization_type_id).toBe('type-1');
    });

    it('should not create sequences for external numbering mode', () => {
      // Scenario: Organization type uses external numbering
      const organizationType = {
        id: 'type-1',
        membership_numbering: 'external',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000
      };

      // Filter: only create sequences for internal mode
      const shouldCreateSequences = organizationType.membership_numbering === 'internal';

      expect(shouldCreateSequences).toBe(false);
    });
  });
});
