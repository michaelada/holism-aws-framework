import axios, { AxiosInstance } from 'axios';
import type { PlatformPost, PlatformPostInput } from '../types/post.types';
import { API_BASE_URL } from './apiBaseUrl';

/**
 * Platform posts — the announcements shown on both login pages.
 *
 * Its own client rather than an addition to `organizationApi`, which is already
 * long and is entirely about organisations. Posts belong to nobody: they carry
 * no organisation, and every route is `super-admin`.
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

export const getPosts = async (): Promise<PlatformPost[]> => {
  const response = await apiClient.get('/api/admin/posts');
  return response.data;
};

export const getPost = async (id: string): Promise<PlatformPost> => {
  const response = await apiClient.get(`/api/admin/posts/${id}`);
  return response.data;
};

export const createPost = async (data: PlatformPostInput): Promise<PlatformPost> => {
  const response = await apiClient.post('/api/admin/posts', data);
  return response.data;
};

export const updatePost = async (
  id: string,
  data: PlatformPostInput
): Promise<PlatformPost> => {
  const response = await apiClient.put(`/api/admin/posts/${id}`, data);
  return response.data;
};

export const deletePost = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/admin/posts/${id}`);
};

/**
 * Save the whole arrangement, not a single move.
 *
 * The server rewrites every row from this list, so two people reordering at
 * once end with one of their arrangements rather than an interleaving of both.
 */
export const reorderPosts = async (orderedIds: string[]): Promise<PlatformPost[]> => {
  const response = await apiClient.put('/api/admin/posts/reorder', { orderedIds });
  return response.data;
};

export const uploadPostImage = async (id: string, file: File): Promise<PlatformPost> => {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post(`/api/admin/posts/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deletePostImage = async (id: string): Promise<PlatformPost> => {
  const response = await apiClient.delete(`/api/admin/posts/${id}/image`);
  return response.data;
};
