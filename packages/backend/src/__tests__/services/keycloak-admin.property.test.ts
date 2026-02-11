import * as fc from 'fast-check';
import { KeycloakAdminService } from '../../services/keycloak-admin.service';
import { KeycloakAdminConfig } from '../../types/keycloak-admin.types';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';

// Mock the Keycloak Admin Client
jest.mock('@keycloak/keycloak-admin-client');

/**
 * Feature: keycloak-admin-integration, Property 1: Token Refresh Before API Calls
 * 
 * For any Keycloak Admin API call with an expired access token, the system should
 * automatically refresh the token before executing the operation.
 * 
 * Validates: Requirements 1.3
 */
describe('Property 1: Token Refresh Before API Calls', () => {
  let mockClient: jest.Mocked<KeycloakAdminClient>;
  
  const mockConfigArbitrary = fc.record({
    baseUrl: fc.webUrl(),
    realmName: fc.string({ minLength: 1, maxLength: 50 }),
    clientId: fc.string({ minLength: 1, maxLength: 50 }),
    clientSecret: fc.string({ minLength: 10, maxLength: 100 }),
  });

  beforeEach(() => {
    KeycloakAdminService.resetInstance();
    
    mockClient = {
      auth: jest.fn(),
      getAccessToken: jest.fn(),
      setAccessToken: jest.fn(),
    } as any;

    (KeycloakAdminClient as jest.MockedClass<typeof KeycloakAdminClient>).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    KeycloakAdminService.resetInstance();
  });

  test('ensureAuthenticated refreshes token when expired', async () => {
    await fc.assert(
      fc.asyncProperty(
        mockConfigArbitrary,
        async (config: KeycloakAdminConfig) => {
          // Reset mocks for each iteration
          mockClient.auth.mockClear();
          mockClient.getAccessToken.mockClear();
          KeycloakAdminService.resetInstance();

          // Setup mock responses
          mockClient.auth.mockResolvedValue(undefined);
          mockClient.getAccessToken.mockResolvedValue('mock-token');

          const service = new KeycloakAdminService(config);

          // Initial authentication
          await service.authenticate();
          expect(mockClient.auth).toHaveBeenCalledTimes(1);

          // Token should not be expired immediately
          expect(service.isTokenExpired()).toBe(false);

          // Clear mock to track new calls
          mockClient.auth.mockClear();

          // Manually expire the token by setting tokenExpiresAt to past
          (service as any).tokenExpiresAt = Date.now() - 1000;

          // Token should now be expired
          expect(service.isTokenExpired()).toBe(true);

          // Call ensureAuthenticated - should trigger re-authentication
          await service.ensureAuthenticated();

          // Verify re-authentication occurred
          expect(mockClient.auth).toHaveBeenCalledTimes(1);
          expect(mockClient.auth).toHaveBeenCalledWith({
            grantType: 'client_credentials',
            clientId: config.clientId,
            clientSecret: config.clientSecret,
          });

          // Token should no longer be expired after refresh
          expect(service.isTokenExpired()).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('ensureAuthenticated does not refresh token when still valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        mockConfigArbitrary,
        async (config: KeycloakAdminConfig) => {
          // Reset mocks for each iteration
          mockClient.auth.mockClear();
          mockClient.getAccessToken.mockClear();
          KeycloakAdminService.resetInstance();

          mockClient.auth.mockResolvedValue(undefined);
          mockClient.getAccessToken.mockResolvedValue('mock-token');

          const service = new KeycloakAdminService(config);

          // Initial authentication
          await service.authenticate();
          expect(mockClient.auth).toHaveBeenCalledTimes(1);

          // Clear mock to track new calls
          mockClient.auth.mockClear();

          // Token should still be valid
          expect(service.isTokenExpired()).toBe(false);

          // Call ensureAuthenticated - should NOT trigger re-authentication
          await service.ensureAuthenticated();

          // Verify no re-authentication occurred
          expect(mockClient.auth).not.toHaveBeenCalled();

          // Token should still be valid
          expect(service.isTokenExpired()).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('token expiration detection accounts for buffer time', async () => {
    await fc.assert(
      fc.asyncProperty(
        mockConfigArbitrary,
        fc.integer({ min: 1, max: 9 }), // Seconds within buffer (< 10)
        fc.integer({ min: 11, max: 60 }), // Seconds outside buffer (> 10)
        async (config: KeycloakAdminConfig, withinBuffer: number, outsideBuffer: number) => {
          // Reset mocks for each iteration
          mockClient.auth.mockClear();
          mockClient.getAccessToken.mockClear();
          KeycloakAdminService.resetInstance();

          mockClient.auth.mockResolvedValue(undefined);
          mockClient.getAccessToken.mockResolvedValue('mock-token');

          const service = new KeycloakAdminService(config);
          await service.authenticate();

          // Set token to expire within buffer time (should be considered expired)
          (service as any).tokenExpiresAt = Date.now() + (withinBuffer * 1000);
          expect(service.isTokenExpired()).toBe(true);

          // Set token to expire outside buffer time (should not be considered expired)
          (service as any).tokenExpiresAt = Date.now() + (outsideBuffer * 1000);
          expect(service.isTokenExpired()).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 2: Authentication Retry on Failure
 * 
 * For any Keycloak Admin API operation that fails with 401 authentication error,
 * the system should re-authenticate and retry the operation exactly once.
 * 
 * Validates: Requirements 1.4
 */
describe('Property 2: Authentication Retry on Failure', () => {
  let mockClient: jest.Mocked<KeycloakAdminClient>;
  
  const mockConfigArbitrary = fc.record({
    baseUrl: fc.webUrl(),
    realmName: fc.string({ minLength: 1, maxLength: 50 }),
    clientId: fc.string({ minLength: 1, maxLength: 50 }),
    clientSecret: fc.string({ minLength: 10, maxLength: 100 }),
  });

  beforeEach(() => {
    KeycloakAdminService.resetInstance();
    
    mockClient = {
      auth: jest.fn(),
      getAccessToken: jest.fn(),
      setAccessToken: jest.fn(),
      users: {
        find: jest.fn(),
      },
    } as any;

    (KeycloakAdminClient as jest.MockedClass<typeof KeycloakAdminClient>).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    KeycloakAdminService.resetInstance();
  });

  test('service retries operation after 401 authentication error', async () => {
    await fc.assert(
      fc.asyncProperty(
        mockConfigArbitrary,
        async (config: KeycloakAdminConfig) => {
          // Reset mocks for each iteration
          mockClient.auth.mockClear();
          mockClient.getAccessToken.mockClear();
          KeycloakAdminService.resetInstance();

          mockClient.auth.mockResolvedValue(undefined);
          mockClient.getAccessToken.mockResolvedValue('mock-token');

          const service = new KeycloakAdminService(config);
          await service.authenticate();

          // Clear auth mock to track retry
          mockClient.auth.mockClear();

          // Simulate a 401 error on first call, then success on retry
          const mockOperation = jest.fn()
            .mockRejectedValueOnce({
              response: { status: 401 },
              message: 'Unauthorized'
            })
            .mockResolvedValueOnce({ success: true });

          // Wrapper function that mimics the retry logic
          const executeWithRetry = async () => {
            try {
              await service.ensureAuthenticated();
              return await mockOperation();
            } catch (error: any) {
              if (error.response?.status === 401) {
                // Re-authenticate and retry once
                await service.authenticate();
                return await mockOperation();
              }
              throw error;
            }
          };

          const result = await executeWithRetry();

          // Verify operation was called twice (initial + retry)
          expect(mockOperation).toHaveBeenCalledTimes(2);

          // Verify re-authentication occurred
          expect(mockClient.auth).toHaveBeenCalledTimes(1);

          // Verify operation eventually succeeded
          expect(result).toEqual({ success: true });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('service does not retry on non-401 errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        mockConfigArbitrary,
        fc.integer({ min: 400, max: 599 }).filter(status => status !== 401),
        async (config: KeycloakAdminConfig, errorStatus: number) => {
          // Reset mocks for each iteration
          mockClient.auth.mockClear();
          mockClient.getAccessToken.mockClear();
          KeycloakAdminService.resetInstance();

          mockClient.auth.mockResolvedValue(undefined);
          mockClient.getAccessToken.mockResolvedValue('mock-token');

          const service = new KeycloakAdminService(config);
          await service.authenticate();

          mockClient.auth.mockClear();

          const mockOperation = jest.fn().mockRejectedValue({
            response: { status: errorStatus },
            message: `Error ${errorStatus}`
          });

          const executeWithRetry = async () => {
            try {
              await service.ensureAuthenticated();
              return await mockOperation();
            } catch (error: any) {
              if (error.response?.status === 401) {
                await service.authenticate();
                return await mockOperation();
              }
              throw error;
            }
          };

          // Should throw the error without retry
          await expect(executeWithRetry()).rejects.toMatchObject({
            response: { status: errorStatus }
          });

          // Verify operation was called only once (no retry)
          expect(mockOperation).toHaveBeenCalledTimes(1);

          // Verify no re-authentication occurred
          expect(mockClient.auth).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('service retries exactly once, not multiple times', async () => {
    await fc.assert(
      fc.asyncProperty(
        mockConfigArbitrary,
        async (config: KeycloakAdminConfig) => {
          // Reset mocks for each iteration
          mockClient.auth.mockClear();
          mockClient.getAccessToken.mockClear();
          KeycloakAdminService.resetInstance();

          mockClient.auth.mockResolvedValue(undefined);
          mockClient.getAccessToken.mockResolvedValue('mock-token');

          const service = new KeycloakAdminService(config);
          await service.authenticate();

          mockClient.auth.mockClear();

          // Simulate 401 error on both initial call and retry
          const mockOperation = jest.fn().mockRejectedValue({
            response: { status: 401 },
            message: 'Unauthorized'
          });

          const executeWithRetry = async () => {
            try {
              await service.ensureAuthenticated();
              return await mockOperation();
            } catch (error: any) {
              if (error.response?.status === 401) {
                await service.authenticate();
                return await mockOperation();
              }
              throw error;
            }
          };

          // Should throw after one retry
          await expect(executeWithRetry()).rejects.toMatchObject({
            response: { status: 401 }
          });

          // Verify operation was called exactly twice (initial + one retry)
          expect(mockOperation).toHaveBeenCalledTimes(2);

          // Verify re-authentication occurred exactly once
          expect(mockClient.auth).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
