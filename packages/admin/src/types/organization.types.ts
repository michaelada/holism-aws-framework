// Organization Management Types

export type MembershipNumbering = 'internal' | 'external';
export type MembershipNumberUniqueness = 'organization_type' | 'organization';

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
  membershipNumbering: MembershipNumbering;
  membershipNumberUniqueness: MembershipNumberUniqueness;
  initialMembershipNumber: number;
  /** The shared logo, signed for display. Empty where the type has none. */
  logoUrl?: string;
  /** The stored key — tells "no logo" apart from "a logo we could not sign". */
  logoS3Key?: string;
  /** Whether organisations of this type may replace the shared logo. */
  allowLogoOverride: boolean;
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
  /** Short code addressing this organisation in the account-user application. */
  urlCode: string;
  domain?: string;
  contactName?: string;
  contactEmail?: string;
  contactMobile?: string;
  status: 'active' | 'inactive';
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
  paymentMethods?: any[]; // OrgPaymentMethodData[]
}

export interface OrganizationUser {
  id: string;
  organizationId: string;
  keycloakUserId: string;
  userType: 'org-admin' | 'account-user';
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive';
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
  membershipNumbering?: MembershipNumbering;
  membershipNumberUniqueness?: MembershipNumberUniqueness;
  initialMembershipNumber?: number;
  allowLogoOverride?: boolean;
}

export interface UpdateOrganizationTypeDto {
  name?: string;
  displayName?: string;
  description?: string;
  currency?: string;
  language?: string;
  defaultLocale?: string;
  defaultCapabilities?: string[];
  membershipNumbering?: MembershipNumbering;
  membershipNumberUniqueness?: MembershipNumberUniqueness;
  initialMembershipNumber?: number;
  allowLogoOverride?: boolean;
  status?: 'active' | 'inactive';
}

export interface CreateOrganizationDto {
  organizationTypeId: string;
  name: string;
  displayName: string;
  /** Optional — the backend derives one from the name when omitted. */
  urlCode?: string;
  domain?: string;
  contactName?: string;
  contactEmail?: string;
  contactMobile?: string;
  currency?: string;
  language?: string;
  enabledCapabilities: string[];
  enabledPaymentMethods?: string[];
  settings?: Record<string, any>;
}

export interface UpdateOrganizationDto {
  name?: string;
  displayName?: string;
  urlCode?: string;
  domain?: string;
  contactName?: string;
  contactEmail?: string;
  contactMobile?: string;
  status?: 'active' | 'inactive';
  currency?: string;
  language?: string;
  enabledCapabilities?: string[];
  enabledPaymentMethods?: string[];
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
  status?: 'active' | 'inactive';
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

/**
 * Card handling fees on an organisation type.
 *
 * Every organisation of the type inherits these; there is no per-organisation
 * override. See G5 in docs/ACCOUNT_USER_APP_WIREFRAMES.md.
 */
export interface PaymentFeeRates {
  /** Flat amount per card payment, in the organisation type's currency. */
  fixedFee: number;
  /** Percentage of the amount charged to the card. 1.5 means 1.5%. */
  percentageFee: number;
  /** Percentage applied to the handling fee. 0 means no tax element. */
  taxPercentage: number;
}

export interface OrganizationTypePaymentFee extends PaymentFeeRates {
  id: string | null;
  organizationTypeId: string;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodDisplayName: string;
  currency: string;
}

export interface CardPaymentMethodDefault extends PaymentFeeRates {
  paymentMethodId: string;
  name: string;
  displayName: string;
}

/**
 * The Stripe Connect application fee for one organisation and payment method.
 *
 * `applicationFeeFixed` / `applicationFeePercentage` are the values in force.
 * The `typeDefault*` pair is the organisation type's current value, carried
 * alongside so the UI can say whether this organisation has diverged from what
 * it was created with. Both pairs are nullable, and null means "the platform
 * takes the handling fee" — the arrangement before any of this was configurable.
 */
export interface OrganisationApplicationFee {
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodDisplayName: string;
  applicationFeeFixed: number | null;
  applicationFeePercentage: number | null;
  typeDefaultFixed: number | null;
  typeDefaultPercentage: number | null;
  /** `type-fallback` means this organisation has no row of its own yet. */
  source: 'organisation' | 'type-fallback';
}

export interface OrganisationApplicationFees {
  organisationId: string;
  organisationTypeId: string;
  organisationTypeName: string;
  currency: string;
  fees: OrganisationApplicationFee[];
}

export interface UrlCodeAvailability {
  available: boolean;
  reason?: string;
}
