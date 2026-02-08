import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger, sanitizeLogData } from './logger';

/**
 * Interface for secret values stored in AWS Secrets Manager or environment variables
 */
export interface SecretValues {
  databasePassword?: string;
  keycloakClientSecret?: string;
  jwtSigningKey?: string;
  apiKeys?: Record<string, string>;
  [key: string]: any;
}

/**
 * SecretsManager class for loading secrets from AWS Secrets Manager or environment variables
 * Supports local development with environment variables and production with AWS Secrets Manager
 */
export class SecretsManager {
  private client: SecretsManagerClient | null = null;
  private secrets: SecretValues = {};
  private isInitialized = false;

  constructor() {}

  /**
   * Initialize AWS client if needed
   * @private
   */
  private initializeClient(): void {
    const environment = process.env.NODE_ENV || 'development';
    const secretsArn = process.env.AWS_SECRETS_ARN;
    const region = process.env.AWS_REGION || 'eu-west-1';

    // Only initialize AWS client for non-local environments
    if (environment !== 'development' && secretsArn && !this.client) {
      this.client = new SecretsManagerClient({ region });
    }
  }

  /**
   * Load secrets from AWS Secrets Manager or environment variables
   * @returns Promise<SecretValues> The loaded secrets
   */
  async loadSecrets(): Promise<SecretValues> {
    if (this.isInitialized) {
      return this.secrets;
    }

    const environment = process.env.NODE_ENV || 'development';
    const secretsArn = process.env.AWS_SECRETS_ARN;

    try {
      if (environment === 'development') {
        // Load from environment variables for local development
        this.secrets = this.loadFromEnvironment();
        logger.info('Secrets loaded from environment variables');
      } else if (secretsArn) {
        // Initialize client if needed
        this.initializeClient();
        
        if (this.client) {
          // Load from AWS Secrets Manager for staging/production
          this.secrets = await this.loadFromAWS(secretsArn);
          logger.info('Secrets loaded from AWS Secrets Manager', {
            secretsArn: this.maskArn(secretsArn)
          });
        } else {
          // Fallback to environment variables if AWS client failed to initialize
          logger.warn('AWS Secrets Manager not configured, falling back to environment variables');
          this.secrets = this.loadFromEnvironment();
        }
      } else {
        // Fallback to environment variables if AWS is not configured
        logger.warn('AWS Secrets Manager not configured, falling back to environment variables');
        this.secrets = this.loadFromEnvironment();
      }

      this.isInitialized = true;
      return this.secrets;
    } catch (error) {
      logger.error('Failed to load secrets', { error: this.sanitizeError(error) });
      throw new Error('Failed to load secrets');
    }
  }

  /**
   * Get a specific secret by key
   * @param key The secret key to retrieve
   * @returns Promise<string> The secret value
   */
  async getSecret(key: string): Promise<string> {
    if (!this.isInitialized) {
      await this.loadSecrets();
    }

    const value = this.secrets[key];
    if (value === undefined) {
      throw new Error(`Secret '${key}' not found`);
    }

    return value;
  }

  /**
   * Refresh secrets (for rotation support)
   * @returns Promise<void>
   */
  async refreshSecrets(): Promise<void> {
    this.isInitialized = false;
    await this.loadSecrets();
    logger.info('Secrets refreshed');
  }

  /**
   * Load secrets from environment variables (for local development)
   * @private
   */
  private loadFromEnvironment(): SecretValues {
    return {
      databasePassword: process.env.DATABASE_PASSWORD,
      keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      jwtSigningKey: process.env.JWT_SIGNING_KEY,
      apiKeys: this.parseApiKeys(process.env.API_KEYS)
    };
  }

  /**
   * Load secrets from AWS Secrets Manager
   * @private
   */
  private async loadFromAWS(secretsArn: string): Promise<SecretValues> {
    if (!this.client) {
      throw new Error('AWS Secrets Manager client not initialized');
    }

    const command = new GetSecretValueCommand({
      SecretId: secretsArn
    });

    const response = await this.client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    // Parse the JSON secret string
    const secretData = JSON.parse(response.SecretString);

    return {
      databasePassword: secretData.databasePassword,
      keycloakClientSecret: secretData.keycloakClientSecret,
      jwtSigningKey: secretData.jwtSigningKey,
      apiKeys: secretData.apiKeys || {}
    };
  }

  /**
   * Parse API keys from environment variable string
   * Expected format: "key1:value1,key2:value2"
   * @private
   */
  private parseApiKeys(apiKeysString?: string): Record<string, string> {
    if (!apiKeysString) {
      return {};
    }

    const apiKeys: Record<string, string> = {};
    const pairs = apiKeysString.split(',');

    for (const pair of pairs) {
      const [key, value] = pair.split(':');
      if (key && value) {
        apiKeys[key.trim()] = value.trim();
      }
    }

    return apiKeys;
  }

  /**
   * Mask ARN for logging (show only last 4 characters)
   * @private
   */
  private maskArn(arn: string): string {
    if (arn.length <= 4) {
      return '****';
    }
    return '****' + arn.slice(-4);
  }

  /**
   * Sanitize error for logging (remove sensitive information)
   * @private
   */
  private sanitizeError(error: any): any {
    if (error instanceof Error) {
      return sanitizeLogData({
        message: error.message,
        name: error.name
        // Intentionally exclude stack trace to avoid leaking secrets
      });
    }
    return { message: 'Unknown error' };
  }

  /**
   * Get all secrets (use with caution - for testing only)
   * @returns SecretValues
   */
  getAllSecrets(): SecretValues {
    if (!this.isInitialized) {
      throw new Error('Secrets not initialized. Call loadSecrets() first.');
    }
    return { ...this.secrets };
  }
}

// Export singleton instance
export const secretsManager = new SecretsManager();
