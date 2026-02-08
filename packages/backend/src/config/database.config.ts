import { config } from 'dotenv';
import { secretsManager } from './secrets';

// Load environment variables
config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number; // Maximum number of clients in the pool
  idleTimeoutMillis: number; // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: number; // How long to wait when connecting a new client
}

/**
 * Get database configuration based on environment
 * Supports loading password from secrets manager
 */
export async function getDatabaseConfig(): Promise<DatabaseConfig> {
  const env = process.env.NODE_ENV || 'development';

  // Try to get password from secrets manager, fallback to environment variable
  let password = process.env.DATABASE_PASSWORD || 'framework_password';
  try {
    const secretPassword = await secretsManager.getSecret('databasePassword');
    if (secretPassword) {
      password = secretPassword;
    }
  } catch (error) {
    // If secrets manager fails, use environment variable
    // This is expected in local development
  }

  // Base configuration from environment variables
  const baseConfig: DatabaseConfig = {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'aws_framework',
    user: process.env.DATABASE_USER || 'framework_user',
    password,
    max: 20, // Default pool size
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 2000, // 2 seconds
  };

  // Environment-specific overrides
  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        max: 50, // Larger pool for production
        idleTimeoutMillis: 60000, // 60 seconds
        connectionTimeoutMillis: 5000, // 5 seconds
      };

    case 'staging':
      return {
        ...baseConfig,
        max: 30, // Medium pool for staging
        idleTimeoutMillis: 45000, // 45 seconds
        connectionTimeoutMillis: 3000, // 3 seconds
      };

    case 'test':
      return {
        ...baseConfig,
        database: process.env.DATABASE_NAME || 'aws_framework_test',
        max: 5, // Small pool for testing
        idleTimeoutMillis: 10000, // 10 seconds
        connectionTimeoutMillis: 1000, // 1 second
      };

    case 'development':
    default:
      return baseConfig;
  }
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  const errors: string[] = [];

  if (!config.host) {
    errors.push('DATABASE_HOST is required');
  }

  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('DATABASE_PORT must be a valid port number (1-65535)');
  }

  if (!config.database) {
    errors.push('DATABASE_NAME is required');
  }

  if (!config.user) {
    errors.push('DATABASE_USER is required');
  }

  if (!config.password) {
    errors.push('DATABASE_PASSWORD is required');
  }

  if (errors.length > 0) {
    throw new Error(`Database configuration errors:\n${errors.join('\n')}`);
  }
}
