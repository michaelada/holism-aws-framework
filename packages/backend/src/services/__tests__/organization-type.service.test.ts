import { OrganizationTypeService } from '../organization-type.service';
import { capabilityService } from '../capability.service';
import { db } from '../../database/pool';
import { logger } from '../../config/logger';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../capability.service');

describe('OrganizationTypeService', () => {
  let service: OrganizationTypeService;
  const mockDb = db as jest.Mocked<typeof db>;
  const mockCapabilityService = capabilityService as jest.Mocked<typeof capabilityService>;

  beforeEach(() => {
    service = new OrganizationTypeService();
    jest.clearAllMocks();
  });

  describe('getAllOrganizationTypes', () => {
    it('should return all organization types', async () => {
      const mockTypes = [
        {
          id: '1',
          name: 'swimming-club',
          display_name: 'Swimming Club',
          description: 'Swimming clubs',
          currency: 'USD',
          language: 'en',
          default_capabilities: ['event-management'],
          membership_numbering: 'internal',
          membership_number_uniqueness: 'organization',
          initial_membership_number: 1000000,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockTypes } as any);

      const result = await service.getAllOrganizationTypes();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('swimming-club');
      expect(result[0].displayName).toBe('Swimming Club');
      expect(result[0].defaultCapabilities).toEqual(['event-management']);
      expect(result[0].membershipNumbering).toBe('internal');
      expect(result[0].membershipNumberUniqueness).toBe('organization');
      expect(result[0].initialMembershipNumber).toBe(1000000);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.getAllOrganizationTypes()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getOrganizationTypeById', () => {
    it('should return organization type when found', async () => {
      const mockType = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: ['event-management'],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      mockDb.query.mockResolvedValue({ rows: [mockType] } as any);

      const result = await service.getOrganizationTypeById('1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
      expect(result?.name).toBe('swimming-club');
      expect(result?.membershipNumbering).toBe('internal');
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getOrganizationTypeById('999');

      expect(result).toBeNull();
    });
  });

  describe('createOrganizationType', () => {
    it('should create organization type with valid capabilities', async () => {
      const newType = {
        name: 'tennis-club',
        displayName: 'Tennis Club',
        description: 'Tennis clubs',
        currency: 'EUR',
        language: 'en',
        defaultCapabilities: ['event-management', 'memberships']
      };

      mockCapabilityService.validateCapabilities.mockResolvedValue(true);

      const mockCreated = {
        id: '1',
        name: 'tennis-club',
        display_name: 'Tennis Club',
        description: 'Tennis clubs',
        currency: 'EUR',
        language: 'en',
        default_capabilities: ['event-management', 'memberships'],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCreated] }) // INSERT
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      const result = await service.createOrganizationType(newType, 'user-123');

      expect(mockCapabilityService.validateCapabilities).toHaveBeenCalledWith(newType.defaultCapabilities);
      expect(result.name).toBe('tennis-club');
      expect(result.membershipNumbering).toBe('internal');
      expect(result.membershipNumberUniqueness).toBe('organization');
      expect(result.initialMembershipNumber).toBe(1000000);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Organization type created: tennis-club'));
    });

    it('should create organization type with internal numbering and organization type-level uniqueness', async () => {
      const newType = {
        name: 'sports-club',
        displayName: 'Sports Club',
        description: 'Sports clubs',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'internal' as const,
        membershipNumberUniqueness: 'organization_type' as const,
        initialMembershipNumber: 2000000
      };

      const mockCreated = {
        id: 'org-type-123',
        name: 'sports-club',
        display_name: 'Sports Club',
        description: 'Sports clubs',
        currency: 'GBP',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization_type',
        initial_membership_number: 2000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCreated] }) // INSERT organization type
          .mockResolvedValueOnce({ rows: [] }) // INSERT sequence
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      const result = await service.createOrganizationType(newType);

      expect(result.membershipNumbering).toBe('internal');
      expect(result.membershipNumberUniqueness).toBe('organization_type');
      expect(result.initialMembershipNumber).toBe(2000000);
      
      // Verify sequence was initialized
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO membership_number_sequences'),
        ['org-type-123', null, 2000000]
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Initialized organization type-level sequence'));
    });

    it('should create organization type with external numbering', async () => {
      const newType = {
        name: 'external-club',
        displayName: 'External Club',
        description: 'External clubs',
        currency: 'USD',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'external' as const
      };

      const mockCreated = {
        id: 'org-type-456',
        name: 'external-club',
        display_name: 'External Club',
        description: 'External clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'external',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCreated] }) // INSERT
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      const result = await service.createOrganizationType(newType);

      expect(result.membershipNumbering).toBe('external');
      // Verify no sequence was initialized (only 3 queries: BEGIN, INSERT, COMMIT)
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should reject uniqueness field when numbering mode is external', async () => {
      const newType = {
        name: 'invalid-club',
        displayName: 'Invalid Club',
        description: 'Invalid',
        currency: 'USD',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'external' as const,
        membershipNumberUniqueness: 'organization_type' as const
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Membership number uniqueness can only be set for internal numbering mode')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.createOrganizationType(newType))
        .rejects.toThrow('Membership number uniqueness can only be set for internal numbering mode');
    });

    it('should reject initial number field when numbering mode is external', async () => {
      const newType = {
        name: 'invalid-club',
        displayName: 'Invalid Club',
        description: 'Invalid',
        currency: 'USD',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'external' as const,
        initialMembershipNumber: 5000000
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Initial membership number can only be set for internal numbering mode')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.createOrganizationType(newType))
        .rejects.toThrow('Initial membership number can only be set for internal numbering mode');
    });

    it('should reject negative initial membership number', async () => {
      const newType = {
        name: 'invalid-club',
        displayName: 'Invalid Club',
        description: 'Invalid',
        currency: 'USD',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'internal' as const,
        initialMembershipNumber: -100
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Initial membership number must be a positive integer')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.createOrganizationType(newType))
        .rejects.toThrow('Initial membership number must be a positive integer');
    });

    it('should reject zero initial membership number', async () => {
      const newType = {
        name: 'invalid-club',
        displayName: 'Invalid Club',
        description: 'Invalid',
        currency: 'USD',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'internal' as const,
        initialMembershipNumber: 0
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Initial membership number must be a positive integer')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.createOrganizationType(newType))
        .rejects.toThrow('Initial membership number must be a positive integer');
    });

    it('should throw error for invalid capabilities', async () => {
      const newType = {
        name: 'tennis-club',
        displayName: 'Tennis Club',
        description: 'Tennis clubs',
        currency: 'EUR',
        language: 'en',
        defaultCapabilities: ['invalid-capability']
      };

      mockCapabilityService.validateCapabilities.mockResolvedValue(false);

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Invalid capabilities provided')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.createOrganizationType(newType))
        .rejects.toThrow('Invalid capabilities provided');
    });

    it('should allow empty capabilities array', async () => {
      const newType = {
        name: 'tennis-club',
        displayName: 'Tennis Club',
        description: 'Tennis clubs',
        currency: 'EUR',
        language: 'en',
        defaultCapabilities: []
      };

      const mockCreated = {
        id: '1',
        name: 'tennis-club',
        display_name: 'Tennis Club',
        description: 'Tennis clubs',
        currency: 'EUR',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCreated] }) // INSERT
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      const result = await service.createOrganizationType(newType);

      expect(mockCapabilityService.validateCapabilities).not.toHaveBeenCalled();
      expect(result.defaultCapabilities).toEqual([]);
    });
  });

  describe('updateOrganizationType', () => {
    it('should update organization type fields', async () => {
      const updates = {
        displayName: 'Updated Name',
        currency: 'GBP',
        defaultCapabilities: ['event-management']
      };

      mockCapabilityService.validateCapabilities.mockResolvedValue(true);

      const mockCurrent = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockUpdated = {
        ...mockCurrent,
        display_name: 'Updated Name',
        currency: 'GBP',
        default_capabilities: ['event-management']
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCurrent] }) // SELECT current
          .mockResolvedValueOnce({ rows: [mockUpdated] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      const result = await service.updateOrganizationType('1', updates, 'user-123');

      expect(result.displayName).toBe('Updated Name');
      expect(result.currency).toBe('GBP');
      expect(logger.info).toHaveBeenCalledWith('Organization type updated: 1');
    });

    it('should update membership numbering configuration fields', async () => {
      const updates = {
        membershipNumbering: 'internal' as const,
        membershipNumberUniqueness: 'organization_type' as const,
        initialMembershipNumber: 2000000
      };

      const mockCurrent = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockUpdated = {
        ...mockCurrent,
        membership_number_uniqueness: 'organization_type',
        initial_membership_number: 2000000
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCurrent] }) // SELECT current
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Check member count
          .mockResolvedValueOnce({ rows: [mockUpdated] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // Check existing sequence
          .mockResolvedValueOnce({ rows: [{ max_number: null }] }) // Find max number
          .mockResolvedValueOnce({ rows: [] }) // INSERT sequence
          .mockResolvedValueOnce({ rows: [] }) // DELETE org-level sequences
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      const result = await service.updateOrganizationType('1', updates);

      expect(result.membershipNumberUniqueness).toBe('organization_type');
      expect(result.initialMembershipNumber).toBe(2000000);
    });

    it('should reject changing numbering mode when members exist', async () => {
      const updates = {
        membershipNumbering: 'external' as const
      };

      const mockCurrent = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCurrent] }) // SELECT current
          .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Check member count
          .mockRejectedValueOnce(new Error('Cannot change membership numbering mode when members already exist for this organization type')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.updateOrganizationType('1', updates))
        .rejects.toThrow('Cannot change membership numbering mode when members already exist for this organization type');
    });

    it('should reject changing uniqueness scope when duplicate numbers exist', async () => {
      const updates = {
        membershipNumberUniqueness: 'organization_type' as const
      };

      const mockCurrent = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCurrent] }) // SELECT current
          .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Check member count
          .mockResolvedValueOnce({ rows: [{ membership_number: '1000001', count: '2' }] }) // Check duplicates
          .mockRejectedValueOnce(new Error('Cannot change to organization type-level uniqueness: duplicate membership numbers exist across organizations (1000001)')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.updateOrganizationType('1', updates))
        .rejects.toThrow('Cannot change to organization type-level uniqueness: duplicate membership numbers exist across organizations (1000001)');
    });

    it('should allow changing uniqueness scope when no duplicates exist', async () => {
      const updates = {
        membershipNumberUniqueness: 'organization_type' as const
      };

      const mockCurrent = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockUpdated = {
        ...mockCurrent,
        membership_number_uniqueness: 'organization_type'
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCurrent] }) // SELECT current
          .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Check member count
          .mockResolvedValueOnce({ rows: [] }) // Check duplicates - none found
          .mockResolvedValueOnce({ rows: [mockUpdated] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // Check existing sequence
          .mockResolvedValueOnce({ rows: [{ max_number: 1000050 }] }) // Find max number
          .mockResolvedValueOnce({ rows: [] }) // INSERT sequence
          .mockResolvedValueOnce({ rows: [] }) // DELETE org-level sequences
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      const result = await service.updateOrganizationType('1', updates);

      expect(result.membershipNumberUniqueness).toBe('organization_type');
    });

    it('should reject uniqueness field when changing to external mode', async () => {
      const updates = {
        membershipNumbering: 'external' as const,
        membershipNumberUniqueness: 'organization_type' as const
      };

      const mockCurrent = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCurrent] }) // SELECT current
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Check member count
          .mockRejectedValueOnce(new Error('Membership number uniqueness can only be set for internal numbering mode')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.updateOrganizationType('1', updates))
        .rejects.toThrow('Membership number uniqueness can only be set for internal numbering mode');
    });

    it('should reject initial number field when changing to external mode', async () => {
      const updates = {
        membershipNumbering: 'external' as const,
        initialMembershipNumber: 5000000
      };

      const mockCurrent = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCurrent] }) // SELECT current
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Check member count
          .mockRejectedValueOnce(new Error('Initial membership number can only be set for internal numbering mode')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.updateOrganizationType('1', updates))
        .rejects.toThrow('Initial membership number can only be set for internal numbering mode');
    });

    it('should reject negative initial membership number', async () => {
      const updates = {
        initialMembershipNumber: -100
      };

      const mockCurrent = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCurrent] }) // SELECT current
          .mockRejectedValueOnce(new Error('Initial membership number must be a positive integer')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.updateOrganizationType('1', updates))
        .rejects.toThrow('Initial membership number must be a positive integer');
    });

    it('should delete org type-level sequence when changing to organization-level uniqueness', async () => {
      const updates = {
        membershipNumberUniqueness: 'organization' as const
      };

      const mockCurrent = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Swimming Club',
        description: 'Swimming clubs',
        currency: 'USD',
        language: 'en',
        default_capabilities: [],
        membership_numbering: 'internal',
        membership_number_uniqueness: 'organization_type',
        initial_membership_number: 1000000,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      const mockUpdated = {
        ...mockCurrent,
        membership_number_uniqueness: 'organization'
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockCurrent] }) // SELECT current
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Check member count
          .mockResolvedValueOnce({ rows: [mockUpdated] }) // UPDATE
          .mockResolvedValueOnce({ rows: [] }) // DELETE org type-level sequence
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      const result = await service.updateOrganizationType('1', updates);

      expect(result.membershipNumberUniqueness).toBe('organization');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM membership_number_sequences'),
        ['1']
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Deleted organization type-level sequence'));
    });

    it('should throw error when not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SELECT current - not found
          .mockRejectedValueOnce(new Error('Organization type not found')),
        release: jest.fn()
      };

      mockDb.getClient.mockResolvedValue(mockClient as any);

      await expect(service.updateOrganizationType('999', { displayName: 'Test' }))
        .rejects.toThrow('Organization type not found');
    });
  });

  describe('deleteOrganizationType', () => {
    it('should delete organization type when no organizations exist', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any) // org check
        .mockResolvedValueOnce({ rowCount: 1 } as any); // delete

      await service.deleteOrganizationType('1');

      expect(logger.info).toHaveBeenCalledWith('Organization type deleted: 1');
    });

    it('should throw error when organizations exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '5' }] } as any);

      await expect(service.deleteOrganizationType('1'))
        .rejects.toThrow('Cannot delete organization type with existing organizations');
    });

    it('should throw error when type not found', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rowCount: 0 } as any);

      await expect(service.deleteOrganizationType('999'))
        .rejects.toThrow('Organization type not found');
    });
  });

  describe('getOrganizationCount', () => {
    it('should return organization count for type', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '10' }] } as any);

      const result = await service.getOrganizationCount('1');

      expect(result).toBe(10);
    });

    it('should return 0 when no organizations', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] } as any);

      const result = await service.getOrganizationCount('1');

      expect(result).toBe(0);
    });
  });
});
