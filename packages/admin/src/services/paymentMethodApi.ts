import axios, { AxiosInstance } from 'axios';
import type { PaymentMethod, OrgPaymentMethodData } from '../types/payment-method.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

/**
 * Get all active payment methods
 * @returns Promise<PaymentMethod[]> List of active payment methods
 */
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const response = await apiClient.get('/api/admin/payment-methods');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.error || 'Failed to fetch payment methods'
      );
    }
    throw error;
  }
};

/**
 * Get organization payment methods
 * @param orgId Organization ID
 * @returns Promise<OrgPaymentMethodData[]> List of organization payment methods
 */
export const getOrgPaymentMethods = async (
  orgId: string
): Promise<OrgPaymentMethodData[]> => {
  try {
    const response = await apiClient.get(
      `/api/admin/organizations/${orgId}/payment-methods`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.error || 'Failed to fetch organization payment methods'
      );
    }
    throw error;
  }
};

/**
 * Update organization payment methods
 * This function is not directly supported by the backend API.
 * Instead, use the organization update endpoint with enabledPaymentMethods field.
 * 
 * @param _orgId Organization ID
 * @param _methodIds Array of payment method IDs to enable
 * @deprecated Use updateOrganization with enabledPaymentMethods instead
 */
export const updateOrgPaymentMethods = async (
  _orgId: string,
  _methodIds: string[]
): Promise<void> => {
  // This is a placeholder function as the actual implementation
  // should use the organization update endpoint with enabledPaymentMethods
  console.warn(
    'updateOrgPaymentMethods is deprecated. Use updateOrganization with enabledPaymentMethods instead.'
  );
  throw new Error(
    'Use updateOrganization with enabledPaymentMethods field instead of this function'
  );
};
