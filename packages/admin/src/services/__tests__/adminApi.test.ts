import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { AdminApiService, ApiError, NetworkError } from '../adminApi';
import type {
  CreateTenantDto,
  UpdateTenantDto,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  AssignRoleDto,
  CreateRoleDto,
} from '../../types/admin.types';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('AdminApiService', () => {
  let adminApi: AdminApiService;
  let mockGetToken: ReturnType<typeof vi.fn>;
  let mockOnUnauthorized: ReturnType<typeof vi.fn>;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock token getter
    mockGetToken = vi.fn(() => 'mock-token-123');
    mockOnUnauthorized = vi.fn();

    // Setup mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn((successHandler) => {
            // Store the request interceptor for testing
            mockAxiosInstance._requestInterceptor = successHandler;
            return 0;
          }),
        },
        response: {
          use: vi.fn((successHandler, errorHandler) => {
            // Store the response interceptor for testing
            mockAxiosInstance._responseInterceptor = { successHandler, errorHandler };
            return 0;
          }),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    // Create service instance
    adminApi = new AdminApiService({
      baseURL: 'http://localhost:3000',
      getToken: mockGetToken,
      onUnauthorized: mockOnUnauthorized,
    });
  });

  describe('Constructor and Interceptors', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3000',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should add authentication token to requests', () => {
      const config = { headers: {} as any };
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      expect(mockGetToken).toHaveBeenCalled();
      expect(result.headers.Authorization).toBe('Bearer mock-token-123');
    });

    it('should not add authorization header when token is null', () => {
      mockGetToken.mockReturnValue(null);
      const config = { headers: {} as any };
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 unauthorized errors', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };

      // Simulate the error interceptor being called
      const errorHandler = mockAxiosInstance._responseInterceptor.errorHandler;
      mockAxiosInstance.get.mockImplementation(() => {
        return Promise.reject(error).catch(errorHandler);
      });

      await expect(adminApi.getTenants()).rejects.toThrow(ApiError);
      expect(mockOnUnauthorized).toHaveBeenCalled();
    });

    it('should handle API errors with error details', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: [{ field: 'name', message: 'Required' }],
            },
          },
        },
      };

      // Simulate the error interceptor being called
      const errorHandler = mockAxiosInstance._responseInterceptor.errorHandler;
      mockAxiosInstance.get.mockImplementation(() => {
        return Promise.reject(error).catch(errorHandler);
      });

      try {
        await adminApi.getTenants();
        expect.fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const apiError = e as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe('VALIDATION_ERROR');
        expect(apiError.message).toBe('Invalid input');
        expect(apiError.details).toEqual([{ field: 'name', message: 'Required' }]);
      }
    });

    it('should handle network errors', async () => {
      const error = {
        request: {},
        message: 'Network Error',
      };

      // Simulate the error interceptor being called
      const errorHandler = mockAxiosInstance._responseInterceptor.errorHandler;
      mockAxiosInstance.get.mockImplementation(() => {
        return Promise.reject(error).catch(errorHandler);
      });

      await expect(adminApi.getTenants()).rejects.toThrow(NetworkError);
    });

    it('should handle generic errors', async () => {
      const error = new Error('Something went wrong');
      
      // Simulate the error interceptor being called
      const errorHandler = mockAxiosInstance._responseInterceptor.errorHandler;
      mockAxiosInstance.get.mockImplementation(() => {
        return Promise.reject(error).catch(errorHandler);
      });

      await expect(adminApi.getTenants()).rejects.toThrow('Something went wrong');
    });
  });

  describe('Tenant API Methods', () => {
    it('should create tenant', async () => {
      const createData: CreateTenantDto = {
        name: 'test-tenant',
        displayName: 'Test Tenant',
        domain: 'test.com',
      };

      const mockResponse = {
        data: {
          id: '123',
          keycloakGroupId: 'kc-123',
          ...createData,
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adminApi.createTenant(createData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/admin/tenants', createData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should get all tenants', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            keycloakGroupId: 'kc-123',
            name: 'tenant1',
            displayName: 'Tenant 1',
            status: 'active',
            memberCount: 5,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await adminApi.getTenants();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/admin/tenants');
      expect(result).toEqual(mockResponse.data);
    });

    it('should get tenant by id', async () => {
      const mockResponse = {
        data: {
          id: '123',
          keycloakGroupId: 'kc-123',
          name: 'tenant1',
          displayName: 'Tenant 1',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await adminApi.getTenantById('123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/admin/tenants/123');
      expect(result).toEqual(mockResponse.data);
    });

    it('should update tenant', async () => {
      const updateData: UpdateTenantDto = {
        displayName: 'Updated Tenant',
        status: 'inactive',
      };

      const mockResponse = {
        data: {
          id: '123',
          keycloakGroupId: 'kc-123',
          name: 'tenant1',
          displayName: 'Updated Tenant',
          status: 'inactive',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await adminApi.updateTenant('123', updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/admin/tenants/123', updateData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should delete tenant', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: null });

      await adminApi.deleteTenant('123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/admin/tenants/123');
    });
  });

  describe('User API Methods', () => {
    it('should create user', async () => {
      const createData: CreateUserDto = {
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123',
        temporaryPassword: true,
        tenantId: 'tenant-123',
        roles: ['user'],
      };

      const mockResponse = {
        data: {
          id: '456',
          keycloakUserId: 'kc-456',
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          enabled: true,
          emailVerified: false,
          roles: ['user'],
          tenants: ['tenant-123'],
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adminApi.createUser(createData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/admin/users', createData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should get users with filters', async () => {
      const filters = {
        search: 'test',
        tenantId: 'tenant-123',
        limit: 10,
        offset: 0,
      };

      const mockResponse = {
        data: [
          {
            id: '456',
            keycloakUserId: 'kc-456',
            username: 'testuser',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            enabled: true,
            emailVerified: false,
            roles: ['user'],
            tenants: ['tenant-123'],
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await adminApi.getUsers(filters);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/admin/users', {
        params: filters,
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should get user by id', async () => {
      const mockResponse = {
        data: {
          id: '456',
          keycloakUserId: 'kc-456',
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          enabled: true,
          emailVerified: false,
          roles: ['user'],
          tenants: ['tenant-123'],
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await adminApi.getUserById('456');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/admin/users/456');
      expect(result).toEqual(mockResponse.data);
    });

    it('should update user', async () => {
      const updateData: UpdateUserDto = {
        email: 'newemail@example.com',
        enabled: false,
      };

      const mockResponse = {
        data: {
          id: '456',
          keycloakUserId: 'kc-456',
          username: 'testuser',
          email: 'newemail@example.com',
          firstName: 'Test',
          lastName: 'User',
          enabled: false,
          emailVerified: false,
          roles: ['user'],
          tenants: ['tenant-123'],
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await adminApi.updateUser('456', updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/admin/users/456', updateData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should delete user', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: null });

      await adminApi.deleteUser('456');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/admin/users/456');
    });

    it('should reset password', async () => {
      const resetData: ResetPasswordDto = {
        password: 'newpassword123',
        temporary: true,
      };

      mockAxiosInstance.post.mockResolvedValue({ data: null });

      await adminApi.resetPassword('456', resetData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/admin/users/456/reset-password',
        resetData
      );
    });

    it('should assign role to user', async () => {
      const roleData: AssignRoleDto = {
        roleName: 'admin',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: null });

      await adminApi.assignRole('456', roleData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/admin/users/456/roles', roleData);
    });

    it('should remove role from user', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: null });

      await adminApi.removeRole('456', 'role-789');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/admin/users/456/roles/role-789');
    });
  });

  describe('Role API Methods', () => {
    it('should create role', async () => {
      const createData: CreateRoleDto = {
        name: 'custom-role',
        displayName: 'Custom Role',
        description: 'A custom role',
        permissions: ['read', 'write'],
      };

      const mockResponse = {
        data: {
          id: '789',
          keycloakRoleId: 'kc-789',
          name: 'custom-role',
          displayName: 'Custom Role',
          description: 'A custom role',
          permissions: ['read', 'write'],
          composite: false,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adminApi.createRole(createData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/admin/roles', createData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should get all roles', async () => {
      const mockResponse = {
        data: [
          {
            id: '789',
            keycloakRoleId: 'kc-789',
            name: 'admin',
            displayName: 'Administrator',
            description: 'Admin role',
            permissions: [],
            composite: false,
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await adminApi.getRoles();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/admin/roles');
      expect(result).toEqual(mockResponse.data);
    });

    it('should delete role', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: null });

      await adminApi.deleteRole('789');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/admin/roles/789');
    });
  });
});
