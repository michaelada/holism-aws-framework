import { CapabilityService } from '../capability.service';
import { db } from '../../database/pool';
import { logger } from '../../config/logger';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('CapabilityService', () => {
  let service: CapabilityService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new CapabilityService();
    jest.clearAllMocks();
  });

  describe('getAllCapabilities', () => {
    it('should return all active capabilities', async () => {
      const mockCapabilities = [
        {
          id: '1',
          name: 'event-management',
          display_name: 'Event Management',
          description: 'Manage events',
          category: 'core-service',
          is_active: true,
          created_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockCapabilities } as any);

      const result = await service.getAllCapabilities();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM capabilities WHERE is_active = true'),
        []
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('event-management');
      expect(result[0].displayName).toBe('Event Management');
    });

    it('should filter by category when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getAllCapabilities('core-service');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND category = $1'),
        ['core-service']
      );
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.getAllCapabilities()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error getting capabilities:', error);
    });
  });

  describe('getCapabilityById', () => {
    it('should return capability when found', async () => {
      const mockCapability = {
        id: '1',
        name: 'event-management',
        display_name: 'Event Management',
        description: 'Manage events',
        category: 'core-service',
        is_active: true,
        created_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockCapability] } as any);

      const result = await service.getCapabilityById('1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
      expect(result?.name).toBe('event-management');
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getCapabilityById('999');

      expect(result).toBeNull();
    });
  });

  describe('getCapabilityByName', () => {
    it('should return capability when found by name', async () => {
      const mockCapability = {
        id: '1',
        name: 'event-management',
        display_name: 'Event Management',
        description: 'Manage events',
        category: 'core-service',
        is_active: true,
        created_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockCapability] } as any);

      const result = await service.getCapabilityByName('event-management');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('event-management');
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getCapabilityByName('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createCapability', () => {
    it('should create a new capability', async () => {
      const newCapability = {
        name: 'new-feature',
        displayName: 'New Feature',
        description: 'A new feature',
        category: 'additional-feature' as const
      };

      const mockCreated = {
        id: '1',
        name: 'new-feature',
        display_name: 'New Feature',
        description: 'A new feature',
        category: 'additional-feature',
        is_active: true,
        created_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createCapability(newCapability);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO capabilities'),
        [newCapability.name, newCapability.displayName, newCapability.description, newCapability.category]
      );
      expect(result.name).toBe('new-feature');
      expect(logger.info).toHaveBeenCalledWith('Capability created: new-feature');
    });
  });

  describe('updateCapability', () => {
    it('should update capability fields', async () => {
      const updates = {
        displayName: 'Updated Name',
        description: 'Updated description'
      };

      const mockUpdated = {
        id: '1',
        name: 'event-management',
        display_name: 'Updated Name',
        description: 'Updated description',
        category: 'core-service',
        is_active: true,
        created_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await service.updateCapability('1', updates);

      expect(result.displayName).toBe('Updated Name');
      expect(logger.info).toHaveBeenCalledWith('Capability updated: 1');
    });

    it('should throw error when capability not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.updateCapability('999', { displayName: 'Test' }))
        .rejects.toThrow('Capability not found');
    });
  });

  describe('deactivateCapability', () => {
    it('should deactivate a capability', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      await service.deactivateCapability('1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE capabilities SET is_active = false WHERE id = $1',
        ['1']
      );
      expect(logger.info).toHaveBeenCalledWith('Capability deactivated: 1');
    });
  });

  describe('validateCapabilities', () => {
    it('should return true when all capabilities are valid', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '3' }] } as any);

      const result = await service.validateCapabilities(['cap1', 'cap2', 'cap3']);

      expect(result).toBe(true);
    });

    it('should return false when some capabilities are invalid', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '2' }] } as any);

      const result = await service.validateCapabilities(['cap1', 'cap2', 'cap3']);

      expect(result).toBe(false);
    });

    it('should return false when no capabilities are valid', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] } as any);

      const result = await service.validateCapabilities(['invalid1', 'invalid2']);

      expect(result).toBe(false);
    });
  });
});
