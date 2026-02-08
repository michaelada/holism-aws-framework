import { db } from '../../database/pool';
import {
  withTransaction,
  tableExists,
  getTableColumns,
  executeInTransaction,
  buildParameterizedQuery,
} from '../../database/utils';

// Mock the database pool
jest.mock('../../database/pool', () => ({
  db: {
    getClient: jest.fn(),
    query: jest.fn(),
  },
}));

describe('Database Utils', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (db.getClient as jest.Mock).mockResolvedValue(mockClient);
  });

  describe('withTransaction', () => {
    it('should execute callback within a transaction and commit', async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const callback = jest.fn().mockResolvedValue('success');

      const result = await withTransaction(callback);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should rollback transaction on error', async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const error = new Error('Transaction failed');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(withTransaction(callback)).rejects.toThrow('Transaction failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even if rollback fails', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK

      const callback = jest.fn().mockRejectedValue(new Error('Transaction failed'));

      await expect(withTransaction(callback)).rejects.toThrow();

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('tableExists', () => {
    it('should return true when table exists', async () => {
      (db.query as jest.Mock).mockResolvedValue({
        rows: [{ exists: true }],
        rowCount: 1,
      });

      const exists = await tableExists('users');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('information_schema.tables'),
        ['users']
      );
      expect(exists).toBe(true);
    });

    it('should return false when table does not exist', async () => {
      (db.query as jest.Mock).mockResolvedValue({
        rows: [{ exists: false }],
        rowCount: 1,
      });

      const exists = await tableExists('nonexistent_table');

      expect(exists).toBe(false);
    });
  });

  describe('getTableColumns', () => {
    it('should return column names for a table', async () => {
      (db.query as jest.Mock).mockResolvedValue({
        rows: [{ column_name: 'id' }, { column_name: 'name' }, { column_name: 'email' }],
        rowCount: 3,
      });

      const columns = await getTableColumns('users');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('information_schema.columns'),
        ['users']
      );
      expect(columns).toEqual(['id', 'name', 'email']);
    });

    it('should return empty array for table with no columns', async () => {
      (db.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const columns = await getTableColumns('empty_table');

      expect(columns).toEqual([]);
    });
  });

  describe('executeInTransaction', () => {
    it('should execute multiple queries in a transaction', async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const queries = [
        { text: 'INSERT INTO users (name) VALUES ($1)', params: ['Alice'] },
        { text: 'INSERT INTO users (name) VALUES ($1)', params: ['Bob'] },
        { text: 'UPDATE users SET active = true' },
      ];

      await executeInTransaction(queries);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(queries[0].text, queries[0].params);
      expect(mockClient.query).toHaveBeenCalledWith(queries[1].text, queries[1].params);
      expect(mockClient.query).toHaveBeenCalledWith(queries[2].text, undefined);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback if any query fails', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // First query
        .mockRejectedValueOnce(new Error('Query failed')); // Second query fails

      const queries = [
        { text: 'INSERT INTO users (name) VALUES ($1)', params: ['Alice'] },
        { text: 'INSERT INTO users (name) VALUES ($1)', params: ['Bob'] },
      ];

      await expect(executeInTransaction(queries)).rejects.toThrow('Query failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('buildParameterizedQuery', () => {
    it('should convert named parameters to numbered placeholders', () => {
      const baseQuery = 'SELECT * FROM users WHERE name = :name AND age > :age';
      const params = { name: 'Alice', age: 25 };

      const result = buildParameterizedQuery(baseQuery, params);

      expect(result.text).toBe('SELECT * FROM users WHERE name = $1 AND age > $2');
      expect(result.values).toEqual(['Alice', 25]);
    });

    it('should handle repeated parameters', () => {
      const baseQuery = 'SELECT * FROM users WHERE name = :name OR email = :name';
      const params = { name: 'alice@example.com' };

      const result = buildParameterizedQuery(baseQuery, params);

      expect(result.text).toBe('SELECT * FROM users WHERE name = $1 OR email = $1');
      expect(result.values).toEqual(['alice@example.com']);
    });

    it('should handle queries with no parameters', () => {
      const baseQuery = 'SELECT * FROM users';
      const params = {};

      const result = buildParameterizedQuery(baseQuery, params);

      expect(result.text).toBe('SELECT * FROM users');
      expect(result.values).toEqual([]);
    });

    it('should handle multiple different parameters', () => {
      const baseQuery =
        'INSERT INTO users (name, email, age) VALUES (:name, :email, :age)';
      const params = { name: 'Alice', email: 'alice@example.com', age: 30 };

      const result = buildParameterizedQuery(baseQuery, params);

      expect(result.text).toBe('INSERT INTO users (name, email, age) VALUES ($1, $2, $3)');
      expect(result.values).toEqual(['Alice', 'alice@example.com', 30]);
    });
  });
});
