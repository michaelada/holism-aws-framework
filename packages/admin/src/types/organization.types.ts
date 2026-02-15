// Organization Management Types

export interface Capability {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: 'core-service' | 'additional-feature';
  isActive: boolean;
  createdAt: string;
}

export interface OrganizationType {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  currency: string;
  language: string;
  defaultLocale: string;
  defaultCapabilities: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  organizationCount?: number;
}

export interface Organization {
  id: string;
  organizationTypeId: string;
  keycloakGroupId: string;
  name: string;
  displayName: string;
  domain?: string;
  status: 'active' | 'inactive' | 'blocked';
  currency: string;
  language: string;
  enabledCapabilities: string[];
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  adminUserCount?: number;
  accountUserCount?: number;
}

export interface OrganizationUser {
  id: string;
  organizationId: string;
  keycloakUserId: string;
  userType: 'org-admin' | 'account-user';
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive' | 'blocked';
  roles?: string[]; // Array of role IDs
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface OrganizationAdminRole {
  id: string;
  organizationId: string;
  keycloakRoleId?: string;
  name: string;
  displayName: string;
  description?: string;
  capabilityPermissions: Record<string, 'admin' | 'write' | 'read'>;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
}

// DTOs
export interface CreateOrganizationTypeDto {
  name: string;
  displayName: string;
  description?: string;
  currency: string;
  language: string;
  defaultLocale?: string;
  defaultCapabilities: string[];
}

export interface UpdateOrganizationTypeDto {
  displayName?: string;
  description?: string;
  currency?: string;
  language?: string;
  defaultLocale?: string;
  defaultCapabilities?: string[];
  status?: 'active' | 'inactive';
}

export interface CreateOrganizationDto {
  organizationTypeId: string;
  name: string;
  displayName: string;
  domain?: string;
  enabledCapabilities: string[];
}

export interface UpdateOrganizationDto {
  displayName?: string;
  domain?: string;
  status?: 'active' | 'inactive' | 'blocked';
  enabledCapabilities?: string[];
  settings?: Record<string, any>;
}

export interface CreateOrganizationAdminUserDto {
  email: string;
  firstName: string;
  lastName: string;
  roleId?: string;
  temporaryPassword?: string;
}

export interface UpdateOrganizationUserDto {
  firstName?: string;
  lastName?: string;
  status?: 'active' | 'inactive' | 'blocked';
}

export interface CreateOrganizationAdminRoleDto {
  name: string;
  displayName: string;
  description?: string;
  capabilityPermissions: Record<string, 'admin' | 'write' | 'read'>;
}

export interface UpdateOrganizationAdminRoleDto {
  displayName?: string;
  description?: string;
  capabilityPermissions?: Record<string, 'admin' | 'write' | 'read'>;
}
