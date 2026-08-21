import axios, { AxiosInstance } from 'axios';
import type {
  AuditEvent,
  AuditFilterOptions,
  AuditHealth,
  AuditPage,
  AuditQueryParams,
  LiveSession,
} from '../types/audit.types';
import { API_BASE_URL } from './apiBaseUrl';

/**
 * The audit trail and live sessions, for Platform Admin.
 *
 * Every route is `super-admin`. The organisation-scoped twin lives in
 * `orgadmin-core` and talks to a different path with the organisation fixed by
 * the server — see docs/AUDIT_TRAIL_AND_SESSIONS.md.
 */
const createAuthenticatedClient = (): AxiosInstance => {
  const client = axios.create({ baseURL: API_BASE_URL });
  client.interceptors.request.use(
    (config) => {
      const keycloak = (window as any).keycloak;
      if (keycloak?.token) config.headers.Authorization = `Bearer ${keycloak.token}`;
      return config;
    },
    (error) => Promise.reject(error)
  );
  return client;
};

const apiClient = createAuthenticatedClient();

/**
 * Repeated filters go on the wire as repeated keys (`?category=a&category=b`),
 * which is what the server's `list()` helper reads.
 */
const toSearchParams = (params: AuditQueryParams): URLSearchParams => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.append(key, String(value));
  });
  return search;
};

export const getAuditEvents = async (params: AuditQueryParams): Promise<AuditPage> => {
  const response = await apiClient.get(`/api/admin/audit?${toSearchParams(params)}`);
  return response.data;
};

export const getAuditEvent = async (id: string): Promise<AuditEvent> => {
  const response = await apiClient.get(`/api/admin/audit/${id}`);
  return response.data;
};

export const getAuditFilters = async (): Promise<AuditFilterOptions> => {
  const response = await apiClient.get('/api/admin/audit/filters');
  return response.data;
};

export const getAuditHealth = async (): Promise<AuditHealth> => {
  const response = await apiClient.get('/api/admin/audit/health');
  return response.data;
};

export const getSessions = async (): Promise<LiveSession[]> => {
  const response = await apiClient.get('/api/admin/sessions');
  return response.data;
};

export const revokeSession = async (sessionId: string): Promise<void> => {
  await apiClient.delete(`/api/admin/sessions/${sessionId}`);
};

export const revokeAllSessions = async (keycloakUserId: string): Promise<void> => {
  await apiClient.delete(`/api/admin/sessions/user/${keycloakUserId}`);
};
