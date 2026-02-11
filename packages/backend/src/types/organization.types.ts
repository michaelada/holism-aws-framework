/**
 * Organization Management Types
 */

// Permission levels for capabilities
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

// User types
export type UserType = 'org-admin' | 'account-user';

// Status types
export type OrganizationStatus = 'active' | 'inactive' | 'blocked';
export type UserStatus = 'active' | 'inactive';

// Capability category
export type CapabilityCategory = 'core-service' | 'additional-feature';

/**
 * Capability
 */
export interface Capability {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: CapabilityCategory;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateCapabilityDto {
  name: string;
  displayName: string;
  description?: string;
  category: CapabilityCategory;
}

/**
 * Organization Type
 */
export interface OrganizationType {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  currency: string;
  language: string;
  defaultCapabilities: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateOrganizationTypeDto {
  name: string;
  displayName: string;
  description?: string;
  currency: string;
  language: string;
  defaultCapabilities: string[];
}

export interface UpdateOrganizationTypeDto {
  displayName?: string;
  description?: string;
  currency?: string;
  language?: string;
  defaultCapabilities?: string[];
  status?: string;
}

/**
 * Organization
 */
export interface Organization {
  id: string;
  organizationTypeId: string;
  keycloakGroupId: string;
  name: string;
  displayName: string;
  domain?: string;
  status: OrganizationStatus;
  currency?: string;
  language?: string;
  enabledCapabilities: string[];
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  
  // Populated fields
  organizationType?: OrganizationType;
  adminUserCount?: number;
  accountUserCount?: number;
}

export interface CreateOrganizationDto {
  organizationTypeId: string;
  name: string;
  displayName: string;
  domain?: string;
  status?: OrganizationStatus;
  enabledCapabilities: string[];
  currency?: string;
  language?: string;
}

export interface UpdateOrganizationDto {
  displayName?: string;
  domain?: string;
  status?: OrganizationStatus;
  enabledCapabilities?: string[];
  currency?: string;
  language?: string;
  settings?: Record<string, any>;
}

/**
 * Organization User
 */
export interface OrganizationUser {
  id: string;
  organizationId: string;
  keycloakUserId: string;
  userType: UserType;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  
  // Populated fields
  roles?: OrganizationAdminRole[];
}

export interface CreateOrganizationUserDto {
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  temporaryPassword?: string;
  sendWelcomeEmail?: boolean;
}

export interface CreateOrganizationAdminUserDto extends CreateOrganizationUserDto {
  roleId: string;
  userType: 'org-admin';
}

export interface UpdateOrganizationUserDto {
  firstName?: string;
  lastName?: string;
  status?: UserStatus;
}

/**
 * Organization Admin Role
 */
export interface OrganizationAdminRole {
  id: string;
  organizationId: string;
  keycloakRoleId?: string;
  name: string;
  displayName: string;
  description?: string;
  capabilityPermissions: Record<string, PermissionLevel>;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationAdminRoleDto {
  name: string;
  displayName: string;
  description?: string;
  capabilityPermissions: Record<string, PermissionLevel>;
}

export interface UpdateOrganizationAdminRoleDto {
  displayName?: string;
  description?: string;
  capabilityPermissions?: Record<string, PermissionLevel>;
}

/**
 * Organization User Role Assignment
 */
export interface OrganizationUserRole {
  id: string;
  organizationUserId: string;
  organizationAdminRoleId: string;
  assignedAt: Date;
  assignedBy?: string;
}

export interface AssignRoleDto {
  roleId: string;
}

/**
 * Organization Audit Log
 */
export interface OrganizationAuditLog {
  id: string;
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, any>;
  createdAt: Date;
}

export interface CreateAuditLogDto {
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, any>;
}

/**
 * Statistics
 */
export interface OrganizationStats {
  adminUserCount: number;
  accountUserCount: number;
  activeEvents?: number;
  totalRevenue?: number;
}
