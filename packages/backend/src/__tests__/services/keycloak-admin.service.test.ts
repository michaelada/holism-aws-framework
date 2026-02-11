import { KeycloakAdminService } from '../../services/keycloak-admin.service';
import { KeycloakAdminConfig } from '../../types/keycloak-admin.types';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';

// Mock the Keycloak Admin Client
jest.mock('@keycloak/keycloak-admin-client');

describe('KeycloakAdminService', () => {
  let service: KeycloakAdminService;
  let mockClient: jest.Mocked<KeycloakAdminClient>;
  
  const mockConfig: KeycloakAdminConfig = {
    baseUrl: 'http://localhost:8080',
    realmName: 'test-realm',
    clientId: 'admin-cli',
    clientSecret: 'test-secret',
  };

  beforeEach(() => {
    // Reset singleton instance before each test
    KeycloakAdminService.resetInstance();
    
    // Create mock client
    mockClient = {
      auth: jest.fn(),
      getAccessToken: jest.fn(),
      setAccessToken: jest.fn(),
    } as any;

    // Mock the constructor to return our mock client
    (KeycloakAdminClient as jest.MockedClass<typeof KeycloakAdminClient>).mockImplementation(() => mockClient);
    
    service = new KeycloakAdminService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    KeycloakAdminService.resetInstance();
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      expect(service).toBeDefined();
      expect(KeycloakAdminClient).toHaveBeenCalledWith({
        baseUrl: mockConfig.baseUrl,
        realmName: mockConfig.realmName,
      });
    });

    it('should create client with correct base URL and realm', () => {
      const customConfig: KeycloakAdminConfig = {
        baseUrl: 'https://keycloak.example.com',
        realmName: 'custom-realm',
        clientId: 'custom-client',
        clientSecret: 'custom-secret',
      };

      KeycloakAdminService.resetInstance();
      new KeycloakAdminService(customConfig);

      expect(KeycloakAdminClient).toHaveBeenCalledWith({
        baseUrl: customConfig.baseUrl,
        realmName: customConfig.realmName,
      });
    });
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      KeycloakAdminService.resetInstance();
      const instance1 = KeycloakAdminService.getInstance(mockConfig);
      const instance2 = KeycloakAdminService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should throw error if config not provided on first call', () => {
      KeycloakAdminService.resetInstance();
      expect(() => KeycloakAdminService.getInstance()).toThrow(
        'Configuration required for first initialization'
      );
    });

    it('should not require config on subsequent calls', () => {
      KeycloakAdminService.resetInstance();
      KeycloakAdminService.getInstance(mockConfig);
      
      expect(() => KeycloakAdminService.getInstance()).not.toThrow();
    });
  });

  describe('authenticate', () => {
    it('should authenticate with service account credentials', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.authenticate();

      expect(mockClient.auth).toHaveBeenCalledWith({
        grantType: 'client_credentials',
        clientId: mockConfig.clientId,
        clientSecret: mockConfig.clientSecret,
      });
    });

    it('should set token expiration time after authentication', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.authenticate();

      // Token should not be expired immediately after authentication
      expect(service.isTokenExpired()).toBe(false);
    });

    it('should throw error if authentication fails', async () => {
      const authError = new Error('Authentication failed');
      mockClient.auth.mockRejectedValue(authError);

      await expect(service.authenticate()).rejects.toThrow(
        'Keycloak authentication failed: Authentication failed'
      );
    });

    it('should handle authentication errors with non-Error objects', async () => {
      mockClient.auth.mockRejectedValue('String error');

      await expect(service.authenticate()).rejects.toThrow(
        'Keycloak authentication failed: String error'
      );
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.authenticate();
      
      expect(service.isTokenExpired()).toBe(false);
    });

    it('should return true for expired token', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.authenticate();
      
      // Manually set token expiration to past
      (service as any).tokenExpiresAt = Date.now() - 1000;
      
      expect(service.isTokenExpired()).toBe(true);
    });

    it('should return true for token expiring within buffer time', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.authenticate();
      
      // Set token to expire in 5 seconds (within 10 second buffer)
      (service as any).tokenExpiresAt = Date.now() + 5000;
      
      expect(service.isTokenExpired()).toBe(true);
    });

    it('should return false for token expiring outside buffer time', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.authenticate();
      
      // Set token to expire in 15 seconds (outside 10 second buffer)
      (service as any).tokenExpiresAt = Date.now() + 15000;
      
      expect(service.isTokenExpired()).toBe(false);
    });

    it('should return true if token never set', () => {
      // Don't authenticate, so tokenExpiresAt remains 0
      expect(service.isTokenExpired()).toBe(true);
    });
  });

  describe('ensureAuthenticated', () => {
    it('should not re-authenticate if token is valid', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.authenticate();
      mockClient.auth.mockClear();

      await service.ensureAuthenticated();

      expect(mockClient.auth).not.toHaveBeenCalled();
    });

    it('should re-authenticate if token is expired', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.authenticate();
      
      // Expire the token
      (service as any).tokenExpiresAt = Date.now() - 1000;
      
      mockClient.auth.mockClear();
      await service.ensureAuthenticated();

      expect(mockClient.auth).toHaveBeenCalledTimes(1);
    });

    it('should authenticate if never authenticated before', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.ensureAuthenticated();

      expect(mockClient.auth).toHaveBeenCalledTimes(1);
    });

    it('should throw error if re-authentication fails', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue('mock-token');

      await service.authenticate();
      
      // Expire the token
      (service as any).tokenExpiresAt = Date.now() - 1000;
      
      // Make re-authentication fail
      mockClient.auth.mockRejectedValue(new Error('Re-auth failed'));

      await expect(service.ensureAuthenticated()).rejects.toThrow(
        'Keycloak authentication failed: Re-auth failed'
      );
    });
  });

  describe('getClient', () => {
    it('should return the Keycloak Admin Client instance', () => {
      const client = service.getClient();
      
      expect(client).toBe(mockClient);
    });

    it('should return same client instance on multiple calls', () => {
      const client1 = service.getClient();
      const client2 = service.getClient();
      
      expect(client1).toBe(client2);
    });
  });

  describe('resetInstance', () => {
    it('should reset singleton instance', () => {
      KeycloakAdminService.resetInstance();
      const instance1 = KeycloakAdminService.getInstance(mockConfig);
      
      KeycloakAdminService.resetInstance();
      const instance2 = KeycloakAdminService.getInstance(mockConfig);
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('edge cases', () => {
    it('should handle null token from getAccessToken', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue(null as any);

      await service.authenticate();
      
      // Should still work, just won't have accurate expiration
      expect(service.isTokenExpired()).toBe(true);
    });

    it('should handle undefined token from getAccessToken', async () => {
      mockClient.auth.mockResolvedValue(undefined);
      mockClient.getAccessToken.mockResolvedValue(undefined);

      await service.authenticate();
      
      // Should still work, just won't have accurate expiration
      expect(service.isTokenExpired()).toBe(true);
    });
  });
});
