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
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createOrganizationType(newType, 'user-123');

      expect(mockCapabilityService.validateCapabilities).toHaveBeenCalledWith(newType.defaultCapabilities);
      expect(result.name).toBe('tennis-club');
      expect(logger.info).toHaveBeenCalledWith('Organization type created: tennis-club');
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
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

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

      const mockUpdated = {
        id: '1',
        name: 'swimming-club',
        display_name: 'Updated Name',
        description: 'Swimming clubs',
        currency: 'GBP',
        language: 'en',
        default_capabilities: ['event-management'],
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      mockDb.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await service.updateOrganizationType('1', updates, 'user-123');

      expect(result.displayName).toBe('Updated Name');
      expect(result.currency).toBe('GBP');
      expect(logger.info).toHaveBeenCalledWith('Organization type updated: 1');
    });

    it('should throw error when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

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
