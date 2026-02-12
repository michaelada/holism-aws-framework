import { KeycloakAdminService } from '../../services/keycloak-admin.service';
import { KeycloakAdminConfig } from '../../types/keycloak-admin.types';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';

// Mock the Keycloak Admin Client
jest.mock('@keycloak/keycloak-admin-client');

// Mock fetch globally
global.fetch = jest.fn();

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
    
    // Mock fetch to return successful authentication
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'mock-token',
        expires_in: 300,
      }),
    });
    
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
      await service.authenticate();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/realms/${mockConfig.realmName}/protocol/openid-connect/token`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
      expect(mockClient.setAccessToken).toHaveBeenCalledWith('mock-token');
    });

    it('should set token expiration time after authentication', async () => {
      await service.authenticate();

      // Token should not be expired immediately after authentication
      expect(service.isTokenExpired()).toBe(false);
    });

    it('should throw error if authentication fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Authentication failed',
      });

      await expect(service.authenticate()).rejects.toThrow(
        'Keycloak authentication failed: HTTP 401: Authentication failed'
      );
    });

    it('should handle authentication errors with non-Error objects', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce('String error');

      await expect(service.authenticate()).rejects.toThrow(
        'Keycloak authentication failed: String error'
      );
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', async () => {
      await service.authenticate();
      
      expect(service.isTokenExpired()).toBe(false);
    });

    it('should return true for expired token', async () => {
      await service.authenticate();
      
      // Manually set token expiration to past
      (service as any).tokenExpiresAt = Date.now() - 1000;
      
      expect(service.isTokenExpired()).toBe(true);
    });

    it('should return true for token expiring within buffer time', async () => {
      await service.authenticate();
      
      // Set token to expire in 5 seconds (within 10 second buffer)
      (service as any).tokenExpiresAt = Date.now() + 5000;
      
      expect(service.isTokenExpired()).toBe(true);
    });

    it('should return false for token expiring outside buffer time', async () => {
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
      await service.authenticate();
      const fetchCallCount = (global.fetch as jest.Mock).mock.calls.length;

      await service.ensureAuthenticated();

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallCount);
    });

    it('should re-authenticate if token is expired', async () => {
      await service.authenticate();
      
      // Expire the token
      (service as any).tokenExpiresAt = Date.now() - 1000;
      
      const fetchCallCount = (global.fetch as jest.Mock).mock.calls.length;
      await service.ensureAuthenticated();

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallCount + 1);
    });

    it('should authenticate if never authenticated before', async () => {
      await service.ensureAuthenticated();

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw error if re-authentication fails', async () => {
      await service.authenticate();
      
      // Expire the token
      (service as any).tokenExpiresAt = Date.now() - 1000;
      
      // Make re-authentication fail
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Re-auth failed',
      });

      await expect(service.ensureAuthenticated()).rejects.toThrow(
        'Keycloak authentication failed: HTTP 401: Re-auth failed'
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
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: null,
          expires_in: 300,
        }),
      });

      await service.authenticate();
      
      // Should still work, just won't have accurate expiration
      expect(service.isTokenExpired()).toBe(false);
    });

    it('should handle undefined token from getAccessToken', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          expires_in: 300,
        }),
      });

      await service.authenticate();
      
      // Should still work, just won't have accurate expiration
      expect(service.isTokenExpired()).toBe(false);
    });
  });
});
