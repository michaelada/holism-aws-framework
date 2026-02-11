import axios from 'axios';
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
} from '../types/organization.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Capabilities
export const getCapabilities = async (): Promise<Capability[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/capabilities`);
  return response.data;
};

// Organization Types
export const getOrganizationTypes = async (): Promise<OrganizationType[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/organization-types`);
  return response.data;
};

export const getOrganizationTypeById = async (id: string): Promise<OrganizationType> => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/organization-types/${id}`);
  return response.data;
};

export const createOrganizationType = async (
  data: CreateOrganizationTypeDto
): Promise<OrganizationType> => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/organization-types`, data);
  return response.data;
};

export const updateOrganizationType = async (
  id: string,
  data: UpdateOrganizationTypeDto
): Promise<OrganizationType> => {
  const response = await axios.put(`${API_BASE_URL}/api/admin/organization-types/${id}`, data);
  return response.data;
};

export const deleteOrganizationType = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/admin/organization-types/${id}`);
};

// Organizations
export const getOrganizations = async (organizationTypeId?: string): Promise<Organization[]> => {
  const params = organizationTypeId ? { organizationTypeId } : {};
  const response = await axios.get(`${API_BASE_URL}/api/admin/organizations`, { params });
  return response.data;
};

export const getOrganizationById = async (id: string): Promise<Organization> => {
  const response = await axios.get(`${API_BASE_URL}/api/admin/organizations/${id}`);
  return response.data;
};

export const createOrganization = async (data: CreateOrganizationDto): Promise<Organization> => {
  const response = await axios.post(`${API_BASE_URL}/api/admin/organizations`, data);
  return response.data;
};

export const updateOrganization = async (
  id: string,
  data: UpdateOrganizationDto
): Promise<Organization> => {
  const response = await axios.put(`${API_BASE_URL}/api/admin/organizations/${id}`, data);
  return response.data;
};

export const deleteOrganization = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/admin/organizations/${id}`);
};

export const updateOrganizationCapabilities = async (
  id: string,
  capabilities: string[]
): Promise<Organization> => {
  const response = await axios.put(`${API_BASE_URL}/api/admin/organizations/${id}/capabilities`, {
    enabledCapabilities: capabilities,
  });
  return response.data;
};

// Organization Users
export const getOrganizationUsers = async (
  organizationId: string,
  userType?: 'org-admin' | 'account-user'
): Promise<OrganizationUser[]> => {
  const params = userType ? { userType } : {};
  const response = await axios.get(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/users`,
    { params }
  );
  return response.data;
};

export const getOrganizationUserById = async (
  organizationId: string,
  userId: string
): Promise<OrganizationUser> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/users/${userId}`
  );
  return response.data;
};

export const createOrganizationAdminUser = async (
  organizationId: string,
  data: CreateOrganizationAdminUserDto
): Promise<OrganizationUser> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/users/admin`,
    data
  );
  return response.data;
};

export const updateOrganizationUser = async (
  organizationId: string,
  userId: string,
  data: UpdateOrganizationUserDto
): Promise<OrganizationUser> => {
  const response = await axios.put(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/users/${userId}`,
    data
  );
  return response.data;
};

export const deleteOrganizationUser = async (
  organizationId: string,
  userId: string
): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/admin/organizations/${organizationId}/users/${userId}`);
};

export const assignRoleToUser = async (
  organizationId: string,
  userId: string,
  roleId: string
): Promise<void> => {
  await axios.post(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/users/${userId}/roles`,
    { roleId }
  );
};

export const removeRoleFromUser = async (
  organizationId: string,
  userId: string,
  roleId: string
): Promise<void> => {
  await axios.delete(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/users/${userId}/roles/${roleId}`
  );
};

export const resetUserPassword = async (
  organizationId: string,
  userId: string,
  newPassword: string
): Promise<void> => {
  await axios.post(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/users/${userId}/reset-password`,
    { newPassword }
  );
};

// Organization Roles
export const getOrganizationRoles = async (
  organizationId: string
): Promise<OrganizationAdminRole[]> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/roles`
  );
  return response.data;
};

export const getOrganizationRoleById = async (
  organizationId: string,
  roleId: string
): Promise<OrganizationAdminRole> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/roles/${roleId}`
  );
  return response.data;
};

export const createOrganizationRole = async (
  organizationId: string,
  data: CreateOrganizationAdminRoleDto
): Promise<OrganizationAdminRole> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/roles`,
    data
  );
  return response.data;
};

export const updateOrganizationRole = async (
  organizationId: string,
  roleId: string,
  data: UpdateOrganizationAdminRoleDto
): Promise<OrganizationAdminRole> => {
  const response = await axios.put(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/roles/${roleId}`,
    data
  );
  return response.data;
};

export const deleteOrganizationRole = async (
  organizationId: string,
  roleId: string
): Promise<void> => {
  await axios.delete(
    `${API_BASE_URL}/api/admin/organizations/${organizationId}/roles/${roleId}`
  );
};
