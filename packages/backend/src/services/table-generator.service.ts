import { FieldDatatype, FieldDefinition, ObjectDefinition } from '../types/metadata.types';

/**
 * Service for generating dynamic instance tables based on Object Definitions
 */
export class TableGeneratorService {
  /**
   * Map field datatypes to SQL column types
   */
  private readonly DATATYPE_TO_SQL: Record<FieldDatatype, string> = {
    [FieldDatatype.TEXT]: 'VARCHAR(255)',
    [FieldDatatype.TEXT_AREA]: 'TEXT',
    [FieldDatatype.NUMBER]: 'NUMERIC',
    [FieldDatatype.BOOLEAN]: 'BOOLEAN',
    [FieldDatatype.DATE]: 'DATE',
    [FieldDatatype.TIME]: 'TIME',
    [FieldDatatype.DATETIME]: 'TIMESTAMP',
    [FieldDatatype.EMAIL]: 'VARCHAR(255)',
    [FieldDatatype.URL]: 'VARCHAR(2048)',
    [FieldDatatype.SINGLE_SELECT]: 'VARCHAR(100)',
    [FieldDatatype.MULTI_SELECT]: 'JSONB'
  };

  /**
   * Generate table name for an object definition
   */
  getTableName(objectShortName: string): string {
    return `instances_${objectShortName}`;
  }

  /**
   * Generate CREATE TABLE statement from Object Definition
   */
  generateTableSchema(objectDef: ObjectDefinition, fields: FieldDefinition[]): string {
    const tableName = this.getTableName(objectDef.shortName);
    const columns: string[] = [];

    // Add standard columns
    columns.push('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');

    // Add field columns
    for (const fieldRef of objectDef.fields) {
      const field = fields.find(f => f.shortName === fieldRef.fieldShortName);
      if (!field) {
        throw new Error(`Field '${fieldRef.fieldShortName}' not found`);
      }

      const sqlType = this.DATATYPE_TO_SQL[field.datatype];
      const notNull = fieldRef.mandatory ? ' NOT NULL' : '';
      columns.push(`${field.shortName} ${sqlType}${notNull}`);
    }

    // Add audit columns
    columns.push('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    columns.push('updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    columns.push('created_by UUID');
    columns.push('updated_by UUID');

    const createTableSQL = `CREATE TABLE ${tableName} (\n  ${columns.join(',\n  ')}\n);`;
    
    return createTableSQL;
  }

  /**
   * Generate indexes for searchable fields
   */
  generateIndexes(objectDef: ObjectDefinition): string[] {
    const tableName = this.getTableName(objectDef.shortName);
    const indexes: string[] = [];

    if (objectDef.displayProperties.searchableFields) {
      for (const fieldShortName of objectDef.displayProperties.searchableFields) {
        const indexName = `idx_${tableName}_${fieldShortName}`;
        const indexSQL = `CREATE INDEX ${indexName} ON ${tableName}(${fieldShortName});`;
        indexes.push(indexSQL);
      }
    }

    return indexes;
  }

  /**
   * Generate complete table creation SQL (table + indexes)
   */
  generateCompleteTableSQL(objectDef: ObjectDefinition, fields: FieldDefinition[]): string[] {
    const statements: string[] = [];
    
    // Add CREATE TABLE statement
    statements.push(this.generateTableSchema(objectDef, fields));
    
    // Add index statements
    const indexes = this.generateIndexes(objectDef);
    statements.push(...indexes);
    
    return statements;
  }

  /**
   * Generate ALTER TABLE statements for object definition changes
   */
  generateMigration(
    oldDef: ObjectDefinition,
    oldFields: FieldDefinition[],
    newDef: ObjectDefinition,
    newFields: FieldDefinition[]
  ): string[] {
    const tableName = this.getTableName(oldDef.shortName);
    const statements: string[] = [];

    // Build field maps for comparison
    const oldFieldMap = new Map<string, { field: FieldDefinition; ref: any }>();
    for (const fieldRef of oldDef.fields) {
      const field = oldFields.find(f => f.shortName === fieldRef.fieldShortName);
      if (field) {
        oldFieldMap.set(field.shortName, { field, ref: fieldRef });
      }
    }

    const newFieldMap = new Map<string, { field: FieldDefinition; ref: any }>();
    for (const fieldRef of newDef.fields) {
      const field = newFields.find(f => f.shortName === fieldRef.fieldShortName);
      if (field) {
        newFieldMap.set(field.shortName, { field, ref: fieldRef });
      }
    }

    // Find fields to add
    for (const [fieldName, { field, ref }] of newFieldMap) {
      if (!oldFieldMap.has(fieldName)) {
        const sqlType = this.DATATYPE_TO_SQL[field.datatype];
        const notNull = ref.mandatory ? ' NOT NULL' : '';
        statements.push(`ALTER TABLE ${tableName} ADD COLUMN ${field.shortName} ${sqlType}${notNull};`);
      }
    }

    // Find fields to remove
    for (const [fieldName] of oldFieldMap) {
      if (!newFieldMap.has(fieldName)) {
        statements.push(`ALTER TABLE ${tableName} DROP COLUMN ${fieldName};`);
      }
    }

    // Find fields to modify
    for (const [fieldName, { field: newField, ref: newRef }] of newFieldMap) {
      const oldEntry = oldFieldMap.get(fieldName);
      if (oldEntry) {
        const { field: oldField, ref: oldRef } = oldEntry;
        
        // Check if datatype changed
        if (oldField.datatype !== newField.datatype) {
          const sqlType = this.DATATYPE_TO_SQL[newField.datatype];
          statements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} TYPE ${sqlType};`);
        }

        // Check if mandatory constraint changed
        if (oldRef.mandatory !== newRef.mandatory) {
          if (newRef.mandatory) {
            statements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} SET NOT NULL;`);
          } else {
            statements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} DROP NOT NULL;`);
          }
        }
      }
    }

    // Handle index changes
    const oldSearchableFields = new Set(oldDef.displayProperties.searchableFields || []);
    const newSearchableFields = new Set(newDef.displayProperties.searchableFields || []);

    // Drop indexes for fields no longer searchable
    for (const fieldName of oldSearchableFields) {
      if (!newSearchableFields.has(fieldName)) {
        const indexName = `idx_${tableName}_${fieldName}`;
        statements.push(`DROP INDEX IF EXISTS ${indexName};`);
      }
    }

    // Create indexes for newly searchable fields
    for (const fieldName of newSearchableFields) {
      if (!oldSearchableFields.has(fieldName)) {
        const indexName = `idx_${tableName}_${fieldName}`;
        statements.push(`CREATE INDEX ${indexName} ON ${tableName}(${fieldName});`);
      }
    }

    return statements;
  }
}

export const tableGeneratorService = new TableGeneratorService();
