import { ApiClient } from './client';

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

export interface ListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export class InstancesApi {
  constructor(private client: ApiClient) {}

  async listInstances<T = any>(
    objectType: string,
    params?: ListQueryParams
  ): Promise<ListResponse<T>> {
    return this.client.get<ListResponse<T>>(
      `/api/objects/${objectType}/instances`,
      { params }
    );
  }

  async getInstance<T = any>(objectType: string, id: string): Promise<T> {
    return this.client.get<T>(`/api/objects/${objectType}/instances/${id}`);
  }

  async createInstance<T = any>(objectType: string, data: any): Promise<T> {
    return this.client.post<T>(`/api/objects/${objectType}/instances`, data);
  }

  async updateInstance<T = any>(
    objectType: string,
    id: string,
    data: any
  ): Promise<T> {
    return this.client.put<T>(
      `/api/objects/${objectType}/instances/${id}`,
      data
    );
  }

  async deleteInstance(objectType: string, id: string): Promise<void> {
    return this.client.delete<void>(
      `/api/objects/${objectType}/instances/${id}`
    );
  }
}
