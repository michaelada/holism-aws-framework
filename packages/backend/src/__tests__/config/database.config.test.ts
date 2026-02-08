import { getDatabaseConfig, validateDatabaseConfig, DatabaseConfig } from '../../config/database.config';

// Mock the secrets manager
jest.mock('../../config/secrets', () => ({
  secretsManager: {
    getSecret: jest.fn().mockRejectedValue(new Error('Not initialized'))
  }
}));

describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getDatabaseConfig', () => {
    it('should return default development configuration', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_HOST = 'localhost';
      process.env.DATABASE_PORT = '5432';
      process.env.DATABASE_NAME = 'aws_framework';
      process.env.DATABASE_USER = 'framework_user';
      process.env.DATABASE_PASSWORD = 'framework_password';

      const config = await getDatabaseConfig();

      expect(config).toEqual({
        host: 'localhost',
        port: 5432,
        database: 'aws_framework',
        user: 'framework_user',
        password: 'framework_password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    });

    it('should return production configuration with larger pool', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_HOST = 'prod-db.example.com';
      process.env.DATABASE_PORT = '5432';
      process.env.DATABASE_NAME = 'aws_framework_prod';
      process.env.DATABASE_USER = 'prod_user';
      process.env.DATABASE_PASSWORD = 'prod_password';

      const config = await getDatabaseConfig();

      expect(config.max).toBe(50);
      expect(config.idleTimeoutMillis).toBe(60000);
      expect(config.connectionTimeoutMillis).toBe(5000);
      expect(config.host).toBe('prod-db.example.com');
    });

    it('should return staging configuration with medium pool', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.DATABASE_HOST = 'staging-db.example.com';
      process.env.DATABASE_PORT = '5432';
      process.env.DATABASE_NAME = 'aws_framework_staging';
      process.env.DATABASE_USER = 'staging_user';
      process.env.DATABASE_PASSWORD = 'staging_password';

      const config = await getDatabaseConfig();

      expect(config.max).toBe(30);
      expect(config.idleTimeoutMillis).toBe(45000);
      expect(config.connectionTimeoutMillis).toBe(3000);
      expect(config.host).toBe('staging-db.example.com');
    });

    it('should return test configuration with small pool', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_HOST = 'localhost';
      process.env.DATABASE_PORT = '5432';
      process.env.DATABASE_USER = 'test_user';
      process.env.DATABASE_PASSWORD = 'test_password';
      delete process.env.DATABASE_NAME; // Ensure DATABASE_NAME is not set to test default

      const config = await getDatabaseConfig();

      expect(config.max).toBe(5);
      expect(config.idleTimeoutMillis).toBe(10000);
      expect(config.connectionTimeoutMillis).toBe(1000);
      expect(config.database).toBe('aws_framework_test');
    });

    it('should use default values when environment variables are not set', async () => {
      process.env.NODE_ENV = 'development'; // Explicitly set to development
      delete process.env.DATABASE_HOST;
      delete process.env.DATABASE_PORT;
      delete process.env.DATABASE_NAME;
      delete process.env.DATABASE_USER;
      delete process.env.DATABASE_PASSWORD;

      const config = await getDatabaseConfig();

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('aws_framework');
      expect(config.user).toBe('framework_user');
      expect(config.password).toBe('framework_password');
    });

    it('should parse port as integer', async () => {
      process.env.DATABASE_PORT = '3306';

      const config = await getDatabaseConfig();

      expect(config.port).toBe(3306);
      expect(typeof config.port).toBe('number');
    });
  });

  describe('validateDatabaseConfig', () => {
    it('should not throw error for valid configuration', () => {
      const validConfig: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      expect(() => validateDatabaseConfig(validConfig)).not.toThrow();
    });

    it('should throw error when host is missing', () => {
      const invalidConfig: DatabaseConfig = {
        host: '',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow('DATABASE_HOST is required');
    });

    it('should throw error when port is invalid', () => {
      const invalidConfig: DatabaseConfig = {
        host: 'localhost',
        port: 0,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow(
        'DATABASE_PORT must be a valid port number'
      );
    });

    it('should throw error when database name is missing', () => {
      const invalidConfig: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: '',
        user: 'test_user',
        password: 'test_password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow('DATABASE_NAME is required');
    });

    it('should throw error when user is missing', () => {
      const invalidConfig: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: '',
        password: 'test_password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow('DATABASE_USER is required');
    });

    it('should throw error when password is missing', () => {
      const invalidConfig: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: '',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow('DATABASE_PASSWORD is required');
    });

    it('should throw error with all validation errors', () => {
      const invalidConfig: DatabaseConfig = {
        host: '',
        port: 0,
        database: '',
        user: '',
        password: '',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow('Database configuration errors:');
    });
  });
});
