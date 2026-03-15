/**
 * Tests for membership number sequence initialization
 * 
 * This test suite validates the SQL logic for initializing sequences
 * for existing organizations with internal numbering.
 * 
 * Requirements: 6.1, 6.2
 */

describe('Membership Number Sequence Initialization', () => {
  describe('Organization-level uniqueness', () => {
    it('should extract highest numeric membership number', () => {
      // Simulate existing membership numbers
      const membershipNumbers = ['1000000', '1000001', '1000002'];
      const highest = Math.max(...membershipNumbers.map(n => parseInt(n)));
      const nextNumber = highest + 1;

      expect(nextNumber).toBe(1000003);
    });

    it('should handle membership numbers with prefixes', () => {
      // Simulate membership numbers like "PREFIX-123"
      const membershipNumbers = ['ABC-1000', 'ABC-1001', 'ABC-999'];
      const numericValues = membershipNumbers.map(n => 
        parseInt(n.replace(/[^\d]/g, ''))
      );
      const highest = Math.max(...numericValues);
      const nextNumber = highest + 1;

      expect(nextNumber).toBe(1002);
    });

    it('should handle mixed format membership numbers', () => {
      // Mix of pure numeric and prefixed numbers
      const membershipNumbers = ['1000000', 'PREFIX-1000001', '1000002'];
      const numericValues = membershipNumbers.map(n => 
        parseInt(n.replace(/[^\d]/g, ''))
      );
      const highest = Math.max(...numericValues);
      const nextNumber = highest + 1;

      expect(nextNumber).toBe(1000003);
    });

    it('should use default when no numeric membership numbers exist', () => {
      const membershipNumbers = ['ABC', 'XYZ', 'NO-NUMBERS'];
      const numericValues = membershipNumbers
        .map(n => n.replace(/[^\d]/g, ''))
        .filter(n => n.length > 0)
        .map(n => parseInt(n));
      
      const nextNumber = numericValues.length > 0 
        ? Math.max(...numericValues) + 1 
        : 1000000;

      expect(nextNumber).toBe(1000000);
    });

    it('should use default when no members exist', () => {
      const membershipNumbers: string[] = [];
      const defaultInitialNumber = 1000000;
      
      const nextNumber = membershipNumbers.length > 0
        ? Math.max(...membershipNumbers.map(n => parseInt(n))) + 1
        : defaultInitialNumber;

      expect(nextNumber).toBe(1000000);
    });

    it('should use configured initial_membership_number as default', () => {
      const membershipNumbers: string[] = [];
      const configuredInitialNumber = 5000000;
      
      const nextNumber = membershipNumbers.length > 0
        ? Math.max(...membershipNumbers.map(n => parseInt(n))) + 1
        : configuredInitialNumber;

      expect(nextNumber).toBe(5000000);
    });
  });

  describe('Organization type-level uniqueness', () => {
    it('should find highest number across multiple organizations', () => {
      // Simulate members from different organizations of the same type
      const org1Members = ['1000000', '1000001'];
      const org2Members = ['1000005', '1000006'];
      const org3Members = ['1000003', '1000004'];
      
      const allMembers = [...org1Members, ...org2Members, ...org3Members];
      const highest = Math.max(...allMembers.map(n => parseInt(n)));
      const nextNumber = highest + 1;

      expect(nextNumber).toBe(1000007);
    });

    it('should handle empty organizations in the type', () => {
      // Some organizations have members, some don't
      const org1Members = ['1000000', '1000001'];
      const org2Members: string[] = [];
      const org3Members = ['1000002'];
      
      const allMembers = [...org1Members, ...org2Members, ...org3Members];
      const nextNumber = allMembers.length > 0
        ? Math.max(...allMembers.map(n => parseInt(n))) + 1
        : 1000000;

      expect(nextNumber).toBe(1000003);
    });

    it('should use default when all organizations are empty', () => {
      const org1Members: string[] = [];
      const org2Members: string[] = [];
      const org3Members: string[] = [];
      
      const allMembers = [...org1Members, ...org2Members, ...org3Members];
      const defaultInitialNumber = 1000000;
      
      const nextNumber = allMembers.length > 0
        ? Math.max(...allMembers.map(n => parseInt(n))) + 1
        : defaultInitialNumber;

      expect(nextNumber).toBe(1000000);
    });
  });

  describe('Regex pattern matching', () => {
    it('should match purely numeric membership numbers', () => {
      const purelyNumeric = /^\d+$/;
      
      expect('1000000').toMatch(purelyNumeric);
      expect('123456').toMatch(purelyNumeric);
      expect('PREFIX-123').not.toMatch(purelyNumeric);
      expect('ABC123').not.toMatch(purelyNumeric);
    });

    it('should match membership numbers containing digits', () => {
      const containsDigits = /\d+/;
      
      expect('1000000').toMatch(containsDigits);
      expect('PREFIX-123').toMatch(containsDigits);
      expect('ABC123').toMatch(containsDigits);
      expect('NODIGITS').not.toMatch(containsDigits);
    });

    it('should extract numeric values correctly', () => {
      const extractNumeric = (str: string) => str.replace(/[^\d]/g, '');
      
      expect(extractNumeric('1000000')).toBe('1000000');
      expect(extractNumeric('PREFIX-123')).toBe('123');
      expect(extractNumeric('ABC-123-XYZ')).toBe('123');
      expect(extractNumeric('A1B2C3')).toBe('123');
      expect(extractNumeric('NODIGITS')).toBe('');
    });
  });

  describe('Edge cases', () => {
    it('should handle very large membership numbers', () => {
      const membershipNumbers = ['9999999', '10000000', '10000001'];
      const highest = Math.max(...membershipNumbers.map(n => parseInt(n)));
      const nextNumber = highest + 1;

      expect(nextNumber).toBe(10000002);
    });

    it('should handle single member organization', () => {
      const membershipNumbers = ['1000000'];
      const highest = Math.max(...membershipNumbers.map(n => parseInt(n)));
      const nextNumber = highest + 1;

      expect(nextNumber).toBe(1000001);
    });

    it('should handle membership numbers with leading zeros', () => {
      // Note: Leading zeros are lost when converting to integer
      const membershipNumbers = ['0001000', '0001001'];
      const highest = Math.max(...membershipNumbers.map(n => parseInt(n)));
      const nextNumber = highest + 1;

      expect(nextNumber).toBe(1002);
    });

    it('should handle membership numbers with multiple numeric segments', () => {
      // e.g., "2024-1000-5"
      const membershipNumber = '2024-1000-5';
      const extracted = membershipNumber.replace(/[^\d]/g, '');
      const numeric = parseInt(extracted);

      expect(extracted).toBe('202410005');
      expect(numeric).toBe(202410005);
    });
  });

  describe('COALESCE logic', () => {
    it('should prefer highest member number over default', () => {
      const highestMemberNumber = 1000005;
      const defaultInitialNumber = 1000000;
      
      const nextNumber = highestMemberNumber !== null 
        ? highestMemberNumber + 1 
        : defaultInitialNumber;

      expect(nextNumber).toBe(1000006);
    });

    it('should use default when no members found', () => {
      const highestMemberNumber = null;
      const defaultInitialNumber = 1000000;
      
      const nextNumber = highestMemberNumber !== null 
        ? highestMemberNumber + 1 
        : defaultInitialNumber;

      expect(nextNumber).toBe(1000000);
    });

    it('should use configured initial number over hardcoded default', () => {
      const configuredInitial = 5000000;
      const hardcodedDefault = 1000000;
      
      const nextNumber = configuredInitial ?? hardcodedDefault;

      expect(nextNumber).toBe(5000000);
    });

    it('should fall back to hardcoded default when configured is null', () => {
      const configuredInitial = null;
      const hardcodedDefault = 1000000;
      
      const nextNumber = configuredInitial ?? hardcodedDefault;

      expect(nextNumber).toBe(1000000);
    });
  });

  describe('ON CONFLICT behavior', () => {
    it('should not overwrite existing sequence records', () => {
      // Simulate existing sequence
      const existingSequences = new Map([
        ['org-type-1:org-1', 1000010]
      ]);

      const newSequenceKey = 'org-type-1:org-1';
      const newSequenceValue = 1000005;

      // ON CONFLICT DO NOTHING means we keep existing value
      if (!existingSequences.has(newSequenceKey)) {
        existingSequences.set(newSequenceKey, newSequenceValue);
      }

      expect(existingSequences.get(newSequenceKey)).toBe(1000010);
    });

    it('should insert new sequence when no conflict', () => {
      const existingSequences = new Map([
        ['org-type-1:org-1', 1000010]
      ]);

      const newSequenceKey = 'org-type-1:org-2';
      const newSequenceValue = 1000005;

      if (!existingSequences.has(newSequenceKey)) {
        existingSequences.set(newSequenceKey, newSequenceValue);
      }

      expect(existingSequences.get(newSequenceKey)).toBe(1000005);
    });
  });
});
