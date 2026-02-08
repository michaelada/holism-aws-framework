import { ApiClient } from './client';
import {
  FieldDefinition,
  ObjectDefinition,
} from '@aws-web-framework/components';

export class MetadataApi {
  constructor(private client: ApiClient) {}

  // Field Definitions
  async getFields(): Promise<FieldDefinition[]> {
    return this.client.get<FieldDefinition[]>('/api/metadata/fields');
  }

  async getField(shortName: string): Promise<FieldDefinition> {
    return this.client.get<FieldDefinition>(`/api/metadata/fields/${shortName}`);
  }

  async createField(field: Omit<FieldDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<FieldDefinition> {
    return this.client.post<FieldDefinition>('/api/metadata/fields', field);
  }

  async updateField(shortName: string, field: Partial<FieldDefinition>): Promise<FieldDefinition> {
    return this.client.put<FieldDefinition>(`/api/metadata/fields/${shortName}`, field);
  }

  async deleteField(shortName: string): Promise<void> {
    return this.client.delete<void>(`/api/metadata/fields/${shortName}`);
  }

  // Object Definitions
  async getObjects(): Promise<ObjectDefinition[]> {
    return this.client.get<ObjectDefinition[]>('/api/metadata/objects');
  }

  async getObject(shortName: string): Promise<ObjectDefinition> {
    return this.client.get<ObjectDefinition>(`/api/metadata/objects/${shortName}`);
  }

  async createObject(object: Omit<ObjectDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<ObjectDefinition> {
    return this.client.post<ObjectDefinition>('/api/metadata/objects', object);
  }

  async updateObject(shortName: string, object: Partial<ObjectDefinition>): Promise<ObjectDefinition> {
    return this.client.put<ObjectDefinition>(`/api/metadata/objects/${shortName}`, object);
  }

  async deleteObject(shortName: string): Promise<void> {
    return this.client.delete<void>(`/api/metadata/objects/${shortName}`);
  }
}
