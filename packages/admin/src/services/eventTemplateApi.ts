import axios, { AxiosInstance } from 'axios';
import type {
  EventTypeTemplate,
  EventTypeTemplateInput,
  ResolvedEventRules,
} from '../types/eventTemplate.types';
import { API_BASE_URL } from './apiBaseUrl';

/**
 * Event type templates, and the rules an organisation type fixes on them.
 *
 * Its own client for the same reason as `postApi`: templates belong to nobody,
 * every route is `super-admin`, and `organizationApi` is already long and
 * entirely about organisations.
 */
const createAuthenticatedClient = (): AxiosInstance => {
  const client = axios.create({ baseURL: API_BASE_URL });

  client.interceptors.request.use(
    (config) => {
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

const ROOT = '/api/admin/event-type-templates';

export const getEventTypeTemplates = async (): Promise<EventTypeTemplate[]> => {
  const response = await apiClient.get(ROOT);
  return response.data;
};

export const getEventTypeTemplate = async (id: string): Promise<EventTypeTemplate> => {
  const response = await apiClient.get(`${ROOT}/${id}`);
  return response.data;
};

export const createEventTypeTemplate = async (
  data: EventTypeTemplateInput
): Promise<EventTypeTemplate> => {
  const response = await apiClient.post(ROOT, data);
  return response.data;
};

export const updateEventTypeTemplate = async (
  id: string,
  data: Partial<EventTypeTemplateInput>
): Promise<EventTypeTemplate> => {
  const response = await apiClient.put(`${ROOT}/${id}`, data);
  return response.data;
};

/** A template's settings as one organisation type sees them, with its locks. */
export const getEventRulesForType = async (
  templateId: string,
  organizationTypeId: string
): Promise<ResolvedEventRules> => {
  const response = await apiClient.get(
    `${ROOT}/${templateId}/rules/organisation-type/${organizationTypeId}`
  );
  return response.data;
};

/**
 * Save a type's rules.
 *
 * `settings` carries **only what differs** from the template, so raising a
 * platform default still reaches every type that never overrode it. Sending the
 * resolved values back would freeze each type on what it happened to inherit
 * the day it was saved.
 */
export const saveEventRulesForType = async (
  templateId: string,
  organizationTypeId: string,
  body: { settings: Record<string, unknown>; lockedKeys: string[] }
): Promise<ResolvedEventRules> => {
  const response = await apiClient.put(
    `${ROOT}/${templateId}/rules/organisation-type/${organizationTypeId}`,
    body
  );
  return response.data;
};

/**
 * The message a refusal carries, or a fallback.
 *
 * The API answers a locked key or a bad lock with a sentence naming what it
 * refused, and that sentence is the whole value of the error — "Failed to save"
 * would send the administrator back to guess which row was the problem.
 */
export const eventTemplateErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as any)?.response?.data;
  const message = typeof data?.error === 'string' ? data.error : data?.error?.message;
  return message || fallback;
};
