import { Pool } from 'pg';
import { db } from '../../database/pool';

// Mock pg Pool
jest.mock('pg', () => {
  const mockPool = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    totalCount: 10,
    idleCount: 5,
    waitingCount: 0,
  };

  return {
    Pool: jest.fn(() => mockPool),
  };
});

describe('DatabasePool', () => {
  let mockPool: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Get the mock pool instance
    mockPool = new Pool();

    // Set up default mock implementations
    mockPool.connect.mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }], rowCount: 1 }),
      release: jest.fn(),
    });

    mockPool.query.mockResolvedValue({
      rows: [{ result: 'success' }],
      rowCount: 1,
    });

    mockPool.end.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await db.close();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('initialize', () => {
    it('should initialize the pool successfully', async () => {
      await db.initialize();

      expect(Pool).toHaveBeenCalled();
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should set up event handlers', async () => {
      await db.initialize();

      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
    });

    it('should test connection during initialization', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient);

      await db.initialize();

      expect(mockClient.query).toHaveBeenCalledWith('SELECT NOW()');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if connection test fails', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(db.initialize()).rejects.toThrow('Failed to connect to database');
    });

    it('should warn if already initialized', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await db.initialize();
      await db.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('Database pool already initialized');

      consoleSpy.mockRestore();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await db.initialize();
      jest.clearAllMocks();
    });

    it('should execute query successfully', async () => {
      const expectedResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 };
      mockPool.query.mockResolvedValue(expectedResult);

      const result = await db.query('SELECT * FROM test WHERE id = $1', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(result).toEqual(expectedResult);
    });

    it('should log slow queries', async () => {
      const { logger } = require('../../config/logger');
      const loggerSpy = jest.spyOn(logger, 'warn').mockImplementation();

      // Mock a slow query by delaying the response
      mockPool.query.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ rows: [], rowCount: 0 });
            }, 1100);
          })
      );

      await db.query('SELECT * FROM slow_table');

      expect(loggerSpy).toHaveBeenCalledWith(
        'Slow query detected',
        expect.any(Object)
      );

      loggerSpy.mockRestore();
    });

    it('should throw error if pool not initialized', async () => {
      await db.close();

      await expect(db.query('SELECT 1')).rejects.toThrow('Database pool not initialized');
    });

    it('should log and rethrow query errors', async () => {
      const { logger } = require('../../config/logger');
      const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();
      const queryError = new Error('Query failed');

      mockPool.query.mockRejectedValue(queryError);

      await expect(db.query('SELECT * FROM invalid')).rejects.toThrow('Query failed');

      expect(loggerSpy).toHaveBeenCalledWith('Database query error', expect.any(Object));

      loggerSpy.mockRestore();
    });
  });

  describe('getClient', () => {
    beforeEach(async () => {
      await db.initialize();
      jest.clearAllMocks();
    });

    it('should return a client from the pool', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient);

      const client = await db.getClient();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });

    it('should throw error if pool not initialized', async () => {
      await db.close();

      await expect(db.getClient()).rejects.toThrow('Database pool not initialized');
    });
  });

  describe('isHealthy', () => {
    beforeEach(async () => {
      await db.initialize();
      jest.clearAllMocks();
    });

    it('should return true when database is healthy', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ result: 1 }], rowCount: 1 });

      const healthy = await db.isHealthy();

      expect(healthy).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false when database query fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPool.query.mockRejectedValue(new Error('Connection lost'));

      const healthy = await db.isHealthy();

      expect(healthy).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should return false when pool not initialized', async () => {
      await db.close();

      const healthy = await db.isHealthy();

      expect(healthy).toBe(false);
    });
  });

  describe('close', () => {
    it('should close the pool', async () => {
      await db.initialize();
      jest.clearAllMocks();

      await db.close();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle closing when pool not initialized', async () => {
      await db.close();

      // Should not throw error
      expect(mockPool.end).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await db.initialize();
      jest.clearAllMocks();
    });

    it('should return pool statistics', () => {
      const stats = db.getStats();

      expect(stats).toEqual({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
        isConnected: true,
      });
    });

    it('should return null when pool not initialized', async () => {
      await db.close();

      const stats = db.getStats();

      expect(stats).toBeNull();
    });
  });
});
