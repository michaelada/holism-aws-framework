import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useAuth } from '../useAuth';
import axios from 'axios';
import Keycloak from 'keycloak-js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock Keycloak
vi.mock('keycloak-js');
const MockedKeycloak = vi.mocked(Keycloak);

describe('useAuth', () => {
  const mockKeycloakConfig = {
    url: 'http://localhost:8080',
    realm: 'test-realm',
    clientId: 'orgadmin-client',
  };

  const mockOrganisation = {
    id: 'org-123',
    organizationTypeId: 'type-456',
    keycloakGroupId: 'group-789',
    name: 'test-org',
    displayName: 'Test Organisation',
    status: 'active' as const,
    currency: 'USD',
    language: 'en',
    enabledCapabilities: ['event-management', 'memberships'],
    settings: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };

  const mockUserData = {
    user: {
      id: 'user-123',
      email: 'admin@test.com',
      firstName: 'Test',
      lastName: 'Admin',
      userName: 'testadmin',
    },
    organisation: mockOrganisation,
    capabilities: ['event-management', 'memberships'],
  };

  let mockKeycloakInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    import.meta.env.VITE_DISABLE_AUTH = 'false';
    import.meta.env.VITE_API_BASE_URL = 'http://localhost:3000';

    // Create mock Keycloak instance
    mockKeycloakInstance = {
      init: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      updateToken: vi.fn(),
      token: 'mock-token-123',
      authenticated: true,
    };

    MockedKeycloak.mockReturnValue(mockKeycloakInstance as any);
    
    // Clear any timers
    vi.clearAllTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Authentication with Keycloak disabled', () => {
    it('should use development mode when auth is disabled', async () => {
      import.meta.env.VITE_DISABLE_AUTH = 'true';

      const { result } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.authenticated).toBe(true);
      expect(result.current.user).toEqual({
        id: 'dev-user-1',
        email: 'dev@example.com',
        firstName: 'Dev',
        lastName: 'Admin',
        userName: 'dev-admin',
      });
      expect(result.current.organisation).toBeDefined();
      expect(result.current.organisation?.displayName).toBe('Athlone Swimming Club');
      expect(result.current.capabilities).toEqual(['event-management', 'memberships']);
      expect(result.current.isOrgAdmin).toBe(true);
      expect(MockedKeycloak).not.toHaveBeenCalled();
    });
  });

  describe('Keycloak initialization', () => {
    it('should initialize Keycloak with correct config', async () => {
      mockKeycloakInstance.init.mockResolvedValueOnce(true);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(MockedKeycloak).toHaveBeenCalledWith({
          url: mockKeycloakConfig.url,
          realm: mockKeycloakConfig.realm,
          clientId: mockKeycloakConfig.clientId,
        });
      });

      expect(mockKeycloakInstance.init).toHaveBeenCalledWith({
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        enableLogging: true,
      });
    });

    it('should handle successful authentication', async () => {
      mockKeycloakInstance.init.mockResolvedValueOnce(true);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { result } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.authenticated).toBe(true);
      expect(result.current.user).toEqual(mockUserData.user);
      expect(result.current.organisation).toEqual(mockOrganisation);
      expect(result.current.capabilities).toEqual(['event-management', 'memberships']);
      expect(result.current.isOrgAdmin).toBe(true);
      expect(result.current.token).toBe('mock-token-123');
      expect(result.current.error).toBeNull();
    });

    it('should handle failed authentication', async () => {
      mockKeycloakInstance.init.mockResolvedValueOnce(false);

      const { result } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.authenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.organisation).toBeNull();
      expect(result.current.isOrgAdmin).toBe(false);
    });

    it('should handle Keycloak initialization error', async () => {
      const errorMessage = 'Keycloak init failed';
      mockKeycloakInstance.init.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.authenticated).toBe(false);
    });
  });

  describe('Organisation fetching', () => {
    it('should fetch organisation data after authentication', async () => {
      mockKeycloakInstance.init.mockResolvedValueOnce(true);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/orgadmin/auth/me', {
          baseURL: 'http://localhost:3000',
          headers: {
            Authorization: 'Bearer mock-token-123',
          },
          withCredentials: true,
        });
      });
    });

    it('should handle organisation fetch error', async () => {
      mockKeycloakInstance.init.mockResolvedValueOnce(true);
      mockedAxios.get.mockRejectedValueOnce(new Error('Failed to load organisation'));

      const { result } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load organisation data');
      expect(result.current.isOrgAdmin).toBe(false);
      expect(result.current.organisation).toBeNull();
    });

    it('should set isOrgAdmin to true when organisation is loaded', async () => {
      mockKeycloakInstance.init.mockResolvedValueOnce(true);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { result } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.isOrgAdmin).toBe(true);
      });
    });

    it('should use organisation capabilities if API capabilities are not provided', async () => {
      mockKeycloakInstance.init.mockResolvedValueOnce(true);
      const dataWithoutCaps = {
        user: mockUserData.user,
        organisation: mockOrganisation,
      };
      mockedAxios.get.mockResolvedValueOnce({ data: dataWithoutCaps });

      const { result } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.capabilities).toEqual(mockOrganisation.enabledCapabilities);
      });
    });
  });

  describe.sequential('Token management', () => {
    it('should provide current token', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.token).toBe('mock-token-123');
      unmount();
    });

    it('should return token via getToken method', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.getToken()).toBe('mock-token-123');
      unmount();
    });

    it('should return null when no token is available', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(false),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: null,
        authenticated: false,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.getToken()).toBeNull();
      unmount();
    });

    it('should setup token refresh interval', async () => {
      vi.useFakeTimers();
      
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn().mockResolvedValue(true),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      // Wait for init to complete
      await vi.waitFor(() => {
        expect(freshMockKeycloak.init).toHaveBeenCalled();
      }, { timeout: 1000 });

      // Fast-forward time by 60 seconds
      await vi.advanceTimersByTimeAsync(60000);

      // Check if updateToken was called
      expect(freshMockKeycloak.updateToken).toHaveBeenCalledWith(70);

      unmount();
      vi.useRealTimers();
    });
  });

  describe.sequential('Login and Logout', () => {
    it('should call keycloak login method', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      result.current.login();

      expect(freshMockKeycloak.login).toHaveBeenCalled();
      unmount();
    });

    it('should call keycloak logout method', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      result.current.logout();

      expect(freshMockKeycloak.logout).toHaveBeenCalled();
      unmount();
    });

    it('should handle login when keycloak is not initialized', async () => {
      import.meta.env.VITE_DISABLE_AUTH = 'true';

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      // Should not throw error
      expect(() => result.current.login()).not.toThrow();
      
      unmount();
      // Reset for next test
      import.meta.env.VITE_DISABLE_AUTH = 'false';
    });

    it('should handle logout when keycloak is not initialized', async () => {
      import.meta.env.VITE_DISABLE_AUTH = 'true';

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      // Should not throw error
      expect(() => result.current.logout()).not.toThrow();
      
      unmount();
      // Reset for next test
      import.meta.env.VITE_DISABLE_AUTH = 'false';
    });
  });

  describe.sequential('Loading states', () => {
    it('should start with loading true', () => {
      const freshMockKeycloak = {
        init: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      expect(result.current.loading).toBe(true);
      unmount();
    });

    it('should set loading to false after successful init', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });
      
      unmount();
    });

    it('should set loading to false after failed init', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockRejectedValueOnce(new Error('Init failed')),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });
      
      unmount();
    });
  });

  describe.sequential('User data', () => {
    it('should provide complete user information', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.user).toEqual({
        id: 'user-123',
        email: 'admin@test.com',
        firstName: 'Test',
        lastName: 'Admin',
        userName: 'testadmin',
      });
      
      unmount();
    });

    it('should use email as userName if userName is not provided', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      const dataWithoutUserName = {
        ...mockUserData,
        user: {
          ...mockUserData.user,
          userName: undefined,
        },
      };
      mockedAxios.get.mockResolvedValueOnce({ data: dataWithoutUserName });

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.user?.userName).toBe('admin@test.com');
      
      unmount();
    });
  });

  describe.sequential('Error handling', () => {
    it('should handle generic errors', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      mockedAxios.get.mockRejectedValueOnce('Network error');

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.error).toBe('Failed to load organisation data');
      
      unmount();
    });

    it('should clear error on successful authentication', async () => {
      const freshMockKeycloak = {
        init: vi.fn().mockResolvedValueOnce(true),
        login: vi.fn(),
        logout: vi.fn(),
        updateToken: vi.fn(),
        token: 'mock-token-123',
        authenticated: true,
      };
      MockedKeycloak.mockReturnValueOnce(freshMockKeycloak as any);
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserData });

      const { result, unmount } = renderHook(() => useAuth(mockKeycloakConfig));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.error).toBeNull();
      
      unmount();
    });
  });
});
