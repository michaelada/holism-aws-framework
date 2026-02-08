/**
 * API client for communicating with the backend service
 */

import type { ErrorResponse } from '../types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public error: ErrorResponse['error']
  ) {
    super(error.message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

export class ApiClient {
  constructor(
    private baseUrl: string = '/api',
    private getAuthToken?: () => string | null
  ) {}

  private buildUrl(path: string, params?: Record<string, any>): string {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Construct full URL - handle both absolute and relative base URLs
    let url: URL;
    if (this.baseUrl.startsWith('http://') || this.baseUrl.startsWith('https://')) {
      // Absolute URL - use as base
      url = new URL(normalizedPath, this.baseUrl);
    } else {
      // Relative URL - construct from current origin
      const fullUrl = `${this.baseUrl}${normalizedPath}`;
      url = new URL(fullUrl, window.location.origin);
    }
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.getAuthToken) {
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...this.getHeaders(),
          ...fetchOptions.headers,
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new ApiError(response.status, errorData.error);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network error
      throw new NetworkError('Unable to connect to server');
    }
  }

  async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>(path, { method: 'GET', params });
  }

  async post<T>(path: string, data?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(path: string, data?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

// Default API client instance
// Use environment variable or fallback to localhost:3000
const defaultBaseUrl = typeof window !== 'undefined' && (window as any).__API_BASE_URL__
  ? (window as any).__API_BASE_URL__
  : 'http://localhost:3000';

export const defaultApiClient = new ApiClient(defaultBaseUrl);
