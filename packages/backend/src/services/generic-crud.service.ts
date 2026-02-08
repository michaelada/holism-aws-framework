import { db } from '../database/pool';
import { metadataService } from './metadata.service';
import { validationService } from './validation.service';
import { FieldDefinition, ObjectDefinition } from '../types/metadata.types';

/**
 * Query parameters for listing instances
 */
export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

/**
 * Response format for list operations
 */
export interface ListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * Service for generic CRUD operations on metadata-defined objects
 */
export class GenericCrudService {
  /**
   * List instances of an object type with filtering, sorting, and pagination
   */
  async listInstances(
    objectType: string,
    params: ListQueryParams = {}
  ): Promise<ListResponse<any>> {
    // Verify object type exists
    const objectDef = await metadataService.getObjectByShortName(objectType);
    if (!objectDef) {
      throw new Error(`Object type '${objectType}' not found`);
    }

    const tableName = `instances_${objectType}`;
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // Build WHERE clause for search
    let whereClause = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.search && objectDef.displayProperties.searchableFields) {
      const searchConditions = objectDef.displayProperties.searchableFields.map(field => {
        queryParams.push(`%${params.search}%`);
        return `${field}::text ILIKE $${paramIndex++}`;
      });
      whereClause = `WHERE ${searchConditions.join(' OR ')}`;
    }

    // Build WHERE clause for filters
    if (params.filters && Object.keys(params.filters).length > 0) {
      const filterConditions = Object.entries(params.filters).map(([field, value]) => {
        queryParams.push(value);
        return `${field} = $${paramIndex++}`;
      });
      
      if (whereClause) {
        whereClause += ` AND ${filterConditions.join(' AND ')}`;
      } else {
        whereClause = `WHERE ${filterConditions.join(' AND ')}`;
      }
    }

    // Build ORDER BY clause
    let orderByClause = '';
    if (params.sortBy) {
      const sortOrder = params.sortOrder || 'asc';
      orderByClause = `ORDER BY ${params.sortBy} ${sortOrder.toUpperCase()}`;
    } else if (objectDef.displayProperties.defaultSortField) {
      const sortOrder = objectDef.displayProperties.defaultSortOrder || 'asc';
      orderByClause = `ORDER BY ${objectDef.displayProperties.defaultSortField} ${sortOrder.toUpperCase()}`;
    } else {
      orderByClause = 'ORDER BY created_at DESC';
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / pageSize);

    // Get paginated data
    queryParams.push(pageSize, offset);
    const dataQuery = `
      SELECT * FROM ${tableName}
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataResult = await db.query(dataQuery, queryParams);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages
      }
    };
  }

  /**
   * Get a single instance by ID
   */
  async getInstance(objectType: string, id: string): Promise<any | null> {
    // Verify object type exists
    const objectDef = await metadataService.getObjectByShortName(objectType);
    if (!objectDef) {
      throw new Error(`Object type '${objectType}' not found`);
    }

    const tableName = `instances_${objectType}`;
    const query = `SELECT * FROM ${tableName} WHERE id = $1`;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Create a new instance
   */
  async createInstance(objectType: string, data: any): Promise<any> {
    // Get object definition and field definitions
    const objectDef = await metadataService.getObjectByShortName(objectType);
    if (!objectDef) {
      throw new Error(`Object type '${objectType}' not found`);
    }

    const fieldDefinitions = await this.getFieldDefinitions(objectDef);

    // Validate instance data
    const validationResult = await validationService.validateInstance(
      objectDef,
      fieldDefinitions,
      data
    );

    if (!validationResult.valid) {
      const error: any = new Error('Validation failed');
      error.validationErrors = validationResult.errors;
      throw error;
    }

    // Build INSERT query
    const tableName = `instances_${objectType}`;
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${tableName} (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update an existing instance
   */
  async updateInstance(objectType: string, id: string, data: any): Promise<any | null> {
    // Get object definition and field definitions
    const objectDef = await metadataService.getObjectByShortName(objectType);
    if (!objectDef) {
      throw new Error(`Object type '${objectType}' not found`);
    }

    // Check if instance exists
    const existing = await this.getInstance(objectType, id);
    if (!existing) {
      return null;
    }

    const fieldDefinitions = await this.getFieldDefinitions(objectDef);

    // Validate instance data
    const validationResult = await validationService.validateInstance(
      objectDef,
      fieldDefinitions,
      data
    );

    if (!validationResult.valid) {
      const error: any = new Error('Validation failed');
      error.validationErrors = validationResult.errors;
      throw error;
    }

    // Build UPDATE query
    const tableName = `instances_${objectType}`;
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

    const query = `
      UPDATE ${tableName}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 1}
      RETURNING *
    `;

    const result = await db.query(query, [...values, id]);
    return result.rows[0];
  }

  /**
   * Delete an instance
   */
  async deleteInstance(objectType: string, id: string): Promise<boolean> {
    // Verify object type exists
    const objectDef = await metadataService.getObjectByShortName(objectType);
    if (!objectDef) {
      throw new Error(`Object type '${objectType}' not found`);
    }

    const tableName = `instances_${objectType}`;
    const query = `DELETE FROM ${tableName} WHERE id = $1 RETURNING id`;
    const result = await db.query(query, [id]);

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Helper method to get field definitions for an object
   */
  private async getFieldDefinitions(objectDef: ObjectDefinition): Promise<FieldDefinition[]> {
    const fieldDefinitions: FieldDefinition[] = [];

    for (const fieldRef of objectDef.fields) {
      const field = await metadataService.getFieldByShortName(fieldRef.fieldShortName);
      if (field) {
        fieldDefinitions.push(field);
      }
    }

    return fieldDefinitions;
  }
}

export const genericCrudService = new GenericCrudService();
