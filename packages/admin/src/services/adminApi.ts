import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Tenant,
  CreateTenantDto,
  UpdateTenantDto,
  User,
  CreateUserDto,
  UpdateUserDto,
  UserFilters,
  ResetPasswordDto,
  AssignRoleDto,
  Role,
  CreateRoleDto,
} from '../types/admin.types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface AdminApiConfig {
  baseURL: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
}

export class AdminApiService {
  private client: AxiosInstance;
  private getToken: () => string | null;
  private onUnauthorized?: () => void;

  constructor(config: AdminApiConfig) {
    this.getToken = config.getToken;
    this.onUnauthorized = config.onUnauthorized;

    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        return this.handleError(error);
      }
    );
  }

  private handleError(error: AxiosError): never {
    if (error.response) {
      const { status, data } = error.response;

      // Handle 401 Unauthorized
      if (status === 401) {
        this.onUnauthorized?.();
      }

      // Extract error information
      const errorData = data as any;
      throw new ApiError(
        status,
        errorData?.error?.code || errorData?.code || 'UNKNOWN_ERROR',
        errorData?.error?.message || errorData?.message || 'An error occurred',
        errorData?.error?.details || errorData?.details
      );
    } else if (error.request) {
      // Network error
      throw new NetworkError('Unable to connect to server. Please check your connection.');
    } else {
      throw new Error(error.message);
    }
  }

  // Tenant API Methods

  async createTenant(data: CreateTenantDto): Promise<Tenant> {
    const response = await this.client.post<Tenant>('/api/admin/tenants', data);
    return response.data;
  }

  async getTenants(): Promise<Tenant[]> {
    const response = await this.client.get<Tenant[]>('/api/admin/tenants');
    return response.data;
  }

  async getTenant(id: string): Promise<Tenant> {
    return this.getTenantById(id);
  }

  async getTenantById(id: string): Promise<Tenant> {
    const response = await this.client.get<Tenant>(`/api/admin/tenants/${id}`);
    return response.data;
  }

  async updateTenant(id: string, data: UpdateTenantDto): Promise<Tenant> {
    const response = await this.client.put<Tenant>(`/api/admin/tenants/${id}`, data);
    return response.data;
  }

  async deleteTenant(id: string): Promise<void> {
    await this.client.delete(`/api/admin/tenants/${id}`);
  }

  // User API Methods

  async createUser(data: CreateUserDto): Promise<User> {
    const response = await this.client.post<User>('/api/admin/users', data);
    return response.data;
  }

  async getUsers(filters?: UserFilters): Promise<User[]> {
    const response = await this.client.get<User[]>('/api/admin/users', {
      params: filters,
    });
    return response.data;
  }

  async getUserById(id: string): Promise<User> {
    const response = await this.client.get<User>(`/api/admin/users/${id}`);
    return response.data;
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const response = await this.client.put<User>(`/api/admin/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string): Promise<void> {
    await this.client.delete(`/api/admin/users/${id}`);
  }

  async resetPassword(id: string, data: ResetPasswordDto): Promise<void> {
    await this.client.post(`/api/admin/users/${id}/reset-password`, data);
  }

  async assignRole(userId: string, data: AssignRoleDto): Promise<void> {
    await this.client.post(`/api/admin/users/${userId}/roles`, data);
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.client.delete(`/api/admin/users/${userId}/roles/${roleId}`);
  }

  // Role API Methods

  async createRole(data: CreateRoleDto): Promise<Role> {
    const response = await this.client.post<Role>('/api/admin/roles', data);
    return response.data;
  }

  async getRoles(): Promise<Role[]> {
    const response = await this.client.get<Role[]>('/api/admin/roles');
    return response.data;
  }

  async deleteRole(id: string): Promise<void> {
    await this.client.delete(`/api/admin/roles/${id}`);
  }
}
