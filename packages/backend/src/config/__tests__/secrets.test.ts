import { SecretsManager } from '../secrets';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '../logger';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager');
jest.mock('../logger');

describe('SecretsManager', () => {
  let secretsManager: SecretsManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create new instance for each test
    secretsManager = new SecretsManager();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadSecrets', () => {
    describe('in development environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
        process.env.DATABASE_PASSWORD = 'dev_password';
        process.env.KEYCLOAK_CLIENT_SECRET = 'dev_keycloak_secret';
        process.env.JWT_SIGNING_KEY = 'dev_jwt_key';
        process.env.API_KEYS = 'key1:value1,key2:value2';
      });

      it('should load secrets from environment variables', async () => {
        const secrets = await secretsManager.loadSecrets();

        expect(secrets.databasePassword).toBe('dev_password');
        expect(secrets.keycloakClientSecret).toBe('dev_keycloak_secret');
        expect(secrets.jwtSigningKey).toBe('dev_jwt_key');
        expect(secrets.apiKeys).toEqual({
          key1: 'value1',
          key2: 'value2'
        });
      });

      it('should log that secrets were loaded from environment', async () => {
        await secretsManager.loadSecrets();

        expect(logger.info).toHaveBeenCalledWith('Secrets loaded from environment variables');
      });

      it('should return cached secrets on subsequent calls', async () => {
        const secrets1 = await secretsManager.loadSecrets();
        const secrets2 = await secretsManager.loadSecrets();

        expect(secrets1).toBe(secrets2);
      });
    });

    describe('in production environment with AWS Secrets Manager', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        process.env.AWS_SECRETS_ARN = 'arn:aws:secretsmanager:eu-west-1:123456789012:secret:my-secret';
        process.env.AWS_REGION = 'eu-west-1';

        // Mock AWS SDK response
        const mockSend = jest.fn().mockResolvedValue({
          SecretString: JSON.stringify({
            databasePassword: 'prod_password',
            keycloakClientSecret: 'prod_keycloak_secret',
            jwtSigningKey: 'prod_jwt_key',
            apiKeys: {
              key1: 'prod_value1'
            }
          })
        });

        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send: mockSend
        }));
      });

      it('should load secrets from AWS Secrets Manager', async () => {
        const secrets = await secretsManager.loadSecrets();

        expect(secrets.databasePassword).toBe('prod_password');
        expect(secrets.keycloakClientSecret).toBe('prod_keycloak_secret');
        expect(secrets.jwtSigningKey).toBe('prod_jwt_key');
        expect(secrets.apiKeys).toEqual({
          key1: 'prod_value1'
        });
      });

      it('should log that secrets were loaded from AWS with masked ARN', async () => {
        await secretsManager.loadSecrets();

        expect(logger.info).toHaveBeenCalledWith(
          'Secrets loaded from AWS Secrets Manager',
          expect.objectContaining({
            secretsArn: expect.stringContaining('****')
          })
        );
      });

      it('should call AWS SDK with correct parameters', async () => {
        const mockSend = jest.fn().mockResolvedValue({
          SecretString: JSON.stringify({
            databasePassword: 'prod_password'
          })
        });

        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send: mockSend
        }));

        await secretsManager.loadSecrets();

        expect(mockSend).toHaveBeenCalledWith(
          expect.any(GetSecretValueCommand)
        );
      });
    });

    describe('error handling', () => {
      it('should throw error if AWS Secrets Manager fails', async () => {
        process.env.NODE_ENV = 'production';
        process.env.AWS_SECRETS_ARN = 'arn:aws:secretsmanager:eu-west-1:123456789012:secret:my-secret';

        const mockSend = jest.fn().mockRejectedValue(new Error('AWS Error'));

        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send: mockSend
        }));

        await expect(secretsManager.loadSecrets()).rejects.toThrow('Failed to load secrets');
      });

      it('should log error when loading fails', async () => {
        process.env.NODE_ENV = 'production';
        process.env.AWS_SECRETS_ARN = 'arn:aws:secretsmanager:eu-west-1:123456789012:secret:my-secret';

        const mockSend = jest.fn().mockRejectedValue(new Error('AWS Error'));

        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send: mockSend
        }));

        await expect(secretsManager.loadSecrets()).rejects.toThrow();

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to load secrets',
          expect.any(Object)
        );
      });

      it('should fallback to environment variables if AWS is not configured', async () => {
        process.env.NODE_ENV = 'production';
        process.env.DATABASE_PASSWORD = 'fallback_password';
        // No AWS_SECRETS_ARN set

        const secrets = await secretsManager.loadSecrets();

        expect(secrets.databasePassword).toBe('fallback_password');
        expect(logger.warn).toHaveBeenCalledWith(
          'AWS Secrets Manager not configured, falling back to environment variables'
        );
      });
    });
  });

  describe('getSecret', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_PASSWORD = 'test_password';
    });

    it('should return a specific secret by key', async () => {
      await secretsManager.loadSecrets();
      const secret = await secretsManager.getSecret('databasePassword');

      expect(secret).toBe('test_password');
    });

    it('should throw error if secret key does not exist', async () => {
      await secretsManager.loadSecrets();

      await expect(secretsManager.getSecret('nonexistent')).rejects.toThrow(
        "Secret 'nonexistent' not found"
      );
    });

    it('should load secrets automatically if not initialized', async () => {
      const secret = await secretsManager.getSecret('databasePassword');

      expect(secret).toBe('test_password');
    });
  });

  describe('refreshSecrets', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_PASSWORD = 'initial_password';
    });

    it('should reload secrets when refreshed', async () => {
      await secretsManager.loadSecrets();
      const initialSecret = await secretsManager.getSecret('databasePassword');
      expect(initialSecret).toBe('initial_password');

      // Change environment variable
      process.env.DATABASE_PASSWORD = 'refreshed_password';

      await secretsManager.refreshSecrets();
      const refreshedSecret = await secretsManager.getSecret('databasePassword');

      expect(refreshedSecret).toBe('refreshed_password');
    });

    it('should log when secrets are refreshed', async () => {
      await secretsManager.loadSecrets();
      await secretsManager.refreshSecrets();

      expect(logger.info).toHaveBeenCalledWith('Secrets refreshed');
    });
  });

  describe('getAllSecrets', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_PASSWORD = 'test_password';
    });

    it('should return all secrets', async () => {
      await secretsManager.loadSecrets();
      const allSecrets = secretsManager.getAllSecrets();

      expect(allSecrets).toHaveProperty('databasePassword');
      expect(allSecrets.databasePassword).toBe('test_password');
    });

    it('should throw error if secrets not initialized', () => {
      expect(() => secretsManager.getAllSecrets()).toThrow(
        'Secrets not initialized. Call loadSecrets() first.'
      );
    });

    it('should return a copy of secrets, not the original', async () => {
      await secretsManager.loadSecrets();
      const secrets1 = secretsManager.getAllSecrets();
      const secrets2 = secretsManager.getAllSecrets();

      expect(secrets1).not.toBe(secrets2);
      expect(secrets1).toEqual(secrets2);
    });
  });

  describe('secret sanitization in logs', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_PASSWORD = 'secret_password_123';
    });

    it('should not log actual secret values', async () => {
      await secretsManager.loadSecrets();

      // Check that logger was not called with the actual password
      const loggerCalls = (logger.info as jest.Mock).mock.calls;
      const allLoggedData = loggerCalls.flat().join(' ');

      expect(allLoggedData).not.toContain('secret_password_123');
    });

    it('should mask ARN in logs', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AWS_SECRETS_ARN = 'arn:aws:secretsmanager:eu-west-1:123456789012:secret:my-secret-AbCdEf';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          databasePassword: 'prod_password'
        })
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend
      }));

      await secretsManager.loadSecrets();

      expect(logger.info).toHaveBeenCalledWith(
        'Secrets loaded from AWS Secrets Manager',
        expect.objectContaining({
          secretsArn: '****CdEf'
        })
      );
    });

    it('should sanitize errors to prevent secret leakage', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AWS_SECRETS_ARN = 'arn:aws:secretsmanager:eu-west-1:123456789012:secret:my-secret';

      const errorWithSecret = new Error('Failed to connect with password: secret_password_123');
      const mockSend = jest.fn().mockRejectedValue(errorWithSecret);

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend
      }));

      await expect(secretsManager.loadSecrets()).rejects.toThrow();

      // Verify that the error was logged but sanitized
      expect(logger.error).toHaveBeenCalled();
      const errorLogCall = (logger.error as jest.Mock).mock.calls[0];
      
      // The error object should not contain stack trace
      expect(errorLogCall[1]).not.toHaveProperty('stack');
    });
  });

  describe('API key parsing', () => {
    it('should parse API keys from comma-separated string', async () => {
      process.env.NODE_ENV = 'development';
      process.env.API_KEYS = 'service1:key1,service2:key2,service3:key3';

      const secrets = await secretsManager.loadSecrets();

      expect(secrets.apiKeys).toEqual({
        service1: 'key1',
        service2: 'key2',
        service3: 'key3'
      });
    });

    it('should handle empty API keys string', async () => {
      process.env.NODE_ENV = 'development';
      process.env.API_KEYS = '';

      const secrets = await secretsManager.loadSecrets();

      expect(secrets.apiKeys).toEqual({});
    });

    it('should handle undefined API keys', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.API_KEYS;

      const secrets = await secretsManager.loadSecrets();

      expect(secrets.apiKeys).toEqual({});
    });

    it('should trim whitespace from keys and values', async () => {
      process.env.NODE_ENV = 'development';
      process.env.API_KEYS = ' service1 : key1 , service2 : key2 ';

      const secrets = await secretsManager.loadSecrets();

      expect(secrets.apiKeys).toEqual({
        service1: 'key1',
        service2: 'key2'
      });
    });

    it('should ignore malformed key-value pairs', async () => {
      process.env.NODE_ENV = 'development';
      process.env.API_KEYS = 'service1:key1,invalid,service2:key2';

      const secrets = await secretsManager.loadSecrets();

      expect(secrets.apiKeys).toEqual({
        service1: 'key1',
        service2: 'key2'
      });
    });
  });
});
