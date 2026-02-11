// Admin API Types

// Tenant Types
export interface Tenant {
  id: string;
  keycloakGroupId: string;
  name: string;
  displayName: string;
  domain?: string;
  status: string;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantDto {
  name: string;
  displayName: string;
  domain?: string;
}

export interface UpdateTenantDto {
  name?: string;
  displayName?: string;
  domain?: string;
  status?: string;
}

// User Types
export interface User {
  id: string;
  keycloakUserId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  emailVerified: boolean;
  roles: string[];
  tenants: string[];
  phoneNumber?: string;
  department?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  temporaryPassword?: boolean;
  emailVerified?: boolean;
  phoneNumber?: string;
  department?: string;
  tenantId?: string;
  roles?: string[];
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  phoneNumber?: string;
  department?: string;
  tenantId?: string;
  roles?: string[];
}

export interface UserFilters {
  search?: string;
  email?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

export interface ResetPasswordDto {
  password: string;
  temporary: boolean;
}

export interface AssignRoleDto {
  roleName: string;
}

// Role Types
export interface Role {
  id: string;
  keycloakRoleId?: string;
  name: string;
  displayName: string;
  description?: string;
  permissions?: string[];
  composite: boolean;
}

export interface CreateRoleDto {
  name: string;
  displayName: string;
  description?: string;
  permissions?: string[];
}
