import { CapabilityService } from '../capability.service';
import { db } from '../../database/pool';
import { logger } from '../../config/logger';
import cacheService from '../cache.service';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../cache.service');

describe('CapabilityService', () => {
  let service: CapabilityService;
  const mockDb = db as jest.Mocked<typeof db>;
  const mockCache = cacheService as jest.Mocked<typeof cacheService>;

  beforeEach(() => {
    service = new CapabilityService();
    jest.clearAllMocks();
    // Ensure cache returns null by default
    mockCache.get = jest.fn().mockReturnValue(null);
    mockCache.set = jest.fn();
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

  /**
   * Which names are not capabilities — and it has to be *which*.
   *
   * The old check counted matches and returned a boolean, so a refusal could
   * only ever say "Invalid capabilities provided". A super-admin editing an
   * organisation type's application fee met exactly that: a 500 naming nothing,
   * about three capability names their record had carried since it was seeded
   * and which they had never touched.
   */
  describe('unknownCapabilities', () => {
    /** The catalogue answers with the subset it recognises. */
    const catalogue = (known: string[]) =>
      mockDb.query.mockResolvedValue({ rows: known.map((name) => ({ name })) } as any);

    it('names the ones it does not recognise', async () => {
      catalogue(['memberships']);

      const unknown = await service.unknownCapabilities([
        'memberships',
        'not-a-thing',
        'also-not-a-thing',
      ]);

      expect(unknown).toEqual(['not-a-thing', 'also-not-a-thing']);
    });

    it('returns nothing when every name is known', async () => {
      catalogue(['cap1', 'cap2', 'cap3']);

      await expect(service.unknownCapabilities(['cap1', 'cap2', 'cap3'])).resolves.toEqual([]);
    });

    it('asks nothing of the database for an empty list', async () => {
      await expect(service.unknownCapabilities([])).resolves.toEqual([]);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('reports a repeated unknown name once', async () => {
      // The refusal reads as a sentence; repeating a name in it helps nobody.
      catalogue([]);

      await expect(
        service.unknownCapabilities(['ghost', 'ghost', 'ghost'])
      ).resolves.toEqual(['ghost']);
    });

    it('counts a deactivated capability as unknown', async () => {
      /*
       * The query filters on `is_active`, so a switched-off capability comes
       * back unmatched. It cannot be granted, and saying it is not a capability
       * is nearer the truth than saying nothing at all.
       */
      catalogue([]);

      await expect(service.unknownCapabilities(['retired-thing'])).resolves.toEqual([
        'retired-thing',
      ]);
      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('is_active = true');
    });
  });

  describe('validateCapabilities', () => {
    const catalogue = (known: string[]) =>
      mockDb.query.mockResolvedValue({ rows: known.map((name) => ({ name })) } as any);

    it('should return true when all capabilities are valid', async () => {
      catalogue(['cap1', 'cap2', 'cap3']);

      await expect(service.validateCapabilities(['cap1', 'cap2', 'cap3'])).resolves.toBe(true);
    });

    it('should return false when some capabilities are invalid', async () => {
      catalogue(['cap1', 'cap2']);

      await expect(service.validateCapabilities(['cap1', 'cap2', 'cap3'])).resolves.toBe(false);
    });

    it('should return false when no capabilities are valid', async () => {
      catalogue([]);

      await expect(service.validateCapabilities(['invalid1', 'invalid2'])).resolves.toBe(false);
    });
  });
});
