import { db } from '../database/pool';
import { FieldDefinition, ObjectDefinition } from '../types/metadata.types';
import { tableGeneratorService } from './table-generator.service';

/**
 * Service for managing metadata (Field and Object Definitions)
 */
export class MetadataService {
  /**
   * Register a new field definition
   */
  async registerField(field: FieldDefinition): Promise<FieldDefinition> {
    const query = `
      INSERT INTO field_definitions (
        short_name, display_name, description, datatype, 
        datatype_properties, validation_rules, mandatory
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, short_name, display_name, description, datatype, 
                datatype_properties, validation_rules, mandatory, created_at, updated_at
    `;

    const values = [
      field.shortName,
      field.displayName,
      field.description,
      field.datatype,
      JSON.stringify(field.datatypeProperties || {}),
      JSON.stringify(field.validationRules || []),
      field.mandatory
    ];

    const result = await db.query(query, values);
    return this.mapFieldRow(result.rows[0]);
  }

  /**
   * Get all field definitions
   */
  async getAllFields(): Promise<FieldDefinition[]> {
    const query = `
      SELECT id, short_name, display_name, description, datatype, 
             datatype_properties, validation_rules, mandatory, created_at, updated_at
      FROM field_definitions
      ORDER BY created_at DESC
    `;

    const result = await db.query(query);
    return result.rows.map(row => this.mapFieldRow(row));
  }

  /**
   * Get a field definition by short name
   */
  async getFieldByShortName(shortName: string): Promise<FieldDefinition | null> {
    const query = `
      SELECT id, short_name, display_name, description, datatype, 
             datatype_properties, validation_rules, mandatory, created_at, updated_at
      FROM field_definitions
      WHERE short_name = $1
    `;

    const result = await db.query(query, [shortName]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapFieldRow(result.rows[0]);
  }

  /**
   * Update a field definition
   */
  async updateField(shortName: string, field: Partial<FieldDefinition>): Promise<FieldDefinition | null> {
    const existing = await this.getFieldByShortName(shortName);
    if (!existing) {
      return null;
    }

    const query = `
      UPDATE field_definitions
      SET display_name = $1,
          description = $2,
          datatype = $3,
          datatype_properties = $4,
          validation_rules = $5,
          mandatory = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE short_name = $7
      RETURNING id, short_name, display_name, description, datatype, 
                datatype_properties, validation_rules, mandatory, created_at, updated_at
    `;

    const values = [
      field.displayName ?? existing.displayName,
      field.description ?? existing.description,
      field.datatype ?? existing.datatype,
      JSON.stringify(field.datatypeProperties ?? existing.datatypeProperties),
      JSON.stringify(field.validationRules ?? existing.validationRules),
      field.mandatory ?? existing.mandatory,
      shortName
    ];

    const result = await db.query(query, values);
    return this.mapFieldRow(result.rows[0]);
  }

  /**
   * Delete a field definition
   */
  async deleteField(shortName: string): Promise<boolean> {
    const query = `
      DELETE FROM field_definitions
      WHERE short_name = $1
      RETURNING id
    `;

    const result = await db.query(query, [shortName]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Register a new object definition
   */
  async registerObject(object: ObjectDefinition): Promise<ObjectDefinition> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Validate field groups if provided
      if (object.fieldGroups) {
        this.validateFieldGroups(object.fieldGroups, object.fields);
      }

      // Insert object definition
      const objectQuery = `
        INSERT INTO object_definitions (
          short_name, display_name, description, display_properties, wizard_config, field_groups
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, short_name, display_name, description, display_properties, 
                  wizard_config, field_groups, created_at, updated_at
      `;

      const objectValues = [
        object.shortName,
        object.displayName,
        object.description,
        JSON.stringify(object.displayProperties || {}),
        object.wizardConfig ? JSON.stringify(object.wizardConfig) : null,
        object.fieldGroups ? JSON.stringify(object.fieldGroups) : null
      ];

      const objectResult = await client.query(objectQuery, objectValues);
      const objectId = objectResult.rows[0].id;

      // Collect field definitions for table generation
      const fieldDefinitions: FieldDefinition[] = [];

      // Insert object-field relationships
      for (const fieldRef of object.fields) {
        const fieldQuery = `
          SELECT id, short_name, display_name, description, datatype, 
                 datatype_properties, validation_rules, mandatory, created_at, updated_at
          FROM field_definitions WHERE short_name = $1
        `;
        const fieldResult = await client.query(fieldQuery, [fieldRef.fieldShortName]);
        
        if (fieldResult.rows.length === 0) {
          throw new Error(`Field '${fieldRef.fieldShortName}' does not exist`);
        }

        const fieldId = fieldResult.rows[0].id;
        fieldDefinitions.push(this.mapFieldRow(fieldResult.rows[0]));

        const relationQuery = `
          INSERT INTO object_fields (object_id, field_id, mandatory, display_order)
          VALUES ($1, $2, $3, $4)
        `;

        await client.query(relationQuery, [
          objectId,
          fieldId,
          fieldRef.mandatory,
          fieldRef.order
        ]);
      }

      // Generate and execute table creation SQL
      const tableStatements = tableGeneratorService.generateCompleteTableSQL(object, fieldDefinitions);
      for (const statement of tableStatements) {
        await client.query(statement);
      }

      await client.query('COMMIT');

      return this.mapObjectRow(objectResult.rows[0], object.fields);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all object definitions
   */
  async getAllObjects(): Promise<ObjectDefinition[]> {
    const query = `
      SELECT 
        od.id, od.short_name, od.display_name, od.description, 
        od.display_properties, od.wizard_config, od.field_groups, od.created_at, od.updated_at,
        json_agg(
          json_build_object(
            'fieldShortName', fd.short_name,
            'mandatory', of.mandatory,
            'order', of.display_order
          ) ORDER BY of.display_order
        ) as fields
      FROM object_definitions od
      LEFT JOIN object_fields of ON od.id = of.object_id
      LEFT JOIN field_definitions fd ON of.field_id = fd.id
      GROUP BY od.id
      ORDER BY od.created_at DESC
    `;

    const result = await db.query(query);
    return result.rows.map(row => this.mapObjectRowWithFields(row));
  }

  /**
   * Get an object definition by short name
   */
  async getObjectByShortName(shortName: string): Promise<ObjectDefinition | null> {
    const query = `
      SELECT 
        od.id, od.short_name, od.display_name, od.description, 
        od.display_properties, od.wizard_config, od.field_groups, od.created_at, od.updated_at,
        json_agg(
          json_build_object(
            'fieldShortName', fd.short_name,
            'mandatory', of.mandatory,
            'order', of.display_order
          ) ORDER BY of.display_order
        ) as fields
      FROM object_definitions od
      LEFT JOIN object_fields of ON od.id = of.object_id
      LEFT JOIN field_definitions fd ON of.field_id = fd.id
      WHERE od.short_name = $1
      GROUP BY od.id
    `;

    const result = await db.query(query, [shortName]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapObjectRowWithFields(result.rows[0]);
  }

  /**
   * Update an object definition
   */
  async updateObject(shortName: string, object: Partial<ObjectDefinition>): Promise<ObjectDefinition | null> {
    const existing = await this.getObjectByShortName(shortName);
    if (!existing) {
      return null;
    }

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Validate field groups if provided
      if (object.fieldGroups) {
        const fieldsToValidate = object.fields ?? existing.fields;
        this.validateFieldGroups(object.fieldGroups, fieldsToValidate);
      }

      // Update object definition
      const objectQuery = `
        UPDATE object_definitions
        SET display_name = $1,
            description = $2,
            display_properties = $3,
            wizard_config = $4,
            field_groups = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE short_name = $6
        RETURNING id, short_name, display_name, description, display_properties, 
                  wizard_config, field_groups, created_at, updated_at
      `;

      const objectValues = [
        object.displayName ?? existing.displayName,
        object.description ?? existing.description,
        JSON.stringify(object.displayProperties ?? existing.displayProperties),
        object.wizardConfig ? JSON.stringify(object.wizardConfig) : existing.wizardConfig ? JSON.stringify(existing.wizardConfig) : null,
        object.fieldGroups ? JSON.stringify(object.fieldGroups) : existing.fieldGroups ? JSON.stringify(existing.fieldGroups) : null,
        shortName
      ];

      const objectResult = await client.query(objectQuery, objectValues);
      const objectId = objectResult.rows[0].id;

      // Prepare for migration if fields are being updated OR if displayProperties changed
      let oldFieldDefinitions: FieldDefinition[] = [];
      let newFieldDefinitions: FieldDefinition[] = [];
      let needsMigration = false;

      if (object.fields) {
        needsMigration = true;
        
        // Get old field definitions
        for (const fieldRef of existing.fields) {
          const fieldQuery = `
            SELECT id, short_name, display_name, description, datatype, 
                   datatype_properties, validation_rules, mandatory, created_at, updated_at
            FROM field_definitions WHERE short_name = $1
          `;
          const fieldResult = await client.query(fieldQuery, [fieldRef.fieldShortName]);
          if (fieldResult.rows.length > 0) {
            oldFieldDefinitions.push(this.mapFieldRow(fieldResult.rows[0]));
          }
        }

        // Delete existing relationships
        await client.query('DELETE FROM object_fields WHERE object_id = $1', [objectId]);

        // Insert new relationships and collect new field definitions
        for (const fieldRef of object.fields) {
          const fieldQuery = `
            SELECT id, short_name, display_name, description, datatype, 
                   datatype_properties, validation_rules, mandatory, created_at, updated_at
            FROM field_definitions WHERE short_name = $1
          `;
          const fieldResult = await client.query(fieldQuery, [fieldRef.fieldShortName]);
          
          if (fieldResult.rows.length === 0) {
            throw new Error(`Field '${fieldRef.fieldShortName}' does not exist`);
          }

          const fieldId = fieldResult.rows[0].id;
          newFieldDefinitions.push(this.mapFieldRow(fieldResult.rows[0]));

          const relationQuery = `
            INSERT INTO object_fields (object_id, field_id, mandatory, display_order)
            VALUES ($1, $2, $3, $4)
          `;

          await client.query(relationQuery, [
            objectId,
            fieldId,
            fieldRef.mandatory,
            fieldRef.order
          ]);
        }
      } else if (object.displayProperties) {
        // If only displayProperties changed, we still need to run migration for index changes
        needsMigration = true;
        
        // Get existing field definitions
        for (const fieldRef of existing.fields) {
          const fieldQuery = `
            SELECT id, short_name, display_name, description, datatype, 
                   datatype_properties, validation_rules, mandatory, created_at, updated_at
            FROM field_definitions WHERE short_name = $1
          `;
          const fieldResult = await client.query(fieldQuery, [fieldRef.fieldShortName]);
          if (fieldResult.rows.length > 0) {
            oldFieldDefinitions.push(this.mapFieldRow(fieldResult.rows[0]));
            newFieldDefinitions.push(this.mapFieldRow(fieldResult.rows[0]));
          }
        }
      }

      if (needsMigration) {
        // Generate and execute migration SQL
        const newObjectDef = {
          ...existing,
          ...object,
          fields: object.fields ?? existing.fields,
          displayProperties: object.displayProperties ?? existing.displayProperties
        };

        const migrationStatements = tableGeneratorService.generateMigration(
          existing,
          oldFieldDefinitions,
          newObjectDef,
          newFieldDefinitions
        );

        for (const statement of migrationStatements) {
          await client.query(statement);
        }
      }

      await client.query('COMMIT');

      return this.mapObjectRow(objectResult.rows[0], object.fields ?? existing.fields);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete an object definition
   */
  async deleteObject(shortName: string): Promise<boolean> {
    const query = `
      DELETE FROM object_definitions
      WHERE short_name = $1
      RETURNING id
    `;

    const result = await db.query(query, [shortName]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Map database row to FieldDefinition
   */
  private mapFieldRow(row: any): FieldDefinition {
    return {
      id: row.id,
      shortName: row.short_name,
      displayName: row.display_name,
      description: row.description,
      datatype: row.datatype,
      datatypeProperties: typeof row.datatype_properties === 'string' 
        ? JSON.parse(row.datatype_properties) 
        : row.datatype_properties,
      validationRules: typeof row.validation_rules === 'string'
        ? JSON.parse(row.validation_rules)
        : row.validation_rules,
      mandatory: row.mandatory,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to ObjectDefinition
   */
  private mapObjectRow(row: any, fields: any[]): ObjectDefinition {
    return {
      id: row.id,
      shortName: row.short_name,
      displayName: row.display_name,
      description: row.description,
      fields: fields,
      displayProperties: typeof row.display_properties === 'string'
        ? JSON.parse(row.display_properties)
        : row.display_properties,
      wizardConfig: row.wizard_config 
        ? (typeof row.wizard_config === 'string' ? JSON.parse(row.wizard_config) : row.wizard_config)
        : undefined,
      fieldGroups: row.field_groups
        ? (typeof row.field_groups === 'string' ? JSON.parse(row.field_groups) : row.field_groups)
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row with fields to ObjectDefinition
   */
  private mapObjectRowWithFields(row: any): ObjectDefinition {
    const fields = row.fields && row.fields[0] && row.fields[0].fieldShortName
      ? row.fields
      : [];

    return {
      id: row.id,
      shortName: row.short_name,
      displayName: row.display_name,
      description: row.description,
      fields: fields,
      displayProperties: typeof row.display_properties === 'string'
        ? JSON.parse(row.display_properties)
        : row.display_properties,
      wizardConfig: row.wizard_config 
        ? (typeof row.wizard_config === 'string' ? JSON.parse(row.wizard_config) : row.wizard_config)
        : undefined,
      fieldGroups: row.field_groups
        ? (typeof row.field_groups === 'string' ? JSON.parse(row.field_groups) : row.field_groups)
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Validate field groups configuration
   * Ensures all field short names in groups exist in the object's fields list
   */
  private validateFieldGroups(fieldGroups: any[], objectFields: any[]): void {
    const fieldShortNames = new Set(objectFields.map((f: any) => f.fieldShortName));

    for (const group of fieldGroups) {
      if (!group.name || typeof group.name !== 'string') {
        throw new Error('Field group must have a name');
      }

      if (!group.description || typeof group.description !== 'string') {
        throw new Error(`Field group '${group.name}' must have a description`);
      }

      if (!Array.isArray(group.fields)) {
        throw new Error(`Field group '${group.name}' must have a fields array`);
      }

      if (typeof group.order !== 'number') {
        throw new Error(`Field group '${group.name}' must have an order number`);
      }

      for (const fieldShortName of group.fields) {
        if (!fieldShortNames.has(fieldShortName)) {
          throw new Error(
            `Field group '${group.name}' references field '${fieldShortName}' which does not exist in the object's fields list`
          );
        }
      }
    }
  }
}

export const metadataService = new MetadataService();
