// Admin API Types

/**
 * What a person is on the platform, as opposed to the individual realm and
 * organisation roles they hold. Not mutually exclusive — the same person can
 * administer one club and be a member of another.
 */
export type UserClassification = 'super-admin' | 'org-admin' | 'account';

/** How each classification is labelled and coloured in the user list. */
export const USER_CLASSIFICATION_LABELS: Record<UserClassification, string> = {
  'super-admin': 'Super Admin',
  'org-admin': 'Org-admin',
  account: 'Account',
};

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
  /** Broad categories derived from the roles and organisation membership. */
  classifications: UserClassification[];
  /** Organisations this user belongs to, resolved from their Keycloak groups. */
  organizations: string[];
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
  organizationId?: string;
  roles?: string[];
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  phoneNumber?: string;
  department?: string;
  organizationId?: string;
  roles?: string[];
}

export interface UserFilters {
  search?: string;
  email?: string;
  organizationId?: string;
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

// Organization Types
export interface Organization {
  id: string;
  organizationTypeId: string;
  name: string;
  displayName: string;
  domain?: string;
  contactName?: string;
  contactEmail?: string;
  contactMobile?: string;
  status: 'active' | 'inactive';
  enabledCapabilities?: string[];
  currency?: string;
  language?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}
