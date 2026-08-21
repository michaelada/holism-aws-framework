import axios, { AxiosInstance } from 'axios';
import type {
  Capability,
  OrganizationType,
  Organization,
  OrganizationUser,
  OrganizationAdminRole,
  CreateOrganizationTypeDto,
  UpdateOrganizationTypeDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  CreateOrganizationAdminUserDto,
  UpdateOrganizationUserDto,
  CreateOrganizationAdminRoleDto,
  UpdateOrganizationAdminRoleDto,
  OrganizationTypePaymentFee,
  CardPaymentMethodDefault,
  PaymentFeeRates,
  UrlCodeAvailability,
  OrganisationApplicationFees,
} from '../types/organization.types';
import type { PaymentMethod } from '../types/payment-method.types';

import { API_BASE_URL } from './apiBaseUrl';

// Create axios instance with interceptor for authentication
const createAuthenticatedClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
  });

  // Add request interceptor to attach token
  client.interceptors.request.use(
    (config) => {
      // Get token from Keycloak instance in window
      const keycloak = (window as any).keycloak;
      if (keycloak?.token) {
        config.headers.Authorization = `Bearer ${keycloak.token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  return client;
};

const apiClient = createAuthenticatedClient();

// Capabilities
export const getCapabilities = async (): Promise<Capability[]> => {
  const response = await apiClient.get('/api/admin/capabilities');
  return response.data;
};

// Organization Types
export const getOrganizationTypes = async (): Promise<OrganizationType[]> => {
  const response = await apiClient.get('/api/admin/organization-types');
  return response.data;
};

export const getOrganizationTypeById = async (id: string): Promise<OrganizationType> => {
  const response = await apiClient.get(`/api/admin/organization-types/${id}`);
  return response.data;
};

export const createOrganizationType = async (
  data: CreateOrganizationTypeDto
): Promise<OrganizationType> => {
  const response = await apiClient.post('/api/admin/organization-types', data);
  return response.data;
};

export const updateOrganizationType = async (
  id: string,
  data: UpdateOrganizationTypeDto
): Promise<OrganizationType> => {
  const response = await apiClient.put(`/api/admin/organization-types/${id}`, data);
  return response.data;
};

export const deleteOrganizationType = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/admin/organization-types/${id}`);
};

// Organizations
export const getOrganizations = async (organizationTypeId?: string): Promise<Organization[]> => {
  const params = organizationTypeId ? { organizationTypeId } : {};
  const response = await apiClient.get('/api/admin/organizations', { params });
  return response.data;
};

export const getOrganizationById = async (id: string): Promise<Organization> => {
  const response = await apiClient.get(`/api/admin/organizations/${id}`);
  return response.data;
};

export const createOrganization = async (data: CreateOrganizationDto): Promise<Organization> => {
  const response = await apiClient.post('/api/admin/organizations', data);
  return response.data;
};

export const updateOrganization = async (
  id: string,
  data: UpdateOrganizationDto
): Promise<Organization> => {
  const response = await apiClient.put(`/api/admin/organizations/${id}`, data);
  return response.data;
};

/**
 * Whether a URL code may be used, for the inline check on the organisation form.
 *
 * `excludeId` stops an organisation's own code counting as a collision when it
 * is being edited.
 */
export const checkUrlCodeAvailability = async (
  code: string,
  excludeId?: string
): Promise<UrlCodeAvailability> => {
  const response = await apiClient.get('/api/admin/organizations/url-code-available', {
    params: excludeId ? { code, excludeId } : { code },
  });
  return response.data;
};

/*
 * `deleteOrganization` was removed. Organisations are deactivated, not deleted:
 * setting the status to `inactive` closes the club to members and to its own
 * administrators while keeping everything it holds. The backend endpoint still
 * exists and answers 409 with that instruction, so an older client is told what
 * changed rather than getting a bare 404.
 */

export const updateOrganizationCapabilities = async (
  id: string,
  capabilities: string[]
): Promise<Organization> => {
  const response = await apiClient.put(`/api/admin/organizations/${id}/capabilities`, {
    enabledCapabilities: capabilities,
  });
  return response.data;
};

/**
 * Card handling fees for an organisation type, plus how many organisations
 * inherit them — the admin form warns before a change is applied.
 */
export const getOrganizationTypePaymentFees = async (
  organizationTypeId: string
): Promise<{ fees: OrganizationTypePaymentFee[]; organisationCount: number }> => {
  const response = await apiClient.get(
    `/api/admin/organization-types/${organizationTypeId}/payment-fees`
  );
  return response.data;
};

export const setOrganizationTypePaymentFees = async (
  organizationTypeId: string,
  fees: Array<{ paymentMethodId: string } & PaymentFeeRates>
): Promise<OrganizationTypePaymentFee[]> => {
  const response = await apiClient.put(
    `/api/admin/organization-types/${organizationTypeId}/payment-fees`,
    { fees }
  );
  return response.data.fees;
};

/**
 * The Stripe Connect application fee for one organisation, per payment method.
 *
 * Each entry carries the organisation's own value and its type's current
 * default, because the UI has to say whether the two have diverged. This is the
 * application fee only — handling fees live on the organisation type.
 */
export const getOrganizationApplicationFees = async (
  organizationId: string
): Promise<OrganisationApplicationFees> => {
  const response = await apiClient.get(
    `/api/admin/organizations/${organizationId}/application-fees`
  );
  return response.data;
};

export const setOrganizationApplicationFees = async (
  organizationId: string,
  fees: Array<{
    paymentMethodId: string;
    applicationFeeFixed: number | null;
    applicationFeePercentage: number | null;
  }>
): Promise<OrganisationApplicationFees> => {
  const response = await apiClient.put(
    `/api/admin/organizations/${organizationId}/application-fees`,
    { fees }
  );
  return response.data;
};

/** Copies the type's current default onto this organisation, for one method. */
export const resetOrganizationApplicationFee = async (
  organizationId: string,
  paymentMethodId: string
): Promise<OrganisationApplicationFees> => {
  const response = await apiClient.post(
    `/api/admin/organizations/${organizationId}/application-fees/${paymentMethodId}/reset`
  );
  return response.data;
};

/** Platform starting values, used to pre-fill the create form. */
export const getCardPaymentMethodDefaults = async (): Promise<CardPaymentMethodDefault[]> => {
  const response = await apiClient.get('/api/admin/organization-types/payment-fees/defaults');
  return response.data;
};

// Organization Users
export const getOrganizationUsers = async (
  organizationId: string,
  userType?: 'org-admin' | 'account-user'
): Promise<OrganizationUser[]> => {
  const params = userType ? { userType } : {};
  const response = await apiClient.get(
    `/api/admin/organizations/${organizationId}/users`,
    { params }
  );
  return response.data;
};

export const getOrganizationUserById = async (
  organizationId: string,
  userId: string
): Promise<OrganizationUser> => {
  const response = await apiClient.get(
    `/api/admin/organizations/${organizationId}/users/${userId}`
  );
  return response.data;
};

export const createOrganizationAdminUser = async (
  organizationId: string,
  data: CreateOrganizationAdminUserDto
): Promise<OrganizationUser> => {
  const response = await apiClient.post(
    `/api/admin/organizations/${organizationId}/users/admin`,
    data
  );
  return response.data;
};

export const updateOrganizationUser = async (
  organizationId: string,
  userId: string,
  data: UpdateOrganizationUserDto
): Promise<OrganizationUser> => {
  const response = await apiClient.put(
    `/api/admin/organizations/${organizationId}/users/${userId}`,
    data
  );
  return response.data;
};

export const deleteOrganizationUser = async (
  organizationId: string,
  userId: string
): Promise<void> => {
  await apiClient.delete(`/api/admin/organizations/${organizationId}/users/${userId}`);
};

export const assignRoleToUser = async (
  organizationId: string,
  userId: string,
  roleId: string
): Promise<void> => {
  await apiClient.post(
    `/api/admin/organizations/${organizationId}/users/${userId}/roles`,
    { roleId }
  );
};

export const removeRoleFromUser = async (
  organizationId: string,
  userId: string,
  roleId: string
): Promise<void> => {
  await apiClient.delete(
    `/api/admin/organizations/${organizationId}/users/${userId}/roles/${roleId}`
  );
};

export const resetUserPassword = async (
  organizationId: string,
  userId: string,
  newPassword: string
): Promise<void> => {
  await apiClient.post(
    `/api/admin/organizations/${organizationId}/users/${userId}/reset-password`,
    { newPassword }
  );
};

// Organization Roles
export const getOrganizationRoles = async (
  organizationId: string
): Promise<OrganizationAdminRole[]> => {
  const response = await apiClient.get(
    `/api/admin/organizations/${organizationId}/roles`
  );
  return response.data;
};

export const getOrganizationRoleById = async (
  organizationId: string,
  roleId: string
): Promise<OrganizationAdminRole> => {
  const response = await apiClient.get(
    `/api/admin/organizations/${organizationId}/roles/${roleId}`
  );
  return response.data;
};

export const createOrganizationRole = async (
  organizationId: string,
  data: CreateOrganizationAdminRoleDto
): Promise<OrganizationAdminRole> => {
  const response = await apiClient.post(
    `/api/admin/organizations/${organizationId}/roles`,
    data
  );
  return response.data;
};

export const updateOrganizationRole = async (
  organizationId: string,
  roleId: string,
  data: UpdateOrganizationAdminRoleDto
): Promise<OrganizationAdminRole> => {
  const response = await apiClient.put(
    `/api/admin/organizations/${organizationId}/roles/${roleId}`,
    data
  );
  return response.data;
};

export const deleteOrganizationRole = async (
  organizationId: string,
  roleId: string
): Promise<void> => {
  await apiClient.delete(
    `/api/admin/organizations/${organizationId}/roles/${roleId}`
  );
};

/**
 * Set the shared logo for an organisation type.
 *
 * Addressed by id, so a brand-new type has to be created before its logo can be
 * attached — the create screen uploads immediately after saving.
 */
export const uploadOrganizationTypeLogo = async (
  id: string,
  file: File
): Promise<OrganizationType> => {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post(`/api/admin/organization-types/${id}/logo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/** Remove it, handing every organisation of this type back its own logo. */
export const deleteOrganizationTypeLogo = async (id: string): Promise<OrganizationType> => {
  const response = await apiClient.delete(`/api/admin/organization-types/${id}/logo`);
  return response.data;
};

// Payment Methods
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const response = await apiClient.get('/api/admin/payment-methods');
  return response.data;
};
